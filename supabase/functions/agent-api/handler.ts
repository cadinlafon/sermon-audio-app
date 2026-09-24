// Request router for the Agent API. Four interfaces share one function:
//   REST  /tools/{name}, /openapi.json   — existing, unchanged
//   MCP   /mcp                           — Streamable HTTP via the official SDK
//   MCP   POST /  (legacy JSON-RPC)      — existing, unchanged
//   OAuth /oauth/*, /.well-known/*       — lets ChatGPT connect to /mcp
import { allowedTools, callTool, TOOLS } from "./tools.ts";
import type { Agent, Tool } from "./tools.ts";
import { authenticate } from "./auth.ts";
import { cors, json } from "./http.ts";
import { errorInfo } from "./errors.ts";
import { handleMcp } from "./mcp.ts";
import { handleOAuth, publicBase } from "./oauth.ts";

const inputSchema = (t: Tool) => ({ type: "object", properties: t.input, ...(t.required?.length ? { required: t.required } : {}) });

function openApi(r: Request, agent: Agent) {
  // Inside Supabase the request URL is an internal http:// path, so build the public one.
  const root = publicBase();
  const paths: Record<string, unknown> = {};
  for (const t of allowedTools(agent)) {
    paths[`/tools/${t.name}`] = { post: { operationId: t.name, summary: t.description.slice(0, 120), description: t.description, requestBody: { required: !!t.required?.length, content: { "application/json": { schema: inputSchema(t) } } }, responses: { "200": { description: "Result", content: { "application/json": { schema: { type: "object" } } } } } } };
  }
  return { openapi: "3.1.0", info: { title: "App Agent API", version: "1.0.0", description: `Tools available to the "${agent.name}" key.` }, servers: [{ url: root }], components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } } }, security: [{ bearerAuth: [] }], paths };
}


export async function handler(r: Request): Promise<Response> {
  const url = new URL(r.url);
  const path = url.pathname.replace(/^\/functions\/v1\/agent-api/, "").replace(/^\/agent-api/, "") || "/";

  try {
    // OAuth + discovery documents are public by design (and own their CORS).
    const oauth = await handleOAuth(r, path);
    if (oauth) return oauth;

    if (r.method === "OPTIONS") return new Response("ok", { headers: cors(r) });

    // The schema only describes tool names/parameters (no data), and ChatGPT's
    // "Import from URL" fetches it without credentials — so serve the full spec
    // publicly. Calls are still authenticated and scope-checked per key.
    if (r.method === "GET" && path === "/openapi.json") {
      const agent = await authenticate(r).catch(() => null);
      return json(r, openApi(r, agent ?? { id: "public", name: "Your agent", provider: "other", scopes: TOOLS.map((t) => t.scope) }));
    }

    // MCP endpoint. A missing/invalid credential gets the standard 401 challenge
    // pointing at the protected-resource metadata, which starts ChatGPT's OAuth flow.
    if (path === "/mcp") {
      let agent: Agent;
      try {
        agent = await authenticate(r);
      } catch (e) {
        const { status, message } = errorInfo(e);
        return json(r, { error: message }, status, { "WWW-Authenticate": `Bearer resource_metadata="${publicBase()}/.well-known/oauth-protected-resource"` });
      }
      return await handleMcp(r, agent);
    }

    const agent = await authenticate(r);

    if (r.method === "GET" && (path === "/" || path === "/tools")) return json(r, { agent: { name: agent.name, provider: agent.provider, scopes: agent.scopes }, tools: allowedTools(agent).map((t) => ({ name: t.name, description: t.description, inputSchema: inputSchema(t) })) });

    if (r.method === "POST" && path.startsWith("/tools/")) {
      const args = await r.json().catch(() => ({}));
      return json(r, { result: await callTool(agent, decodeURIComponent(path.slice(7)), args) });
    }

    // Legacy MCP-style JSON-RPC at the root (kept for existing clients).
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
}
