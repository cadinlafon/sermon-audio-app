// Agent API entrypoint — all logic lives in handler.ts so tests can import it.
// See README.md for the REST, MCP, and OAuth interfaces.
import { handler } from "./handler.ts";

Deno.serve(handler);
