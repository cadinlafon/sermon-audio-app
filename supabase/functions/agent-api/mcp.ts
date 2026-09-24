// MCP (Model Context Protocol) interface — a thin adapter over the same TOOLS
// registry the REST API uses, so both stay consistent by construction.
//
// Transport: Streamable HTTP via the official SDK, stateless (a fresh server per
// request — Supabase Edge Functions are short-lived and can't hold sessions).
import { McpServer } from "npm:@modelcontextprotocol/sdk@1.25.3/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "npm:@modelcontextprotocol/sdk@1.25.3/server/webStandardStreamableHttp.js";
import { z } from "npm:zod@3.25.76";
import { allowedTools, callTool, toolAnnotations, toolTitle } from "./tools.ts";
import type { Agent, Tool } from "./tools.ts";
import { cors } from "./http.ts";
import { errorInfo } from "./errors.ts";
import { OAUTH_SCOPE } from "./oauth.ts";

// Every tool needs an authenticated caller — there is no anonymous tool.
// ChatGPT reads this per tool (declared both in _meta and, below, at the top
// level of each listed tool).
export const SECURITY_SCHEMES = [{ type: "oauth2", scopes: [OAUTH_SCOPE] }];

export const MCP_SERVER_NAME = "Palouse Fellowship App";
export const MCP_SERVER_VERSION = "1.1.0";

const INSTRUCTIONS =
  "Provides authorized management and read access to the Palouse Fellowship App (sermon/homily/Sunday School audio, notices, the doctrine campaign, page settings, suggestions, resources, and analytics). " +
  "Only the tools this connection has been granted are listed. Changes are recorded in the app's admin audit trail. " +
  "Deleting audio, notices, resources, or the campaign is permanent — confirm with the user before calling a delete tool.";

// Tool inputs are declared once as plain JSON-schema-ish objects (shared with the
// REST/OpenAPI layer); translate them to zod for the SDK's input validation.
// deno-lint-ignore no-explicit-any
function zodFor(p: any): z.ZodTypeAny {
  let s: z.ZodTypeAny;
  if (Array.isArray(p.enum)) s = z.enum(p.enum as [string, ...string[]]);
  else if (p.type === "number") s = z.number();
  else if (p.type === "boolean") s = z.boolean();
  else if (p.type === "array") s = z.array(z.string().max(2000)).max(100);
  else s = z.string().max(5000);
  return p.description ? s.describe(p.description) : s;
}

function shapeFor(tool: Tool) {
  const required = new Set(tool.required ?? []);
  return Object.fromEntries(Object.entries(tool.input).map(([key, p]) => [key, required.has(key) ? zodFor(p) : zodFor(p).optional()]));
}

export function buildMcpServer(agent: Agent) {
  const server = new McpServer({ name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION }, { instructions: INSTRUCTIONS });

  for (const tool of allowedTools(agent)) {
    const shape = shapeFor(tool);
    server.registerTool(
      tool.name,
      {
        title: toolTitle(tool),
        description: tool.description,
        ...(Object.keys(shape).length ? { inputSchema: shape } : {}),
        annotations: toolAnnotations(tool),
        _meta: { securitySchemes: SECURITY_SCHEMES },
      },
      // deno-lint-ignore no-explicit-any
      async (args: any) => {
        try {
          const payload = { success: true, result: await callTool(agent, tool.name, args ?? {}) };
          return { content: [{ type: "text" as const, text: JSON.stringify(payload) }], structuredContent: payload };
        } catch (e) {
          // Only the mapped, safe message ever reaches the model.
          return { isError: true, content: [{ type: "text" as const, text: errorInfo(e).message }] };
        }
      },
    );
  }
  return server;
}

export async function handleMcp(r: Request, agent: Agent): Promise<Response> {
  const server = buildMcpServer(agent);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  const method = await r.clone().json().then((b) => b?.method).catch(() => null);
  const res = await transport.handleRequest(r);
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(cors(r))) headers.set(k, v);

  // Mirror securitySchemes at the top level of each tool descriptor, as
  // OpenAI's tool-security format expects (the SDK only emits _meta).
  if (method === "tools/list" && res.status === 200 && (res.headers.get("content-type") ?? "").includes("application/json")) {
    const payload = await res.json();
    if (Array.isArray(payload?.result?.tools)) {
      payload.result.tools = payload.result.tools.map((t: Record<string, unknown>) => ({ ...t, securitySchemes: SECURITY_SCHEMES }));
    }
    headers.delete("content-length");
    return new Response(JSON.stringify(payload), { status: 200, headers });
  }
  return new Response(res.body, { status: res.status, headers });
}
