// Agent API — lets external AI agents (Claude, ChatGPT, etc.) act on the app
// through a scoped API key created in Admin → Agents.
//
// Speaks three dialects on one URL:
//   • MCP (JSON-RPC over HTTP POST)   — for Claude / MCP clients
//   • REST  POST /tools/{name}        — for ChatGPT Actions & scripts
//   • GET  /openapi.json              — OpenAPI spec of the tools a key may use
//
// Unlike the other functions, this one uses a Firebase *service account* to
// read/write Firestore, because agents have no signed-in Firebase user. Every
// key is checked against its scopes here, server-side — that is the real
// enforcement for agents, not the admin UI.
import { importPKCS8, SignJWT } from "npm:jose@5.10.0";

const projectId = Deno.env.get("PF_FIREBASE_PROJECT_ID");
const serviceAccountJson = Deno.env.get("PF_FIREBASE_SERVICE_ACCOUNT");
const bucketId = Deno.env.get("PF_BACKBLAZE_BUCKET_ID");
const b2KeyId = Deno.env.get("PF_BACKBLAZE_ADMIN_KEY_ID");
const b2AppKey = Deno.env.get("PF_BACKBLAZE_ADMIN_APPLICATION_KEY");

const DB = () => `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

const cors = (r: Request) => ({
  "Access-Control-Allow-Origin": r.headers.get("origin") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, mcp-protocol-version, mcp-session-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  Vary: "Origin",
});
const json = (r: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(r), "Content-Type": "application/json" } });

////////////////////////////////////////////////////////////////
// Firestore REST (service account)
////////////////////////////////////////////////////////////////

let cachedToken: { value: string; expires: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.value;
  if (!serviceAccountJson || !projectId) throw new Error("unconfigured");
  const sa = JSON.parse(serviceAccountJson);
  const key = await importPKCS8(sa.private_key, "RS256");
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/datastore" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("55m")
    .sign(key);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new Error("unconfigured");
  const data = await res.json();
  cachedToken = { value: data.access_token, expires: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
}

// Firestore's REST quota can 429 in bursts — same retry pattern as the other functions.
async function fs(path: string, init: RequestInit = {}, attempts = 3): Promise<Response> {
  const token = await accessToken();
  let res: Response;
  for (let i = 0; i < attempts; i++) {
    res = await fetch(path.startsWith("http") ? path : `${DB()}${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (res.status !== 429) return res;
    await res.body?.cancel().catch(() => {});
    await new Promise((r) => setTimeout(r, 250 * (i + 1)));
  }
  return res!;
}

// Plain JS <-> Firestore value codec. Timestamps travel as { __ts: ISO string }.
// deno-lint-ignore no-explicit-any
function toValue(v: any): any {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === "object" && "__ts" in v) return { timestampValue: v.__ts };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toValue(x)])) } };
}
// deno-lint-ignore no-explicit-any
function fromValue(v: any): any {
  if (v === undefined || "nullValue" in v) return null;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("stringValue" in v) return v.stringValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(fromValue);
  if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, fromValue(x)]));
  return null;
}
// deno-lint-ignore no-explicit-any
const fromDoc = (d: any) => ({ id: String(d.name).split("/").pop(), ...Object.fromEntries(Object.entries(d.fields ?? {}).map(([k, x]) => [k, fromValue(x)])) });
const nowTs = () => ({ __ts: new Date().toISOString() });

async function getDocument(path: string) {
  const res = await fs(`/${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("firestore");
  return fromDoc(await res.json());
}
async function listCollection(collection: string, pageSize = 100) {
  const res = await fs(`/${collection}?pageSize=${Math.min(pageSize, 300)}`);
  if (!res.ok) throw new Error("firestore");
  const data = await res.json();
  return (data.documents ?? []).map(fromDoc);
}
async function writeDocument(path: string, data: Record<string, unknown>, merge = true) {
  const mask = merge ? Object.keys(data).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&") : "";
  const res = await fs(`/${path}${mask ? `?${mask}` : ""}`, {
    method: "PATCH",
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toValue(v)])) }),
  });
  if (!res.ok) throw new Error("firestore");
  return fromDoc(await res.json());
}
async function createDocument(collection: string, data: Record<string, unknown>) {
  const res = await fs(`/${collection}`, {
    method: "POST",
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toValue(v)])) }),
  });
  if (!res.ok) throw new Error("firestore");
  return fromDoc(await res.json());
}
async function deleteDocument(path: string) {
  const res = await fs(`/${path}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error("firestore");
}
// deno-lint-ignore no-explicit-any
async function runQuery(collection: string, opts: { where?: any[]; orderBy?: string; desc?: boolean; limit?: number; select?: string[] } = {}) {
  const structuredQuery: Record<string, unknown> = { from: [{ collectionId: collection }] };
  if (opts.where?.length) {
    structuredQuery.where = opts.where.length === 1 ? opts.where[0] : { compositeFilter: { op: "AND", filters: opts.where } };
  }
  if (opts.orderBy) structuredQuery.orderBy = [{ field: { fieldPath: opts.orderBy }, direction: opts.desc ? "DESCENDING" : "ASCENDING" }];
  if (opts.limit) structuredQuery.limit = opts.limit;
  if (opts.select) structuredQuery.select = { fields: opts.select.map((f) => ({ fieldPath: f })) };
  const res = await fs(`:runQuery`, { method: "POST", body: JSON.stringify({ structuredQuery }) });
  if (!res.ok) throw new Error("firestore");
  // deno-lint-ignore no-explicit-any
  return (await res.json()).filter((r: any) => r.document).map((r: any) => fromDoc(r.document));
}
const whereField = (field: string, op: string, value: unknown) => ({ fieldFilter: { field: { fieldPath: field }, op, value: toValue(value) } });
const sinceTs = (days: number) => ({ __ts: new Date(Date.now() - days * 86400_000).toISOString() });

async function countQuery(collection: string, where: unknown[] = []) {
  const structuredQuery: Record<string, unknown> = { from: [{ collectionId: collection }] };
  if (where.length) structuredQuery.where = where.length === 1 ? where[0] : { compositeFilter: { op: "AND", filters: where } };
  const res = await fs(`:runAggregationQuery`, { method: "POST", body: JSON.stringify({ structuredAggregationQuery: { structuredQuery, aggregations: [{ count: {}, alias: "n" }] } }) });
  if (!res.ok) throw new Error("firestore");
  const data = await res.json();
  return Number(data?.[0]?.result?.aggregateFields?.n?.integerValue ?? 0);
}

////////////////////////////////////////////////////////////////
// Backblaze (audio upload URLs + deletes)
////////////////////////////////////////////////////////////////

async function b2Authorize() {
  if (!b2KeyId || !b2AppKey || !bucketId) throw new Error("storage_unconfigured");
  const r = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", { headers: { Authorization: `Basic ${btoa(`${b2KeyId}:${b2AppKey}`)}` } });
  if (!r.ok) throw new Error("storage");
  return await r.json();
}
async function b2DeleteFile(storageKey: string) {
  const account = await b2Authorize();
  const apiUrl = account.apiInfo.storageApi.apiUrl;
  const headers = { Authorization: account.authorizationToken, "Content-Type": "application/json" };
  const listed = await fetch(`${apiUrl}/b2api/v3/b2_list_file_versions`, { method: "POST", headers, body: JSON.stringify({ bucketId, startFileName: storageKey, maxFileCount: 100 }) });
  const data = await listed.json();
  for (const file of data.files ?? []) {
    if (file.fileName !== storageKey) break;
    await fetch(`${apiUrl}/b2api/v3/b2_delete_file_version`, { method: "POST", headers, body: JSON.stringify({ fileName: file.fileName, fileId: file.fileId }) });
  }
}
const validStorageKey = (k: unknown) => typeof k === "string" && /^audio\/[A-Za-z0-9._/-]{1,500}$/.test(k) && !k.includes("..");

////////////////////////////////////////////////////////////////
// Tools
////////////////////////////////////////////////////////////////

type Agent = { id: string; name: string; provider: string; scopes: string[] };
type Tool = {
  name: string;
  scope: string;
  write?: boolean;
  description: string;
  // deno-lint-ignore no-explicit-any
  input: Record<string, any>;
  required?: string[];
  // deno-lint-ignore no-explicit-any
  run: (args: any, agent: Agent) => Promise<{ result: unknown; audit?: { targetType: string; targetId?: string; targetLabel?: string; before?: unknown; after?: unknown } }>;
};

const str = (description: string, extra: Record<string, unknown> = {}) => ({ type: "string", description, ...extra });
const num = (description: string) => ({ type: "number", description });
const bool = (description: string) => ({ type: "boolean", description });
const AUDIO_TYPES = ["sermon", "homily", "sundayschool"];
const clampDays = (d: unknown, fallback = 30) => Math.min(Math.max(Number(d) || fallback, 1), 365);
const pick = (obj: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));
const audioSummary = (a: Record<string, unknown>) => pick(a, ["id", "title", "speaker", "type", "date", "duration", "order", "createdAt", "audioStorageKey", "aiSummary"]);

const NOTICE_FIELDS = ["title", "details", "buttonEnabled", "buttonText", "buttonType", "buttonValue", "active", "pinned", "audience", "inputEnabled", "inputMessage", "inputPlaceholder", "inputButtonText"];
const CAMPAIGN_FIELDS = ["title", "speaker", "details", "docsLink", "memorization", "notes", "questions"];
const PAGE_FIELDS = ["name", "navLabel", "description", "enabled", "status", "showInNavigation", "badgeEnabled", "badgeText", "badgeColor", "pinned", "order", "accessLevel", "maintenanceTitle", "maintenanceMessage", "comingSoonTitle", "comingSoonMessage", "comingSoonBadge"];
const PAGE_IDS = ["home", "doctrine", "sermons", "sundayschool", "about", "feedback", "contact", "resources", "your-listens", "saved", "stats", "suggest", "settings"];
const RESOURCE_FIELDS = ["type", "title", "description", "url", "author", "date", "featured", "published", "order", "categoryId", "sectionIds"];
const SUGGESTION_STATUSES = ["none", "planned", "in progress", "complete"];

const TOOLS: Tool[] = [
  // ---- audio -----------------------------------------------------------
  {
    name: "list_audio", scope: "audio:read", description: "List audio recordings (newest first). Optionally filter by type or search title/speaker.",
    input: { type: str("Filter by type", { enum: AUDIO_TYPES }), search: str("Case-insensitive match on title or speaker"), limit: num("Max results (default 50, max 200)") },
    run: async (a) => {
      let rows = await runQuery("audio", { orderBy: "createdAt", desc: true, limit: 500 });
      if (a.type) rows = rows.filter((r: Record<string, unknown>) => r.type === a.type);
      if (a.search) { const s = String(a.search).toLowerCase(); rows = rows.filter((r: Record<string, unknown>) => `${r.title} ${r.speaker}`.toLowerCase().includes(s)); }
      return { result: rows.slice(0, Math.min(Number(a.limit) || 50, 200)).map(audioSummary) };
    },
  },
  {
    name: "get_audio", scope: "audio:read", description: "Get one recording by id, including its AI summary if present.", required: ["id"], input: { id: str("Audio document id") },
    run: async (a) => { const d = await getDocument(`audio/${a.id}`); if (!d) throw new Error("not_found"); return { result: audioSummary(d) }; },
  },
  {
    name: "request_audio_upload", scope: "audio:create", write: true,
    description: "Step 1 of adding an audio file. Returns a one-time upload URL + token. Upload the raw file with an HTTP POST to uploadUrl using headers Authorization: <uploadToken>, X-Bz-File-Name: <URL-encoded storageKey>, Content-Type: audio/mpeg (or b2/x-auto), X-Bz-Content-Sha1: <sha1 hex of the file>. Then call create_audio with the storageKey.",
    required: ["fileName"], input: { fileName: str("Original file name, e.g. sermon.mp3") },
    run: async (a) => {
      const account = await b2Authorize();
      const name = String(a.fileName).replace(/[^A-Za-z0-9._-]/g, "_").slice(-160) || "audio.mp3";
      const storageKey = `audio/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${name}`;
      const res = await fetch(`${account.apiInfo.storageApi.apiUrl}/b2api/v3/b2_get_upload_url`, { method: "POST", headers: { Authorization: account.authorizationToken, "Content-Type": "application/json" }, body: JSON.stringify({ bucketId }) });
      const data = await res.json();
      if (!res.ok) throw new Error("storage");
      return { result: { storageKey, uploadUrl: data.uploadUrl, uploadToken: data.authorizationToken } };
    },
  },
  {
    name: "create_audio", scope: "audio:create", write: true,
    description: "Step 2 of adding audio: register an already-uploaded file (from request_audio_upload) as a recording.",
    required: ["title", "speaker", "type", "storageKey"],
    input: { title: str("Title"), speaker: str("Speaker / host"), type: str("Category", { enum: AUDIO_TYPES }), date: str("YYYY-MM-DD (defaults to today)"), storageKey: str("storageKey returned by request_audio_upload"), duration: num("Length in seconds, if known") },
    run: async (a) => {
      if (!validStorageKey(a.storageKey)) throw new Error("bad_request:invalid storageKey");
      if (!AUDIO_TYPES.includes(a.type)) throw new Error("bad_request:invalid type");
      const existing = await runQuery("audio", { orderBy: "order", desc: true, limit: 1 });
      const order = (Number(existing[0]?.order) || 0) + 1;
      const doc = await createDocument("audio", {
        title: String(a.title).slice(0, 200), speaker: String(a.speaker).slice(0, 120), type: a.type,
        date: a.date || new Date().toISOString().slice(0, 10), audioStorageKey: a.storageKey, order, createdAt: nowTs(),
        ...(a.duration ? { duration: Number(a.duration) } : {}),
      });
      return { result: audioSummary(doc), audit: { targetType: "audio", targetId: doc.id as string, targetLabel: a.title, after: { title: a.title, speaker: a.speaker, type: a.type } } };
    },
  },
  {
    name: "update_audio", scope: "audio:edit", write: true, description: "Edit a recording's title, speaker, type, or date.", required: ["id"],
    input: { id: str("Audio document id"), title: str("New title"), speaker: str("New speaker"), type: str("New category", { enum: AUDIO_TYPES }), date: str("YYYY-MM-DD") },
    run: async (a) => {
      const before = await getDocument(`audio/${a.id}`); if (!before) throw new Error("not_found");
      const changes = pick(a, ["title", "speaker", "type", "date"]);
      if (changes.type && !AUDIO_TYPES.includes(changes.type as string)) throw new Error("bad_request:invalid type");
      if (!Object.keys(changes).length) throw new Error("bad_request:nothing to update");
      await writeDocument(`audio/${a.id}`, changes);
      return { result: { updated: true, id: a.id, changes }, audit: { targetType: "audio", targetId: a.id, targetLabel: (changes.title ?? before.title) as string, before: pick(before, Object.keys(changes)), after: changes } };
    },
  },
  {
    name: "delete_audio", scope: "audio:delete", write: true, description: "Permanently delete a recording and its stored file. Cannot be undone.", required: ["id"], input: { id: str("Audio document id") },
    run: async (a) => {
      const before = await getDocument(`audio/${a.id}`); if (!before) throw new Error("not_found");
      if (validStorageKey(before.audioStorageKey)) await b2DeleteFile(before.audioStorageKey as string);
      await deleteDocument(`audio/${a.id}`);
      return { result: { deleted: true, id: a.id }, audit: { targetType: "audio", targetId: a.id, targetLabel: before.title as string, before: pick(before, ["title", "speaker", "type", "date"]), after: null } };
    },
  },

  // ---- analytics -------------------------------------------------------
  {
    name: "get_analytics_overview", scope: "analytics:read", description: "High-level totals: users, audio files, listens, and recent activity.",
    input: { days: num("Look-back window in days (default 30, max 365)") },
    run: async (a) => {
      const days = clampDays(a.days); const since = sinceTs(days);
      const [users, audio, listensAll, listensRecent, newUsers, events] = await Promise.all([
        countQuery("users"), countQuery("audio"), countQuery("appUsage"),
        countQuery("appUsage", [whereField("createdAt", "GREATER_THAN_OR_EQUAL", since)]),
        countQuery("users", [whereField("createdAt", "GREATER_THAN_OR_EQUAL", since)]),
        countQuery("logs", [whereField("createdAt", "GREATER_THAN_OR_EQUAL", since)]),
      ]);
      return { result: { windowDays: days, totalUsers: users, totalAudio: audio, totalListens: listensAll, listensInWindow: listensRecent, newUsersInWindow: newUsers, eventsInWindow: events } };
    },
  },
  {
    name: "get_audio_analytics", scope: "audioAnalytics:read", description: "Listen counts per recording (guests included) over a window, most-played first.",
    input: { days: num("Look-back window in days (default 30, max 365)"), limit: num("Max recordings (default 20)") },
    run: async (a) => {
      const days = clampDays(a.days);
      const [rows, audio] = await Promise.all([
        runQuery("appUsage", { where: [whereField("createdAt", "GREATER_THAN_OR_EQUAL", sinceTs(days))], limit: 5000, select: ["sermonId", "userId"] }),
        runQuery("audio", { limit: 1000, select: ["title", "speaker", "type"] }),
      ]);
      const byId = new Map(audio.map((x: Record<string, unknown>) => [x.id, x]));
      const stats = new Map<string, { plays: number; guests: number; users: Set<string> }>();
      for (const r of rows as Record<string, unknown>[]) {
        const s = stats.get(r.sermonId as string) ?? { plays: 0, guests: 0, users: new Set() };
        s.plays++; if (r.userId) s.users.add(r.userId as string); else s.guests++;
        stats.set(r.sermonId as string, s);
      }
      const out = [...stats.entries()].map(([id, s]) => ({ id, title: (byId.get(id) as Record<string, unknown>)?.title ?? "(deleted)", speaker: (byId.get(id) as Record<string, unknown>)?.speaker ?? null, plays: s.plays, uniqueSignedInListeners: s.users.size, guestPlays: s.guests }))
        .sort((x, y) => y.plays - x.plays).slice(0, Math.min(Number(a.limit) || 20, 100));
      return { result: { windowDays: days, totalPlaysCounted: rows.length, truncatedAt5000: rows.length >= 5000, recordings: out } };
    },
  },
  {
    name: "get_user_analytics", scope: "userAnalytics:read", description: "User growth and engagement (aggregate only — no personal details): signups per day, roles, active users, how people found the app.",
    input: { days: num("Look-back window in days (default 30, max 365)") },
    run: async (a) => {
      const days = clampDays(a.days);
      const users = await runQuery("users", { limit: 2000, select: ["createdAt", "role", "howFound", "lastActiveAt", "disabled"] });
      const cutoff = Date.now() - days * 86400_000;
      const signupsByDay: Record<string, number> = {}; const roles: Record<string, number> = {}; const found: Record<string, number> = {};
      let active7 = 0, active30 = 0, disabled = 0;
      for (const u of users as Record<string, unknown>[]) {
        const created = u.createdAt ? Date.parse(u.createdAt as string) : NaN;
        if (created >= cutoff) { const d = new Date(created).toISOString().slice(0, 10); signupsByDay[d] = (signupsByDay[d] ?? 0) + 1; }
        roles[(u.role as string) || "user"] = (roles[(u.role as string) || "user"] ?? 0) + 1;
        const f = (u.howFound as string) || "Unknown"; found[f] = (found[f] ?? 0) + 1;
        const last = u.lastActiveAt ? Date.parse(u.lastActiveAt as string) : NaN;
        if (last >= Date.now() - 7 * 86400_000) active7++;
        if (last >= Date.now() - 30 * 86400_000) active30++;
        if (u.disabled) disabled++;
      }
      return { result: { totalUsers: users.length, windowDays: days, signupsByDay, roles, howFound: found, activeLast7Days: active7, activeLast30Days: active30, disabledAccounts: disabled } };
    },
  },
  {
    name: "list_users", scope: "users:read", description: "List registered users (name, email, role, join date, last active). Contains personal information.",
    input: { search: str("Match name or email"), limit: num("Max results (default 50, max 200)") },
    run: async (a) => {
      let rows = await runQuery("users", { limit: 1000, select: ["fullName", "name", "email", "role", "createdAt", "lastActiveAt", "disabled"] });
      if (a.search) { const s = String(a.search).toLowerCase(); rows = rows.filter((r: Record<string, unknown>) => `${r.fullName ?? r.name} ${r.email}`.toLowerCase().includes(s)); }
      return { result: rows.slice(0, Math.min(Number(a.limit) || 50, 200)).map((r: Record<string, unknown>) => ({ id: r.id, name: r.fullName ?? r.name ?? null, email: r.email ?? null, role: r.role ?? "user", disabled: !!r.disabled, createdAt: r.createdAt ?? null, lastActiveAt: r.lastActiveAt ?? null })) };
    },
  },

  // ---- notices ---------------------------------------------------------
  { name: "list_notices", scope: "notices:read", description: "List notices (announcement cards shown in the app).", input: {}, run: async () => ({ result: await listCollection("notices", 100) }) },
  {
    name: "create_notice", scope: "notices:edit", write: true, description: "Create a notice.", required: ["title"],
    input: { title: str("Title"), details: str("Body text"), active: bool("Visible now (default true)"), pinned: bool("Pin to top"), audience: str("Who sees it", { enum: ["all", "users", "admins", "guests"] }), buttonEnabled: bool("Show a button"), buttonText: str("Button label"), buttonType: str("url or route", { enum: ["url", "route"] }), buttonValue: str("URL or in-app route") },
    run: async (a) => {
      const data = { active: true, pinned: false, audience: "all", buttonEnabled: false, ...pick(a, NOTICE_FIELDS), createdAt: nowTs() };
      const doc = await createDocument("notices", data);
      return { result: doc, audit: { targetType: "notice", targetId: doc.id as string, targetLabel: a.title, after: pick(data, NOTICE_FIELDS) } };
    },
  },
  {
    name: "update_notice", scope: "notices:edit", write: true, description: "Edit a notice.", required: ["id"],
    input: { id: str("Notice id"), title: str("Title"), details: str("Body"), active: bool("Visible"), pinned: bool("Pinned"), audience: str("Audience", { enum: ["all", "users", "admins", "guests"] }), buttonEnabled: bool("Show button"), buttonText: str("Label"), buttonType: str("url or route"), buttonValue: str("Target") },
    run: async (a) => {
      const before = await getDocument(`notices/${a.id}`); if (!before) throw new Error("not_found");
      const changes = pick(a, NOTICE_FIELDS); if (!Object.keys(changes).length) throw new Error("bad_request:nothing to update");
      await writeDocument(`notices/${a.id}`, changes);
      return { result: { updated: true, id: a.id }, audit: { targetType: "notice", targetId: a.id, targetLabel: (changes.title ?? before.title) as string, before: pick(before, Object.keys(changes)), after: changes } };
    },
  },
  {
    name: "delete_notice", scope: "notices:delete", write: true, description: "Delete a notice.", required: ["id"], input: { id: str("Notice id") },
    run: async (a) => {
      const before = await getDocument(`notices/${a.id}`); if (!before) throw new Error("not_found");
      await deleteDocument(`notices/${a.id}`);
      return { result: { deleted: true, id: a.id }, audit: { targetType: "notice", targetId: a.id, targetLabel: before.title as string, before: pick(before, NOTICE_FIELDS), after: null } };
    },
  },

  // ---- doctrine / featured campaign -----------------------------------
  { name: "get_campaign", scope: "campaign:read", description: "Read the Doctrine (featured) campaign page content.", input: {}, run: async () => ({ result: await getDocument("doctrineWeeks/current") }) },
  {
    name: "update_campaign", scope: "campaign:edit", write: true, description: "Edit the campaign page's text fields.",
    input: { title: str("Title"), speaker: str("Speaker"), details: str("Details"), docsLink: str("Link to documents"), memorization: str("Memorization text"), notes: str("Notes"), questions: { type: "array", items: { type: "string" }, description: "Discussion questions" } },
    run: async (a) => {
      const before = await getDocument("doctrineWeeks/current");
      const changes = pick(a, CAMPAIGN_FIELDS); if (!Object.keys(changes).length) throw new Error("bad_request:nothing to update");
      await writeDocument("doctrineWeeks/current", { ...changes, updatedAt: nowTs() });
      return { result: { updated: true }, audit: { targetType: "campaign", targetId: "current", targetLabel: "Doctrine Campaign", before: before ? pick(before, Object.keys(changes)) : null, after: changes } };
    },
  },
  {
    name: "delete_campaign", scope: "campaign:delete", write: true, description: "Delete the campaign page content entirely (its recordings' files are not removed).", input: {},
    run: async () => {
      const before = await getDocument("doctrineWeeks/current");
      await deleteDocument("doctrineWeeks/current");
      return { result: { deleted: true }, audit: { targetType: "campaign", targetId: "current", targetLabel: "Doctrine Campaign", before: before ? pick(before, CAMPAIGN_FIELDS) : null, after: null } };
    },
  },

  // ---- page manager ----------------------------------------------------
  { name: "list_pages", scope: "pages:read", description: "Read Page Manager overrides (stored per-page settings). Pages with no override use built-in defaults. Known page ids: " + PAGE_IDS.join(", "), input: {}, run: async () => ({ result: { knownPageIds: PAGE_IDS, overrides: await listCollection("pages", 100) } }) },
  {
    name: "update_page", scope: "pages:edit", write: true, description: "Change a page's Page Manager settings (name, visibility, status, badge, maintenance / coming-soon text). Known page ids: " + PAGE_IDS.join(", "), required: ["id"],
    input: { id: str("Page id", { enum: PAGE_IDS }), name: str("Display name"), navLabel: str("Bottom-nav label"), description: str("Description"), enabled: bool("Page on/off"), status: str("Status", { enum: ["active", "maintenance", "coming_soon", "disabled"] }), showInNavigation: bool("Show in nav"), badgeEnabled: bool("Show badge"), badgeText: str("Badge text"), badgeColor: str("Badge color"), pinned: bool("Pinned"), order: num("Sort order"), accessLevel: str("Access", { enum: ["public", "loggedIn", "admin"] }), maintenanceTitle: str("Maintenance title"), maintenanceMessage: str("Maintenance message"), comingSoonTitle: str("Coming-soon title"), comingSoonMessage: str("Coming-soon message"), comingSoonBadge: str("Coming-soon badge") },
    run: async (a) => {
      if (!PAGE_IDS.includes(a.id)) throw new Error("bad_request:unknown page id");
      const before = await getDocument(`pages/${a.id}`);
      const changes = pick(a, PAGE_FIELDS); if (!Object.keys(changes).length) throw new Error("bad_request:nothing to update");
      await writeDocument(`pages/${a.id}`, { ...changes, updatedAt: nowTs() });
      return { result: { updated: true, id: a.id, changes }, audit: { targetType: "page", targetId: a.id, targetLabel: a.id, before: before ? pick(before, Object.keys(changes)) : null, after: changes } };
    },
  },

  // ---- suggestions -----------------------------------------------------
  {
    name: "list_suggestions", scope: "suggestions:read", description: "List feature suggestions with votes, status, and admin/agent comments.", input: { status: str("Filter by status", { enum: SUGGESTION_STATUSES }) },
    run: async (a) => { let rows = await runQuery("suggestions", { orderBy: "createdAt", desc: true, limit: 200 }); if (a.status) rows = rows.filter((r: Record<string, unknown>) => r.status === a.status); return { result: rows.map((r: Record<string, unknown>) => pick(r, ["id", "title", "details", "votes", "status", "createdAt", "adminComments"])) }; },
  },
  {
    name: "comment_on_suggestion", scope: "suggestions:comment", write: true, description: "Add a comment to a suggestion (shown to admins, labeled with this agent's name).", required: ["id", "comment"],
    input: { id: str("Suggestion id"), comment: str("Comment text (max 1000 chars)") },
    run: async (a, agent) => {
      const before = await getDocument(`suggestions/${a.id}`); if (!before) throw new Error("not_found");
      const entry = { text: String(a.comment).slice(0, 1000), by: `${agent.name} (${agent.provider})`, agent: true, at: new Date().toISOString() };
      const comments = [...((before.adminComments as unknown[]) ?? []), entry].slice(-50);
      await writeDocument(`suggestions/${a.id}`, { adminComments: comments });
      return { result: { commented: true, id: a.id }, audit: { targetType: "suggestion", targetId: a.id, targetLabel: before.title as string, before: null, after: { comment: entry.text } } };
    },
  },
  {
    name: "set_suggestion_status", scope: "suggestions:edit", write: true, description: "Set a suggestion's status.", required: ["id", "status"], input: { id: str("Suggestion id"), status: str("Status", { enum: SUGGESTION_STATUSES }) },
    run: async (a) => {
      if (!SUGGESTION_STATUSES.includes(a.status)) throw new Error("bad_request:invalid status");
      const before = await getDocument(`suggestions/${a.id}`); if (!before) throw new Error("not_found");
      await writeDocument(`suggestions/${a.id}`, { status: a.status });
      return { result: { updated: true }, audit: { targetType: "suggestion", targetId: a.id, targetLabel: before.title as string, before: { status: before.status }, after: { status: a.status } } };
    },
  },

  // ---- resources -------------------------------------------------------
  { name: "list_resources", scope: "resources:read", description: "List library resources.", input: {}, run: async () => ({ result: (await listCollection("resources", 300)).map((r: Record<string, unknown>) => pick(r, ["id", ...RESOURCE_FIELDS])) }) },
  {
    name: "create_resource", scope: "resources:edit", write: true, description: "Create a resource (link/article style).", required: ["title", "type"],
    input: { title: str("Title"), type: str("Resource type, e.g. article, link, video, pdf"), description: str("Description"), url: str("URL"), author: str("Author"), date: str("YYYY-MM-DD"), featured: bool("Featured"), published: bool("Published (default true)") },
    run: async (a) => { const data = { published: true, featured: false, order: 0, ...pick(a, RESOURCE_FIELDS), createdAt: nowTs() }; const doc = await createDocument("resources", data); return { result: doc, audit: { targetType: "resource", targetId: doc.id as string, targetLabel: a.title, after: pick(data, RESOURCE_FIELDS) } }; },
  },
  {
    name: "update_resource", scope: "resources:edit", write: true, description: "Edit a resource.", required: ["id"],
    input: { id: str("Resource id"), title: str("Title"), description: str("Description"), url: str("URL"), author: str("Author"), date: str("YYYY-MM-DD"), featured: bool("Featured"), published: bool("Published") },
    run: async (a) => {
      const before = await getDocument(`resources/${a.id}`); if (!before) throw new Error("not_found");
      const changes = pick(a, RESOURCE_FIELDS); if (!Object.keys(changes).length) throw new Error("bad_request:nothing to update");
      await writeDocument(`resources/${a.id}`, changes);
      return { result: { updated: true, id: a.id }, audit: { targetType: "resource", targetId: a.id, targetLabel: (changes.title ?? before.title) as string, before: pick(before, Object.keys(changes)), after: changes } };
    },
  },
  {
    name: "delete_resource", scope: "resources:delete", write: true, description: "Delete a resource.", required: ["id"], input: { id: str("Resource id") },
    run: async (a) => { const before = await getDocument(`resources/${a.id}`); if (!before) throw new Error("not_found"); await deleteDocument(`resources/${a.id}`); return { result: { deleted: true, id: a.id }, audit: { targetType: "resource", targetId: a.id, targetLabel: before.title as string, before: pick(before, RESOURCE_FIELDS), after: null } }; },
  },

  // ---- logs / settings -------------------------------------------------
  {
    name: "list_admin_actions", scope: "logs:read", description: "Read the admin action audit trail (who changed what), newest first. Includes other agents' actions.", input: { limit: num("Max results (default 50, max 200)") },
    run: async (a) => ({ result: (await runQuery("adminActions", { orderBy: "createdAt", desc: true, limit: Math.min(Number(a.limit) || 50, 200) })).map((r: Record<string, unknown>) => pick(r, ["id", "category", "action", "targetType", "targetLabel", "adminName", "before", "after", "createdAt"])) }),
  },
  {
    name: "get_app_settings", scope: "settings:read", description: "Read app status settings (maintenance mode, registration, AI toggles). Read-only.", input: {},
    run: async () => { const d = await getDocument("appConfig/status"); return { result: d ? pick(d, ["shutdown", "message", "registrationEnabled", "maxDailyRegistrations", "audioAiEnabled", "audioAiAudiences"]) : null }; },
  },
];

////////////////////////////////////////////////////////////////
// Auth: API key -> agent
////////////////////////////////////////////////////////////////

async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function authenticate(r: Request): Promise<Agent> {
  const key = r.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!key || !/^pfa_[A-Za-z0-9_-]{20,80}$/.test(key)) throw new Error("unauthorized");
  const hash = await sha256Hex(key);
  const [doc] = await runQuery("agentKeys", { where: [whereField("keyHash", "EQUAL", hash)], limit: 1 });
  if (!doc || doc.revoked) throw new Error("unauthorized");
  if (doc.expiresAt && Date.parse(doc.expiresAt as string) < Date.now()) throw new Error("expired");
  void writeDocument(`agentKeys/${doc.id}`, { lastUsedAt: nowTs() }).catch(() => {});
  return { id: doc.id as string, name: (doc.name as string) || "Agent", provider: (doc.provider as string) || "other", scopes: Array.isArray(doc.scopes) ? (doc.scopes as string[]) : [] };
}

const allowedTools = (agent: Agent) => TOOLS.filter((t) => agent.scopes.includes(t.scope));

async function callTool(agent: Agent, name: string, args: Record<string, unknown>) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error("unknown_tool");
  if (!agent.scopes.includes(tool.scope)) throw new Error(`forbidden:${tool.scope}`);
  for (const req of tool.required ?? []) if (args?.[req] === undefined || args?.[req] === "") throw new Error(`bad_request:missing ${req}`);
  const { result, audit } = await tool.run(args ?? {}, agent);
  if (tool.write && audit) {
    // Every write by an agent lands in the same audit trail admins use.
    await createDocument("adminActions", {
      category: "agent_action", action: tool.name, targetType: audit.targetType, targetId: audit.targetId ?? null, targetLabel: audit.targetLabel ?? null,
      before: audit.before ?? null, after: audit.after ?? null, adminId: `agent:${agent.id}`, adminEmail: null, adminName: `Agent: ${agent.name} (${agent.provider})`,
      deviceId: "agent-api", device: { platform: "agent", isMobile: false }, createdAt: nowTs(),
    }).catch(() => {});
  }
  return result;
}

////////////////////////////////////////////////////////////////
// Protocol layers
////////////////////////////////////////////////////////////////

const inputSchema = (t: Tool) => ({ type: "object", properties: t.input, ...(t.required?.length ? { required: t.required } : {}) });

function errorInfo(e: unknown) {
  const m = e instanceof Error ? e.message : "";
  if (m === "unauthorized") return { status: 401, message: "Invalid or missing agent API key." };
  if (m === "expired") return { status: 401, message: "This agent API key has expired." };
  if (m.startsWith("forbidden:")) return { status: 403, message: `This key doesn't have the "${m.slice(10)}" permission.` };
  if (m === "unknown_tool") return { status: 404, message: "Unknown tool." };
  if (m === "not_found") return { status: 404, message: "Not found." };
  if (m.startsWith("bad_request:")) return { status: 400, message: m.slice(12) };
  if (m === "unconfigured") return { status: 503, message: "The agent API isn't configured on the server yet (missing service account)." };
  if (m.startsWith("storage")) return { status: 503, message: "File storage is unavailable or not configured." };
  return { status: 500, message: "Something went wrong." };
}

function openApi(r: Request, agent: Agent) {
  // Inside Supabase the request URL is an internal http:// path, so build the public one.
  const root = `${Deno.env.get("SUPABASE_URL") ?? new URL(r.url).origin}/functions/v1/agent-api`;
  const paths: Record<string, unknown> = {};
  for (const t of allowedTools(agent)) {
    paths[`/tools/${t.name}`] = { post: { operationId: t.name, summary: t.description.slice(0, 120), description: t.description, requestBody: { required: !!t.required?.length, content: { "application/json": { schema: inputSchema(t) } } }, responses: { "200": { description: "Result", content: { "application/json": { schema: { type: "object" } } } } } } };
  }
  return { openapi: "3.1.0", info: { title: "App Agent API", version: "1.0.0", description: `Tools available to the "${agent.name}" key.` }, servers: [{ url: root }], components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } } }, security: [{ bearerAuth: [] }], paths };
}

Deno.serve(async (r) => {
  if (r.method === "OPTIONS") return new Response("ok", { headers: cors(r) });
  const url = new URL(r.url);
  const path = url.pathname.replace(/^\/functions\/v1\/agent-api/, "").replace(/^\/agent-api/, "") || "/";

  try {
    // The schema only describes tool names/parameters (no data), and ChatGPT's
    // "Import from URL" fetches it without credentials — so serve the full spec
    // publicly. Calls are still authenticated and scope-checked per key.
    if (r.method === "GET" && path === "/openapi.json") {
      const agent = await authenticate(r).catch(() => null);
      return json(r, openApi(r, agent ?? { id: "public", name: "Your agent", provider: "other", scopes: TOOLS.map((t) => t.scope) }));
    }

    const agent = await authenticate(r);

    if (r.method === "GET" && (path === "/" || path === "/tools")) return json(r, { agent: { name: agent.name, provider: agent.provider, scopes: agent.scopes }, tools: allowedTools(agent).map((t) => ({ name: t.name, description: t.description, inputSchema: inputSchema(t) })) });

    if (r.method === "POST" && path.startsWith("/tools/")) {
      const args = await r.json().catch(() => ({}));
      return json(r, { result: await callTool(agent, decodeURIComponent(path.slice(7)), args) });
    }

    // MCP over HTTP (JSON-RPC 2.0)
    if (r.method === "POST") {
      const msg = await r.json();
      if (Array.isArray(msg)) return json(r, { error: "Batch requests are not supported." }, 400);
      const id = msg.id ?? null;
      const ok = (result: unknown) => json(r, { jsonrpc: "2.0", id, result });
      if (msg.id === undefined) return new Response(null, { status: 202, headers: cors(r) }); // notification
      switch (msg.method) {
        case "initialize": return ok({ protocolVersion: msg.params?.protocolVersion ?? "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "app-agent-api", version: "1.0.0" }, instructions: `You are connected as "${agent.name}". Only the tools your key allows are listed. Write actions are logged in the app's admin audit trail.` });
        case "ping": return ok({});
        case "tools/list": return ok({ tools: allowedTools(agent).map((t) => ({ name: t.name, description: t.description, inputSchema: inputSchema(t) })) });
        case "tools/call": {
          try {
            const result = await callTool(agent, msg.params?.name, msg.params?.arguments ?? {});
            return ok({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
          } catch (e) {
            return ok({ isError: true, content: [{ type: "text", text: errorInfo(e).message }] });
          }
        }
        default: return json(r, { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } });
      }
    }
    return json(r, { error: "Not found." }, 404);
  } catch (e) {
    const { status, message } = errorInfo(e);
    return json(r, { error: message }, status);
  }
});
