export const cors = (r: Request) => ({
  "Access-Control-Allow-Origin": r.headers.get("origin") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, mcp-protocol-version, mcp-session-id",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  Vary: "Origin",
});
export const json = (r: Request, body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(r), "Content-Type": "application/json", ...extra } });
