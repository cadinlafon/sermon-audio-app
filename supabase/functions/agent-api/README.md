# agent-api

Scoped API for external AI agents (Claude, ChatGPT, scripts). Keys are created in **Admin → AI Agents** (Admin PIN/passkey required every time); only a SHA-256 hash is stored.

Protocols on one URL (`/functions/v1/agent-api`):

| Use | Request |
|---|---|
| MCP (Claude etc.) | `POST /` JSON-RPC: `initialize`, `tools/list`, `tools/call` |
| ChatGPT Actions | `GET /openapi.json` (public, lists all tools), then `POST /tools/{name}` with the key |
| Plain HTTP | `POST /tools/{name}` with JSON body |
| Discovery | `GET /` (lists the tools this key may use) |

All requests need `Authorization: Bearer pfa_...`. A key only sees/executes tools whose scope it was granted (see `TOOLS` in `index.ts` and `src/config/agentScopes.js` — keep both in sync). Every write is recorded in `adminActions` as category `agent_action`.

## Setup

Unlike the other functions, this one needs a Firebase **service account** (agents have no signed-in user, so it can't borrow one's token).

1. Firebase console → Project settings → Service accounts → *Generate new private key* (JSON). Treat it like a password.
2. Set secrets (the file is a secret — don't commit it):

```bash
npx supabase secrets set PF_FIREBASE_SERVICE_ACCOUNT="$(cat service-account.json)" --project-ref <ref>
# already set for other functions, needed here too:
#   PF_FIREBASE_PROJECT_ID, PF_BACKBLAZE_BUCKET_ID,
#   PF_BACKBLAZE_ADMIN_KEY_ID, PF_BACKBLAZE_ADMIN_APPLICATION_KEY
```

3. Deploy:

```bash
npx supabase functions deploy agent-api --project-ref <ref> --no-verify-jwt
```

4. Add the `agentKeys` rules block from `firestore.rules.adminpermissions` in the Firebase console.

## Tools

audio: `list_audio` `get_audio` `request_audio_upload` `create_audio` `update_audio` `delete_audio` ·
analytics: `get_analytics_overview` `get_audio_analytics` `get_user_analytics` `list_users` ·
notices: `list_notices` `create_notice` `update_notice` `delete_notice` ·
campaign: `get_campaign` `update_campaign` `delete_campaign` ·
pages: `list_pages` `update_page` ·
suggestions: `list_suggestions` `comment_on_suggestion` `set_suggestion_status` ·
resources: `list_resources` `create_resource` `update_resource` `delete_resource` ·
other: `list_admin_actions` `get_app_settings`

Adding audio is two steps: `request_audio_upload` returns a one-time Backblaze upload URL; the agent uploads the file there, then calls `create_audio` with the returned `storageKey`.
