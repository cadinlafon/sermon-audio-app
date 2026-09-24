# agent-api

Scoped access for external AI agents (ChatGPT, Codex, Claude, scripts) to the Palouse Fellowship App. Four interfaces share one function and one tool registry (`tools.ts`), so they can't drift apart:

| Interface | URL (under `/functions/v1/agent-api`) | Used by |
|---|---|---|
| **MCP** (Streamable HTTP) | `/mcp` | ChatGPT connectors, Codex, Claude Code, MCP Inspector |
| REST | `POST /tools/{name}`, `GET /tools` | scripts, ChatGPT Custom GPT Actions |
| OpenAPI | `GET /openapi.json` (public) | ChatGPT Actions "Import from URL" |
| Legacy JSON-RPC | `POST /` | existing clients (unchanged) |
| OAuth 2.1 | `/oauth/*`, `/.well-known/*` | lets ChatGPT authenticate to `/mcp` |

## What is MCP?

The Model Context Protocol is an open standard that lets an AI app discover and call a server's tools. Here the MCP server (`mcp.ts`, using the official `@modelcontextprotocol/sdk`) is a thin adapter: each granted tool is registered with a title, description, input schema, and read-only/destructive annotations, and its handler calls the *same* `callTool()` the REST API uses. Results come back as `{ "success": true, "result": ... }` in both `content` and `structuredContent`; failures are `isError` results with a short safe message (`Authentication required`, `Unauthorized`, `Record not found`, `Invalid input: …`, `Database error`).

Server name: **Palouse Fellowship App** · version `1.1.0` · stateless (a fresh server per request).

## Endpoint

```
https://kcdntttgpvgzdbnbpzso.supabase.co/functions/v1/agent-api/mcp
```

## Authentication

Every request is authorized server-side against an **agent** created in *Admin → AI Agents* (which requires the Admin PIN/passkey and lets you choose the agent's permissions). Two credential types resolve to that same agent record, so permissions are always read live — revoking or editing an agent takes effect immediately:

1. **Static agent key** (`pfa_…`) as `Authorization: Bearer …` — for Codex, Claude Code, MCP Inspector, scripts.
2. **OAuth access token** (`pfo_…`) — for **ChatGPT**, which does *not* support static API keys and requires OAuth 2.1 (authorization code + PKCE S256, dynamic client registration). Flow:
   1. ChatGPT calls `/mcp`, gets `401` + `WWW-Authenticate: Bearer resource_metadata=…`, reads `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server`, registers itself at `/oauth/register` (redirect URIs are allow-listed: ChatGPT/Claude connector callbacks and `localhost` only).
   2. The browser goes to `/oauth/authorize`, which redirects to the web app's **`/agent-authorize`** screen (Supabase rewrites HTML served from `*.supabase.co` to plain text, so the consent page lives in the web app).
   3. A **full admin** (restricted admins are refused) picks which agent the connector acts as and confirms with the Admin PIN/passkey. The function verifies the admin's Firebase ID token, then issues a one-time code (5 min).
   4. ChatGPT exchanges the code (+ PKCE verifier) at `/oauth/token` for a 1-hour access token and a rotating 30-day refresh token. Only SHA-256 hashes are stored.

An OAuth connection can never do more than its agent's permissions. Tokens, keys, the service account, and Supabase keys are never returned by any endpoint or written to logs.

## ChatGPT/OAuth compliance notes

Checked against OpenAI's MCP auth requirements:

- **Redirect URIs allowlisted for ChatGPT** (exactly these, https only): `https://chatgpt.com/connector_platform_oauth_redirect` (used because the server advertises RFC 9207 issuer identification and returns `iss`) and `https://chatgpt.com/connector/oauth/{callback_id}` (fallback). Anything else is rejected at registration. Loopback (`localhost`/`127.0.0.1`) and Claude's `https://claude.ai|claude.com/api/mcp/auth_callback` are also allowed.
- **Discovery:** `/mcp` answers `401` with `WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource", scope="agent"`. Metadata is served at `…/agent-api/.well-known/oauth-protected-resource`, `…/agent-api/mcp/.well-known/oauth-protected-resource`, `…/agent-api/.well-known/oauth-authorization-server`, and `…/agent-api/.well-known/openid-configuration`. Supabase only routes paths under `/functions/v1/agent-api`, so the root-of-host `/.well-known/…` locations can't be served; the `WWW-Authenticate` header is the documented fallback.
- **Resource / audience:** the `resource` parameter is validated at `/authorize`, `/approve` and `/token`, stored with the code and both tokens, and every `/mcp` request checks the token's resource equals `…/agent-api/mcp`. OAuth tokens are rejected on every other path (REST, JSON-RPC).
- **Per request:** token hash lookup → kind is `access` → not expired → audience matches → agent exists, not revoked, key not expired → that agent's live scopes decide which tools exist/run. Tokens are opaque (no JWT), so "issuer" is implicit: only this function mints and accepts them. A token never grants admin access — it only resolves to an agent record.
- **Per-tool security:** every tool is listed with `securitySchemes: [{"type":"oauth2","scopes":["agent"]}]` (top level and `_meta`); there are no anonymous tools. Read-only/destructive hints are in `annotations`.
- **Storage/logging:** authorization codes, access tokens and refresh tokens are stored only as SHA-256 hashes (tests assert plaintext never appears); the function contains no logging calls.
- **Known limitation:** the Admin PIN/passkey is enforced by the web app (as everywhere in this app), not by the server. The server does require a valid Firebase session of a *full* admin plus a matching `Origin`, but a full admin could call `/oauth/approve` directly and skip the PIN prompt.

## Tools

Exposed only if the agent has the matching permission (`src/config/agentScopes.js` lists them; keep it in sync with `tools.ts`).

| Tool | Kind |
|---|---|
| `list_audio`, `get_audio` | read |
| `request_audio_upload`, `create_audio` | write (adding audio is two steps: get a one-time upload URL, upload the file, then register it) |
| `update_audio` | write |
| `delete_audio` | **destructive** |
| `get_analytics_overview`, `get_audio_analytics`, `get_user_analytics`, `list_users` | read |
| `list_notices` / `create_notice`, `update_notice` / `delete_notice` | read / write / **destructive** |
| `get_campaign` / `update_campaign` / `delete_campaign` | read / write / **destructive** |
| `list_pages` / `update_page` | read / write |
| `list_suggestions` / `comment_on_suggestion`, `set_suggestion_status` | read / write |
| `list_resources` / `create_resource`, `update_resource` / `delete_resource` | read / write / **destructive** |
| `list_admin_actions`, `get_app_settings` | read |

Every write is recorded in the `adminActions` audit trail as category `agent_action`.

Only operations that exist in the app are exposed. There is deliberately no user-access management, no settings writes, and no notice-submission tool.

## Configuration (Supabase secrets — never commit values)

See `.env.example`. New for MCP/OAuth: **`PF_APP_URL`** (the web app origin that hosts `/agent-authorize`, e.g. `https://palousefellowshipsermonapp.web.app`). The rest were already required: `PF_FIREBASE_PROJECT_ID`, `PF_FIREBASE_SERVICE_ACCOUNT`, `PF_BACKBLAZE_BUCKET_ID`, `PF_BACKBLAZE_ADMIN_KEY_ID`, `PF_BACKBLAZE_ADMIN_APPLICATION_KEY`. `SUPABASE_URL` is provided by Supabase.

Also paste the `agentKeys` / `agentOAuth*` blocks from `firestore.rules.adminpermissions` into your Firestore rules so browsers can't read or forge credentials.

## Deploy

```bash
npx supabase secrets set PF_APP_URL="https://palousefellowshipsermonapp.web.app" --project-ref kcdntttgpvgzdbnbpzso
npx supabase functions deploy agent-api --project-ref kcdntttgpvgzdbnbpzso --no-verify-jwt
npm run build && npx firebase deploy --only hosting   # ships the /agent-authorize screen
```

`--no-verify-jwt` is required: this function does its own authentication (Firebase-based, not Supabase JWTs).

## Test

Tests use Deno and fake Firestore/Google in-process (17 tests: MCP initialize/discovery/calls, invalid input, unauthorized, not-found, read/write/destructive, REST + OpenAPI + legacy JSON-RPC, and the full OAuth + PKCE flow including revocation):

```bash
# Deno may pick up the project's node_modules; copy the folder somewhere clean if so
cp -r supabase/functions/agent-api /tmp/agent-api-test && cd /tmp/agent-api-test
deno test -A handler.test.ts
```

Try it interactively with the official MCP Inspector against a running function (`npx supabase functions serve agent-api` needs Docker, or deploy):

```bash
npx @modelcontextprotocol/inspector --cli https://<ref>.supabase.co/functions/v1/agent-api/mcp \
  --transport http --header "Authorization: Bearer $AGENT_KEY" --method tools/list
```

## Connect ChatGPT

1. In *Admin → AI Agents*, create an agent (e.g. "ChatGPT") with the permissions you want.
2. ChatGPT → Settings → Connectors (enable Developer mode if needed) → add a custom connector:
   URL `…/functions/v1/agent-api/mcp`, Authentication **OAuth**.
3. ChatGPT opens the consent screen in the app: sign in as a full admin, choose the agent, confirm the PIN, **Allow**.

(Alternative without MCP: a Custom GPT with Actions — import `…/agent-api/openapi.json`, Authentication → API Key → Bearer, paste the agent key.)

## Connect Codex

```toml
# ~/.codex/config.toml
[mcp_servers.palouse]
url = "https://kcdntttgpvgzdbnbpzso.supabase.co/functions/v1/agent-api/mcp"
bearer_token_env_var = "PALOUSE_AGENT_KEY"
```
```bash
export PALOUSE_AGENT_KEY="pfa_…"   # from Admin → AI Agents (shown once)
```

## Security notes

- Scopes are enforced here, server-side; nothing depends on model instructions.
- Keys and tokens are stored hashed; keys are shown once; rotate/revoke in the admin.
- Deleting audio, notices, resources, or the campaign is permanent — grant delete permissions sparingly.
- `list_users` returns names and emails; grant it only when needed.
- Expired OAuth token/code documents are rejected but not auto-deleted (no scheduled job in this app); prune `agentOAuthTokens`/`agentOAuthCodes` occasionally.
- Client registration is unauthenticated by design (OAuth DCR) but limited to allow-listed callback URLs and rate-limited per instance.
