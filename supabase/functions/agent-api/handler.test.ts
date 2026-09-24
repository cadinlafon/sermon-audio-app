// Run:  deno test -A supabase/functions/agent-api/handler.test.ts
// (copy the folder outside any package.json project if Deno picks up node_modules)
//
// Firestore, Google's token endpoint, and Firebase's signing keys are faked
// in-process, so this exercises the real routing, auth, scope checks, MCP SDK
// transport, and OAuth flow — not Firebase or Backblaze themselves.
import assert from "node:assert/strict";
import { exportJWK, exportPKCS8, generateKeyPair, SignJWT } from "npm:jose@5.10.0";

const PROJECT = "test-project";
const BASE = "https://ref.supabase.co/functions/v1/agent-api";
const APP = "https://app.example.test";
const CHATGPT_REDIRECT = "https://chatgpt.com/connector/oauth/abc123";

// ---------------------------------------------------------------- fakes -----
const { privateKey: saKey } = await generateKeyPair("RS256", { extractable: true });
const { publicKey: fbPublic, privateKey: fbPrivate } = await generateKeyPair("RS256", { extractable: true });
const fbJwk = { ...(await exportJWK(fbPublic)), kid: "k1", alg: "RS256", use: "sig" };

Deno.env.set("PF_FIREBASE_PROJECT_ID", PROJECT);
Deno.env.set("PF_FIREBASE_SERVICE_ACCOUNT", JSON.stringify({ client_email: "sa@test.iam", private_key: await exportPKCS8(saKey) }));
Deno.env.set("SUPABASE_URL", "https://ref.supabase.co");
Deno.env.set("PF_APP_URL", APP);

// deno-lint-ignore no-explicit-any
type Fields = Record<string, any>;
const store = new Map<string, { fields: Fields; updateTime: number }>();
let clock = 1;
const S = (s: string) => ({ stringValue: s });
const B = (b: boolean) => ({ booleanValue: b });
const A = (...v: string[]) => ({ arrayValue: { values: v.map(S) } });
const T = (iso: string) => ({ timestampValue: iso });
const put = (path: string, fields: Fields) => store.set(path, { fields, updateTime: clock++ });
const docPath = (name: string) => name.split("/documents/")[1];
const asDoc = (path: string) => ({ name: `projects/${PROJECT}/databases/(default)/documents/${path}`, fields: store.get(path)!.fields, updateTime: String(store.get(path)!.updateTime) });
const audit = () => [...store].filter(([p]) => p.startsWith("adminActions/")).map(([, d]) => d.fields);

globalThis.fetch = (input: string | URL | Request, init: RequestInit = {}) => {
  const url = String(input instanceof Request ? input.url : input);
  const method = init.method ?? "GET";
  const res = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

  if (url.startsWith("https://oauth2.googleapis.com/token")) return res({ access_token: "sa-token", expires_in: 3600 });
  if (url.includes("securetoken@system.gserviceaccount.com")) return res({ keys: [fbJwk] });
  if (!url.includes("firestore.googleapis.com")) return res({ error: "unexpected fetch " + url }, 500);

  const rel = url.split("/documents")[1] ?? "";
  if (rel.startsWith(":runQuery")) {
    const q = JSON.parse(String(init.body)).structuredQuery;
    const col = q.from[0].collectionId;
    let rows = [...store].filter(([p]) => p.startsWith(col + "/") && p.split("/").length === 2);
    const f = q.where?.fieldFilter;
    if (f && f.op === "EQUAL") rows = rows.filter(([, d]) => JSON.stringify(d.fields[f.field.fieldPath]) === JSON.stringify(f.value));
    if (q.limit) rows = rows.slice(0, q.limit);
    return res(rows.map(([p]) => ({ document: asDoc(p) })));
  }
  if (rel.startsWith(":runAggregationQuery")) return res([{ result: { aggregateFields: { n: { integerValue: "5" } } } }]);

  const [pathPart, qs = ""] = rel.slice(1).split("?");
  const params = new URLSearchParams(qs);
  if (method === "GET") {
    if (store.has(pathPart)) return res(asDoc(pathPart));
    if (!pathPart.includes("/")) return res({ documents: [...store].filter(([p]) => p.startsWith(pathPart + "/")).map(([p]) => asDoc(p)) });
    return res({ error: { code: 404 } }, 404);
  }
  if (method === "DELETE") { store.delete(pathPart); return res({}); }
  if (method === "PATCH") {
    const pre = params.get("currentDocument.updateTime");
    const cur = store.get(pathPart);
    if (pre !== null && (!cur || String(cur.updateTime) !== pre)) return res({ error: { code: 400, status: "FAILED_PRECONDITION" } }, 400);
    const body = JSON.parse(String(init.body)).fields;
    put(pathPart, { ...(cur?.fields ?? {}), ...body });
    return res(asDoc(pathPart));
  }
  if (method === "POST") {
    const id = params.get("documentId") ?? `gen${clock}`;
    const path = `${pathPart}/${id}`;
    put(path, JSON.parse(String(init.body)).fields);
    return res(asDoc(path));
  }
  return res({}, 500);
};

const { handler } = await import("./handler.ts");

// ------------------------------------------------------------- helpers ------
async function sha256Hex(s: string) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const b64url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const KEY = "pfa_" + "K".repeat(43);
const RO_KEY = "pfa_" + "R".repeat(43);
const REVOKED_KEY = "pfa_" + "X".repeat(43);

async function seed() {
  store.clear();
  put("agentKeys/agent1", { keyHash: S(await sha256Hex(KEY)), name: S("Test Agent"), provider: S("ChatGPT"), revoked: B(false), scopes: A("audio:read", "audio:edit", "audio:delete", "notices:read", "notices:edit", "notices:delete", "analytics:read") });
  put("agentKeys/agent2", { keyHash: S(await sha256Hex(RO_KEY)), name: S("Read Only"), provider: S("Claude"), revoked: B(false), scopes: A("audio:read") });
  put("agentKeys/agent3", { keyHash: S(await sha256Hex(REVOKED_KEY)), name: S("Old"), provider: S("Other"), revoked: B(true), scopes: A("audio:read") });
  put("audio/a1", { title: S("Genesis 1"), speaker: S("Speaker One"), type: S("sermon"), createdAt: T("2026-09-01T00:00:00Z"), audioStorageKey: S("audio/2026/x.mp3") });
  put("notices/n1", { title: S("Old title"), active: B(true) });
  put("users/admin1", { role: S("admin"), email: S("admin@example.com") });
  put("users/restricted1", { role: S("admin"), permissions: { mapValue: { fields: {} } } });
  put("users/plain1", { role: S("user") });
}

const req = (method: string, path: string, opts: { key?: string; body?: unknown; headers?: Record<string, string>; form?: Record<string, string> } = {}) =>
  new Request(BASE + path, {
    method,
    headers: { ...(opts.key ? { authorization: `Bearer ${opts.key}` } : {}), ...(opts.form ? { "content-type": "application/x-www-form-urlencoded" } : opts.body ? { "content-type": "application/json" } : {}), ...opts.headers },
    body: opts.form ? new URLSearchParams(opts.form).toString() : opts.body ? JSON.stringify(opts.body) : undefined,
  });

const MCP_HEADERS = { accept: "application/json, text/event-stream", "content-type": "application/json" };
let rpcId = 1;
async function mcp(key: string | undefined, method: string, params: unknown = {}) {
  const r = await handler(req("POST", "/mcp", { key, headers: MCP_HEADERS, body: { jsonrpc: "2.0", id: rpcId++, method, params } }));
  const text = await r.text();
  return { status: r.status, headers: r.headers, body: text ? JSON.parse(text) : null };
}
const callMcp = (key: string, name: string, args: unknown) => mcp(key, "tools/call", { name, arguments: args });

async function firebaseToken(uid: string) {
  return await new SignJWT({}).setProtectedHeader({ alg: "RS256", kid: "k1" }).setSubject(uid).setAudience(PROJECT).setIssuer(`https://securetoken.google.com/${PROJECT}`).setIssuedAt().setExpirationTime("1h").sign(fbPrivate);
}

// -------------------------------------------------- existing REST / OpenAPI --
Deno.test("REST: openapi.json is public and lists tools with the correct server URL", async () => {
  await seed();
  const r = await handler(req("GET", "/openapi.json"));
  assert.equal(r.status, 200);
  const spec = await r.json();
  assert.equal(spec.openapi, "3.1.0");
  assert.equal(spec.servers[0].url, BASE);
  assert.ok(spec.paths["/tools/list_audio"] && spec.paths["/tools/delete_audio"]);
});

Deno.test("REST: openapi.json with a key only lists that key's tools", async () => {
  await seed();
  const spec = await (await handler(req("GET", "/openapi.json", { key: RO_KEY }))).json();
  assert.deepEqual(Object.keys(spec.paths).sort(), ["/tools/get_audio", "/tools/list_audio"]);
});

Deno.test("REST: missing / invalid / revoked keys are rejected with 401", async () => {
  await seed();
  assert.equal((await handler(req("GET", "/tools"))).status, 401);
  assert.equal((await handler(req("GET", "/tools", { key: "pfa_" + "Z".repeat(43) }))).status, 401);
  assert.equal((await handler(req("GET", "/tools", { key: REVOKED_KEY }))).status, 401);
});

Deno.test("REST: read tool works, forbidden scope is 403, unknown record is 404, bad input is 400", async () => {
  await seed();
  const ok = await handler(req("POST", "/tools/list_audio", { key: KEY, body: {} }));
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).result[0].title, "Genesis 1");
  assert.equal((await handler(req("POST", "/tools/delete_audio", { key: RO_KEY, body: { id: "a1" } }))).status, 403);
  assert.equal((await handler(req("POST", "/tools/get_audio", { key: KEY, body: { id: "nope" } }))).status, 404);
  assert.equal((await handler(req("POST", "/tools/update_notice", { key: KEY, body: { id: "n1" } }))).status, 400);
});

Deno.test("REST: write is applied and recorded in the audit trail; legacy JSON-RPC at / still works", async () => {
  await seed();
  const r = await handler(req("POST", "/tools/update_notice", { key: KEY, body: { id: "n1", title: "New title" } }));
  assert.equal(r.status, 200);
  assert.equal(store.get("notices/n1")!.fields.title.stringValue, "New title");
  assert.equal(audit().length, 1);
  assert.match(audit()[0].adminName.stringValue, /Test Agent/);
  assert.equal(audit()[0].category.stringValue, "agent_action");

  const rpc = await handler(req("POST", "/", { key: KEY, body: { jsonrpc: "2.0", id: 1, method: "tools/list" } }));
  assert.ok((await rpc.json()).result.tools.length > 0);
});

// ------------------------------------------------------------------- MCP ----
Deno.test("MCP: unauthenticated request gets 401 with an OAuth discovery challenge", async () => {
  await seed();
  const r = await mcp(undefined, "initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "1" } });
  assert.equal(r.status, 401);
  assert.match(r.headers.get("www-authenticate") ?? "", /resource_metadata="https:\/\/ref\.supabase\.co\/functions\/v1\/agent-api\/\.well-known\/oauth-protected-resource"/);
  assert.equal((await mcp("pfa_" + "Q".repeat(43), "tools/list")).status, 401);
});

Deno.test("MCP: initialize returns server name, version and instructions", async () => {
  await seed();
  const r = await mcp(KEY, "initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "1" } });
  assert.equal(r.status, 200);
  assert.equal(r.body.result.serverInfo.name, "Palouse Fellowship App");
  assert.ok(r.body.result.serverInfo.version);
  assert.match(r.body.result.instructions, /authorized management and read access/);
  assert.ok(r.body.result.capabilities.tools);
});

Deno.test("MCP: tools/list advertises only granted tools, with titles and correct annotations", async () => {
  await seed();
  const { body } = await mcp(KEY, "tools/list");
  const tools = new Map<string, { title?: string; annotations: Record<string, boolean>; inputSchema: { required?: string[] } }>(body.result.tools.map((t: { name: string }) => [t.name, t]));
  assert.deepEqual([...tools.keys()].sort(), ["delete_audio", "delete_notice", "get_analytics_overview", "get_audio", "list_audio", "list_notices", "create_notice", "update_audio", "update_notice"].sort());
  assert.equal(tools.get("list_audio")!.title, "List Audio");
  assert.equal(tools.get("list_audio")!.annotations.readOnlyHint, true);
  assert.equal(tools.get("update_notice")!.annotations.readOnlyHint, false);
  assert.equal(tools.get("update_notice")!.annotations.destructiveHint, false);
  assert.equal(tools.get("delete_audio")!.annotations.readOnlyHint, false);
  assert.equal(tools.get("delete_audio")!.annotations.destructiveHint, true);
  assert.deepEqual(tools.get("update_notice")!.inputSchema.required, ["id"]);

  const ro = (await mcp(RO_KEY, "tools/list")).body.result.tools.map((t: { name: string }) => t.name).sort();
  assert.deepEqual(ro, ["get_audio", "list_audio"]);
});

Deno.test("MCP: valid read call returns structured output", async () => {
  await seed();
  const { body } = await callMcp(KEY, "get_audio", { id: "a1" });
  assert.notEqual(body.result.isError, true);
  assert.equal(body.result.structuredContent.success, true);
  assert.equal(body.result.structuredContent.result.title, "Genesis 1");
  assert.equal(JSON.parse(body.result.content[0].text).result.speaker, "Speaker One");
});

Deno.test("MCP: invalid input and not-found produce clear errors", async () => {
  await seed();
  const bad = (await callMcp(KEY, "get_audio", { id: 123 })).body;
  assert.ok(bad.error || bad.result?.isError, "invalid type must be rejected");
  const missing = (await callMcp(KEY, "get_audio", {})).body;
  assert.ok(missing.error || missing.result?.isError, "missing required field must be rejected");
  const nf = (await callMcp(KEY, "get_audio", { id: "does-not-exist" })).body;
  assert.equal(nf.result.isError, true);
  assert.match(nf.result.content[0].text, /Record not found/);
  const empty = (await callMcp(KEY, "update_notice", { id: "n1" })).body;
  assert.equal(empty.result.isError, true);
  assert.match(empty.result.content[0].text, /Invalid input/);
});

Deno.test("MCP: a tool outside the key's scopes cannot be called", async () => {
  await seed();
  const { body } = await callMcp(RO_KEY, "delete_audio", { id: "a1" });
  assert.ok(body.error || body.result?.isError);
  assert.ok(store.has("audio/a1"), "nothing was deleted");
});

Deno.test("MCP: write and destructive operations work and are audited", async () => {
  await seed();
  const upd = (await callMcp(KEY, "update_notice", { id: "n1", title: "Via MCP" })).body;
  assert.equal(upd.result.structuredContent.success, true);
  assert.equal(store.get("notices/n1")!.fields.title.stringValue, "Via MCP");

  const del = (await callMcp(KEY, "delete_notice", { id: "n1" })).body;
  assert.equal(del.result.structuredContent.result.deleted, true);
  assert.ok(!store.has("notices/n1"));
  assert.deepEqual(audit().map((a) => a.action.stringValue), ["update_notice", "delete_notice"]);
});

// ----------------------------------------------------------------- OAuth ----
Deno.test("OAuth: discovery documents advertise PKCE S256, DCR and issuer identification", async () => {
  const prm = await (await handler(req("GET", "/.well-known/oauth-protected-resource"))).json();
  assert.equal(prm.resource, `${BASE}/mcp`);
  assert.deepEqual(prm.authorization_servers, [BASE]);
  for (const p of ["/.well-known/oauth-authorization-server", "/.well-known/openid-configuration"]) {
    const md = await (await handler(req("GET", p))).json();
    assert.equal(md.issuer, BASE);
    assert.deepEqual(md.code_challenge_methods_supported, ["S256"]);
    assert.equal(md.registration_endpoint, `${BASE}/oauth/register`);
    assert.equal(md.authorization_response_iss_parameter_supported, true);
  }
});

async function registerClient(redirect = CHATGPT_REDIRECT) {
  const r = await handler(req("POST", "/oauth/register", { body: { client_name: "ChatGPT", redirect_uris: [redirect] } }));
  return { status: r.status, body: await r.json() };
}

Deno.test("OAuth: registration only accepts known connector / loopback redirect URIs", async () => {
  await seed();
  assert.equal((await registerClient("https://evil.example/cb")).status, 400);
  assert.equal((await registerClient("https://chatgpt.com/other")).status, 400);
  assert.equal((await registerClient(CHATGPT_REDIRECT)).status, 201);
  assert.equal((await registerClient("http://localhost:6274/oauth/callback")).status, 201);
});

Deno.test("OAuth: full authorization-code + PKCE flow yields a token that works on /mcp, refresh rotates, revoking the agent kills it", async () => {
  await seed();
  const { body: client } = await registerClient();
  const verifier = "v".repeat(64);
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  const authParams = { client_id: client.client_id, redirect_uri: CHATGPT_REDIRECT, state: "xyz", code_challenge: challenge, code_challenge_method: "S256", response_type: "code", resource: `${BASE}/mcp` };

  // /authorize hands the browser to the web app's consent screen
  const az = await handler(req("GET", "/oauth/authorize?" + new URLSearchParams(authParams)));
  assert.equal(az.status, 302);
  const consent = new URL(az.headers.get("location")!);
  assert.equal(consent.origin + consent.pathname, `${APP}/agent-authorize`);
  assert.equal(consent.searchParams.get("state"), "xyz");

  // Missing PKCE is rejected by redirecting back with an error
  const noPkce = await handler(req("GET", "/oauth/authorize?" + new URLSearchParams({ ...authParams, code_challenge: "" })));
  assert.match(noPkce.headers.get("location") ?? "", /error=invalid_request/);
  // Unknown redirect URI is never redirected to
  assert.equal((await handler(req("GET", "/oauth/authorize?" + new URLSearchParams({ ...authParams, redirect_uri: "https://evil.example/cb" })))).status, 400);

  const approveBody = { client_id: client.client_id, redirect_uri: CHATGPT_REDIRECT, state: "xyz", code_challenge: challenge, agent_id: "agent1" };
  const asUser = (uid: string) => firebaseToken(uid).then((t) => req("POST", "/oauth/approve", { key: t, body: approveBody, headers: { origin: APP } }));

  assert.equal((await handler(req("POST", "/oauth/approve", { body: approveBody, headers: { origin: APP } }))).status, 401);
  assert.equal((await handler(await asUser("plain1"))).status, 403, "non-admin refused");
  assert.equal((await handler(await asUser("restricted1"))).status, 403, "restricted admin refused");
  assert.equal((await handler(req("POST", "/oauth/approve", { key: await firebaseToken("admin1"), body: approveBody, headers: { origin: "https://evil.example" } }))).status, 403, "wrong origin refused");
  assert.equal((await handler(req("POST", "/oauth/approve", { key: await firebaseToken("admin1"), body: { ...approveBody, agent_id: "agent3" }, headers: { origin: APP } }))).status, 400, "revoked agent refused");

  const ap = await handler(await asUser("admin1"));
  assert.equal(ap.status, 200);
  const redirectTo = new URL((await ap.json()).redirectTo);
  assert.equal(redirectTo.origin + redirectTo.pathname, CHATGPT_REDIRECT);
  assert.equal(redirectTo.searchParams.get("state"), "xyz");
  assert.equal(redirectTo.searchParams.get("iss"), BASE);
  const code = redirectTo.searchParams.get("code")!;

  const exchange = (over: Record<string, string> = {}) =>
    handler(req("POST", "/oauth/token", { form: { grant_type: "authorization_code", code, client_id: client.client_id, redirect_uri: CHATGPT_REDIRECT, code_verifier: verifier, ...over } }));

  assert.equal((await exchange({ code_verifier: "w".repeat(64) })).status, 400, "wrong PKCE verifier");
  const tok = await exchange();
  assert.equal(tok.status, 200);
  const tokens = await tok.json();
  assert.match(tokens.access_token, /^pfo_/);
  assert.equal(tokens.token_type, "Bearer");
  assert.equal((await exchange()).status, 400, "code is single-use");

  // Only hashes are stored, never the tokens themselves
  assert.ok(!JSON.stringify([...store]).includes(tokens.access_token));

  // The access token works on /mcp and is limited to the agent's scopes
  const listed = (await mcp(tokens.access_token, "tools/list")).body.result.tools.map((t: { name: string }) => t.name);
  assert.ok(listed.includes("list_audio") && listed.includes("delete_audio") && !listed.includes("create_audio"));
  assert.equal((await callMcp(tokens.access_token, "get_audio", { id: "a1" })).body.result.structuredContent.success, true);

  // Refresh rotates: new pair issued, old refresh token dead
  const refresh = (t: string) => handler(req("POST", "/oauth/token", { form: { grant_type: "refresh_token", refresh_token: t, client_id: client.client_id } }));
  const r1 = await refresh(tokens.refresh_token);
  assert.equal(r1.status, 200);
  const t2 = await r1.json();
  assert.equal((await refresh(tokens.refresh_token)).status, 400, "old refresh token rejected");

  // Revoking the agent in the admin kills every token immediately
  store.get("agentKeys/agent1")!.fields.revoked = B(true);
  assert.equal((await mcp(t2.access_token, "tools/list")).status, 401);
  assert.equal((await refresh(t2.refresh_token)).status, 400);
});

Deno.test("OAuth: denying returns access_denied to the client", async () => {
  await seed();
  const { body: client } = await registerClient();
  const challenge = "c".repeat(43);
  const r = await handler(req("POST", "/oauth/approve", { key: await firebaseToken("admin1"), headers: { origin: APP }, body: { client_id: client.client_id, redirect_uri: CHATGPT_REDIRECT, state: "s", code_challenge: challenge, deny: true } }));
  assert.match((await r.json()).redirectTo, /error=access_denied/);
});

Deno.test("Errors never leak internals", async () => {
  await seed();
  const r = await handler(req("POST", "/tools/get_audio", { key: KEY, body: { id: "does-not-exist" } }));
  const text = await r.text();
  assert.ok(!/stack|at file:|firestore\.googleapis|private_key|Bearer/i.test(text));
});
