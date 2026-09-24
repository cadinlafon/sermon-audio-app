import { importPKCS8, SignJWT } from "npm:jose@5.10.0";

export const projectId = Deno.env.get("PF_FIREBASE_PROJECT_ID");
export const serviceAccountJson = Deno.env.get("PF_FIREBASE_SERVICE_ACCOUNT");

export const DB = () => `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

////////////////////////////////////////////////////////////////
// Firestore REST (service account)
////////////////////////////////////////////////////////////////

export let cachedToken: { value: string; expires: number } | null = null;

export async function accessToken(): Promise<string> {
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
export async function fs(path: string, init: RequestInit = {}, attempts = 3): Promise<Response> {
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
export function toValue(v: any): any {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === "object" && "__ts" in v) return { timestampValue: v.__ts };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toValue(x)])) } };
}
// deno-lint-ignore no-explicit-any
export function fromValue(v: any): any {
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
export type Doc = { id: string; [key: string]: any };
// deno-lint-ignore no-explicit-any
export const fromDoc = (d: any): Doc => ({ id: String(d.name).split("/").pop() as string, ...Object.fromEntries(Object.entries(d.fields ?? {}).map(([k, x]) => [k, fromValue(x)])) });
export const nowTs = () => ({ __ts: new Date().toISOString() });

export async function getDocument(path: string) {
  const res = await fs(`/${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("firestore");
  return fromDoc(await res.json());
}
// Same, but also returns Firestore's updateTime — used as a write precondition
// so a one-time value (an OAuth authorization code) can only be consumed once.
export async function getDocumentWithVersion(path: string) {
  const res = await fs(`/${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("firestore");
  const raw = await res.json();
  return { doc: fromDoc(raw), updateTime: raw.updateTime as string };
}
// Returns false (instead of throwing) when the precondition no longer holds.
export async function writeIfUnchanged(path: string, data: Record<string, unknown>, updateTime: string) {
  const mask = Object.keys(data).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
  const res = await fs(`/${path}?${mask}&currentDocument.updateTime=${encodeURIComponent(updateTime)}`, {
    method: "PATCH",
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toValue(v)])) }),
  });
  if (res.status === 409 || res.status === 412 || res.status === 400) { await res.body?.cancel().catch(() => {}); return false; }
  if (!res.ok) throw new Error("firestore");
  return true;
}
export async function listCollection(collection: string, pageSize = 100) {
  const res = await fs(`/${collection}?pageSize=${Math.min(pageSize, 300)}`);
  if (!res.ok) throw new Error("firestore");
  const data = await res.json();
  return (data.documents ?? []).map(fromDoc);
}
export async function writeDocument(path: string, data: Record<string, unknown>, merge = true) {
  const mask = merge ? Object.keys(data).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&") : "";
  const res = await fs(`/${path}${mask ? `?${mask}` : ""}`, {
    method: "PATCH",
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toValue(v)])) }),
  });
  if (!res.ok) throw new Error("firestore");
  return fromDoc(await res.json());
}
export async function createDocument(collection: string, data: Record<string, unknown>, id?: string) {
  const res = await fs(`/${collection}${id ? `?documentId=${encodeURIComponent(id)}` : ""}`, {
    method: "POST",
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toValue(v)])) }),
  });
  if (!res.ok) throw new Error("firestore");
  return fromDoc(await res.json());
}
export async function deleteDocument(path: string) {
  const res = await fs(`/${path}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error("firestore");
}
// deno-lint-ignore no-explicit-any
export async function runQuery(collection: string, opts: { where?: any[]; orderBy?: string; desc?: boolean; limit?: number; select?: string[] } = {}) {
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
export const whereField = (field: string, op: string, value: unknown) => ({ fieldFilter: { field: { fieldPath: field }, op, value: toValue(value) } });
export const sinceTs = (days: number) => ({ __ts: new Date(Date.now() - days * 86400_000).toISOString() });

export async function countQuery(collection: string, where: unknown[] = []) {
  const structuredQuery: Record<string, unknown> = { from: [{ collectionId: collection }] };
  if (where.length) structuredQuery.where = where.length === 1 ? where[0] : { compositeFilter: { op: "AND", filters: where } };
  const res = await fs(`:runAggregationQuery`, { method: "POST", body: JSON.stringify({ structuredAggregationQuery: { structuredQuery, aggregations: [{ count: {}, alias: "n" }] } }) });
  if (!res.ok) throw new Error("firestore");
  const data = await res.json();
  return Number(data?.[0]?.result?.aggregateFields?.n?.integerValue ?? 0);
}