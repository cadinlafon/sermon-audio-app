// Maps internal error codes to safe, model-readable messages. Never includes
// stack traces, secrets, or infrastructure details.
export function errorInfo(e: unknown) {
  const m = e instanceof Error ? e.message : "";
  if (m === "unauthorized") return { status: 401, message: "Authentication required: invalid or missing agent API key or access token." };
  if (m === "expired") return { status: 401, message: "This agent API key has expired." };
  if (m.startsWith("forbidden:")) return { status: 403, message: `Unauthorized: this key doesn't have the "${m.slice(10)}" permission.` };
  if (m === "unknown_tool") return { status: 404, message: "Operation not supported: unknown tool." };
  if (m === "not_found") return { status: 404, message: "Record not found." };
  if (m.startsWith("bad_request:")) return { status: 400, message: `Invalid input: ${m.slice(12)}` };
  if (m === "unconfigured") return { status: 503, message: "The agent API isn't configured on the server yet (missing service account)." };
  if (m.startsWith("storage")) return { status: 503, message: "File storage is unavailable or not configured." };
  if (m === "firestore") return { status: 502, message: "Database error. Please try again." };
  return { status: 500, message: "Something went wrong." };
}
