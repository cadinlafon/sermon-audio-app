import { getDocument, nowTs, runQuery, whereField, writeDocument } from "./firestore.ts";
import type { Agent } from "./tools.ts";
import { MCP_RESOURCE } from "./http.ts";

export async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const KEY_RE = /^pfa_[A-Za-z0-9_-]{20,80}$/; // static agent API key (Admin -> AI Agents)
const TOKEN_RE = /^pfo_[A-Za-z0-9_-]{20,80}$/; // OAuth access token issued to a connector (ChatGPT etc.)

// deno-lint-ignore no-explicit-any
function toAgent(doc: any): Agent {
  if (!doc || doc.revoked) throw new Error("unauthorized");
  if (doc.expiresAt && Date.parse(doc.expiresAt as string) < Date.now()) throw new Error("expired");
  void writeDocument(`agentKeys/${doc.id}`, { lastUsedAt: nowTs() }).catch(() => {});
  return { id: doc.id as string, name: (doc.name as string) || "Agent", provider: (doc.provider as string) || "other", scopes: Array.isArray(doc.scopes) ? (doc.scopes as string[]) : [] };
}

// Both credential types resolve to the same agent record, so scopes are always
// read live: revoking or editing an agent in the admin takes effect immediately,
// including for OAuth tokens already handed out.
// `mcp` = this request is for the MCP endpoint. OAuth tokens are bound to that
// resource (RFC 8707 audience), so they are refused everywhere else.
export async function authenticate(r: Request, opts: { mcp?: boolean } = {}): Promise<Agent> {
  const bearer = r.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!bearer) throw new Error("unauthorized");

  if (KEY_RE.test(bearer)) {
    const [doc] = await runQuery("agentKeys", { where: [whereField("keyHash", "EQUAL", await sha256Hex(bearer))], limit: 1 });
    return toAgent(doc);
  }

  if (TOKEN_RE.test(bearer)) {
    if (!opts.mcp) throw new Error("unauthorized"); // OAuth tokens are only valid on /mcp — refuse before any DB read
    const token = await getDocument(`agentOAuthTokens/${await sha256Hex(bearer)}`);
    if (!token || token.kind !== "access" || Date.parse(token.expiresAt as string) < Date.now()) throw new Error("unauthorized");
    // Audience check: minted for the MCP resource, and only usable on it.
    if (!opts.mcp || token.resource !== MCP_RESOURCE()) throw new Error("unauthorized");
    return toAgent(await getDocument(`agentKeys/${token.agentId}`));
  }

  throw new Error("unauthorized");
}
