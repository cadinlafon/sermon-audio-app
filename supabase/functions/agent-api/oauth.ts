// OAuth 2.1 (authorization code + PKCE S256, dynamic client registration) so
// ChatGPT — which can't send static API keys — can connect to /mcp.
//
// How it fits this app:
//   • The person authorizing is a FULL admin signed into the web app. The
//     consent screen lives in the web app (/agent-authorize), because
//     Supabase rewrites HTML served from *.supabase.co to text/plain.
//   • What gets authorized is an existing agent record from Admin → AI Agents
//     (created with the Admin PIN), so an OAuth connection can never do more
//     than that agent's permissions — and revoking the agent revokes it.
//   • Access tokens are opaque, stored only as SHA-256 hashes, and resolve live
//     to the agent record on every request.
import { jwtVerify, createRemoteJWKSet } from "npm:jose@5.10.0";
import { createDocument, deleteDocument, getDocument, getDocumentWithVersion, projectId, writeIfUnchanged, nowTs } from "./firestore.ts";
import { sha256Hex } from "./auth.ts";

const APP_URL = () => (Deno.env.get("PF_APP_URL") ?? "").replace(/\/+$/, "");
const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));

const ACCESS_TTL_S = 60 * 60; // 1 hour
const REFRESH_TTL_S = 30 * 24 * 60 * 60; // 30 days
const CODE_TTL_S = 5 * 60;
export const OAUTH_SCOPE = "agent";

export const publicBase = () => `${Deno.env.get("SUPABASE_URL") ?? ""}/functions/v1/agent-api`;

const randomToken = (prefix: string) => `${prefix}${btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
const b64url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// Only known connector callbacks and loopback (CLI tools / MCP Inspector) may
// receive an authorization code — never an arbitrary URL.
export function redirectAllowed(uri: string) {
  let u: URL;
  try { u = new URL(uri); } catch { return false; }
  if (u.hash) return false;
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  if (loopback) return u.protocol === "http:" || u.protocol === "https:";
  if (u.protocol !== "https:") return false;
  if (u.host === "chatgpt.com") return /^\/connector\/oauth\/[A-Za-z0-9_-]+$/.test(u.pathname) || u.pathname === "/connector_platform_oauth_redirect";
  if (u.host === "claude.ai" || u.host === "claude.com") return u.pathname === "/api/mcp/auth_callback";
  return false;
}

const noStore = { "Cache-Control": "no-store", Pragma: "no-cache" };
const j = (body: unknown, status = 200, extra: Record<string, string> = {}, origin?: string) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...noStore, ...(origin ? corsFor(origin) : {}), ...extra } });
const corsFor = (origin: string) => ({ "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", Vary: "Origin" });
const oerr = (error: string, description: string, status = 400) => j({ error, error_description: description }, status);

function redirectWith(redirectUri: string, params: Record<string, string | undefined>) {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) u.searchParams.set(k, v);
  return u.toString();
}

// ---- rate limit for the unauthenticated registration endpoint -------------
let regWindowStart = 0; let regCount = 0;
function registrationAllowed() {
  const now = Date.now();
  if (now - regWindowStart > 10 * 60_000) { regWindowStart = now; regCount = 0; }
  return ++regCount <= 30;
}

async function loadClient(clientId: unknown) {
  if (typeof clientId !== "string" || !/^pfc_[A-Za-z0-9_-]{10,60}$/.test(clientId)) return null;
  const c = await getDocument(`agentOAuthClients/${clientId}`);
  return c ? { id: clientId, name: (c.clientName as string) || "AI connector", redirectUris: (c.redirectUris as string[]) ?? [] } : null;
}

// ---- metadata -------------------------------------------------------------
function protectedResourceMetadata() {
  const base = publicBase();
  return { resource: `${base}/mcp`, authorization_servers: [base], scopes_supported: [OAUTH_SCOPE], bearer_methods_supported: ["header"], resource_name: "Palouse Fellowship App" };
}
function authorizationServerMetadata() {
  const base = publicBase();
  return {
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [OAUTH_SCOPE],
    authorization_response_iss_parameter_supported: true,
  };
}

// ---- endpoints ------------------------------------------------------------
async function register(r: Request) {
  if (!registrationAllowed()) return oerr("temporarily_unavailable", "Too many registrations. Try again later.", 429);
  const body = await r.json().catch(() => null);
  const uris: unknown = body?.redirect_uris;
  if (!Array.isArray(uris) || uris.length < 1 || uris.length > 5 || !uris.every((u) => typeof u === "string" && redirectAllowed(u))) {
    return oerr("invalid_redirect_uri", "redirect_uris must be 1-5 allowed connector or loopback callback URLs.");
  }
  const id = randomToken("pfc_").slice(0, 44);
  const name = typeof body?.client_name === "string" ? body.client_name.slice(0, 80) : "AI connector";
  await createDocument("agentOAuthClients", { redirectUris: uris, clientName: name, createdAt: nowTs() }, id);
  return j({ client_id: id, client_name: name, redirect_uris: uris, grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none", client_id_issued_at: Math.floor(Date.now() / 1000) }, 201);
}

async function authorize(url: URL) {
  const q = url.searchParams;
  const client = await loadClient(q.get("client_id"));
  const redirectUri = q.get("redirect_uri") ?? "";
  // Never redirect to an unverified URI — show a plain error instead.
  if (!client || !client.redirectUris.includes(redirectUri)) return oerr("invalid_request", "Unknown client or redirect_uri.");
  const state = q.get("state") ?? undefined;
  const fail = (error: string, description: string) => new Response(null, { status: 302, headers: { Location: redirectWith(redirectUri, { error, error_description: description, state, iss: publicBase() }) } });

  if (q.get("response_type") !== "code") return fail("unsupported_response_type", "Only response_type=code is supported.");
  if (q.get("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43,128}$/.test(q.get("code_challenge") ?? "")) return fail("invalid_request", "PKCE with code_challenge_method=S256 is required.");
  const resource = q.get("resource");
  if (resource && resource !== `${publicBase()}/mcp`) return fail("invalid_target", "Unknown resource.");
  if (!APP_URL()) return fail("server_error", "Authorization isn't configured on the server (PF_APP_URL).");

  const to = new URL(`${APP_URL()}/agent-authorize`);
  for (const k of ["client_id", "redirect_uri", "state", "code_challenge", "resource"]) if (q.get(k)) to.searchParams.set(k, q.get(k)!);
  return new Response(null, { status: 302, headers: { Location: to.toString(), ...noStore } });
}

// Called by the web app's consent screen with the signed-in admin's Firebase ID token.
async function approve(r: Request) {
  const origin = APP_URL();
  if (!origin || r.headers.get("origin") !== origin) return j({ error: "forbidden" }, 403);
  const respond = (body: unknown, status = 200) => j(body, status, {}, origin);

  const token = r.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || !projectId) return respond({ error: "Please sign in." }, 401);
  let uid: string;
  try {
    const { payload } = await jwtVerify(token, jwks, { audience: projectId, issuer: `https://securetoken.google.com/${projectId}` });
    uid = String(payload.sub);
  } catch { return respond({ error: "Please sign in." }, 401); }

  // Only a FULL admin (role admin, no restricted-permissions map) may grant agent access.
  const user = await getDocument(`users/${uid}`);
  if (!user || user.role !== "admin" || user.permissions) return respond({ error: "Full admin access required." }, 403);

  const body = await r.json().catch(() => null);
  const client = await loadClient(body?.client_id);
  if (!client || !client.redirectUris.includes(body?.redirect_uri)) return respond({ error: "Unknown client or redirect_uri." }, 400);
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(body?.code_challenge ?? "")) return respond({ error: "Missing PKCE challenge." }, 400);
  const state = typeof body?.state === "string" ? body.state : undefined;

  if (body.deny) return respond({ redirectTo: redirectWith(body.redirect_uri, { error: "access_denied", error_description: "The user denied the request.", state, iss: publicBase() }) });

  const agent = typeof body?.agent_id === "string" ? await getDocument(`agentKeys/${body.agent_id}`) : null;
  if (!agent || agent.revoked) return respond({ error: "Choose an active agent." }, 400);

  const code = randomToken("pfk_");
  await createDocument("agentOAuthCodes", {
    clientId: client.id, redirectUri: body.redirect_uri, codeChallenge: body.code_challenge, agentId: body.agent_id, approvedBy: uid, used: false,
    expiresAt: { __ts: new Date(Date.now() + CODE_TTL_S * 1000).toISOString() },
  }, await sha256Hex(code));
  return respond({ redirectTo: redirectWith(body.redirect_uri, { code, state, iss: publicBase() }), agentName: agent.name });
}

async function issueTokens(agentId: string, clientId: string) {
  const access = randomToken("pfo_"); const refresh = randomToken("pfr_");
  const exp = (s: number) => ({ __ts: new Date(Date.now() + s * 1000).toISOString() });
  await createDocument("agentOAuthTokens", { kind: "access", agentId, clientId, expiresAt: exp(ACCESS_TTL_S) }, await sha256Hex(access));
  await createDocument("agentOAuthTokens", { kind: "refresh", agentId, clientId, expiresAt: exp(REFRESH_TTL_S) }, await sha256Hex(refresh));
  return j({ access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL_S, refresh_token: refresh, scope: OAUTH_SCOPE });
}

async function token(r: Request) {
  const ct = r.headers.get("content-type") ?? "";
  const p: Record<string, string> = ct.includes("json") ? await r.json().catch(() => ({})) : Object.fromEntries(new URLSearchParams(await r.text()));
  const client = await loadClient(p.client_id);
  if (!client) return oerr("invalid_client", "Unknown client.", 401);

  if (p.grant_type === "authorization_code") {
    if (!/^pfk_[A-Za-z0-9_-]{20,80}$/.test(p.code ?? "") || !p.code_verifier) return oerr("invalid_request", "code and code_verifier are required.");
    const path = `agentOAuthCodes/${await sha256Hex(p.code)}`;
    const found = await getDocumentWithVersion(path);
    if (!found || found.doc.used) return oerr("invalid_grant", "Invalid or already-used authorization code.");
    const c = found.doc;
    if (Date.parse(c.expiresAt as string) < Date.now() || c.clientId !== client.id || c.redirectUri !== p.redirect_uri) return oerr("invalid_grant", "Authorization code is expired or doesn't match.");
    if (b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(p.code_verifier))) !== c.codeChallenge) return oerr("invalid_grant", "PKCE verification failed.");
    // Single use: the write only succeeds if nobody consumed the code since we read it.
    if (!(await writeIfUnchanged(path, { used: true }, found.updateTime))) return oerr("invalid_grant", "Invalid or already-used authorization code.");
    const agent = await getDocument(`agentKeys/${c.agentId}`);
    if (!agent || agent.revoked) return oerr("invalid_grant", "The authorized agent is no longer active.");
    return issueTokens(c.agentId as string, client.id);
  }

  if (p.grant_type === "refresh_token") {
    const path = `agentOAuthTokens/${await sha256Hex(p.refresh_token ?? "")}`;
    const t = /^pfr_[A-Za-z0-9_-]{20,80}$/.test(p.refresh_token ?? "") ? await getDocument(path) : null;
    if (!t || t.kind !== "refresh" || t.clientId !== client.id || Date.parse(t.expiresAt as string) < Date.now()) return oerr("invalid_grant", "Invalid or expired refresh token.");
    const agent = await getDocument(`agentKeys/${t.agentId}`);
    if (!agent || agent.revoked) return oerr("invalid_grant", "The authorized agent is no longer active.");
    await deleteDocument(path); // rotate: each refresh token works once
    return issueTokens(t.agentId as string, client.id);
  }

  return oerr("unsupported_grant_type", "Supported grants: authorization_code, refresh_token.");
}

// Returns a Response if this path belongs to the OAuth layer, otherwise null.
export async function handleOAuth(r: Request, path: string): Promise<Response | null> {
  const isWellKnown = path.startsWith("/.well-known/");
  const isOauth = path.startsWith("/oauth/");
  if (!isWellKnown && !isOauth) return null;

  if (r.method === "OPTIONS" && path === "/oauth/approve") return new Response("ok", { headers: corsFor(APP_URL()) });

  if (r.method === "GET" && path.startsWith("/.well-known/oauth-protected-resource")) return j(protectedResourceMetadata());
  if (r.method === "GET" && (path.startsWith("/.well-known/oauth-authorization-server") || path.startsWith("/.well-known/openid-configuration"))) return j(authorizationServerMetadata());
  if (r.method === "POST" && path === "/oauth/register") return await register(r);
  if (r.method === "GET" && path === "/oauth/authorize") return await authorize(new URL(r.url));
  if (r.method === "POST" && path === "/oauth/token") return await token(r);
  if (r.method === "POST" && path === "/oauth/approve") return await approve(r);
  if (r.method === "GET" && path === "/oauth/client") {
    const origin = APP_URL();
    const c = await loadClient(new URL(r.url).searchParams.get("client_id"));
    return c ? j({ name: c.name }, 200, {}, origin) : j({ error: "Unknown client." }, 404, {}, origin);
  }
  return j({ error: "Not found." }, 404);
}
