// Permissions an agent API key can be granted. These strings are enforced
// server-side by supabase/functions/agent-api — keep the two lists in sync
// (each scope below is a TOOLS[].scope value there).
export const AGENT_SCOPE_GROUPS = [
  {
    key: "audio", label: "Audio", icon: "🎙️",
    scopes: [
      { id: "audio:read", label: "Read audio", hint: "List and view recordings and AI summaries" },
      { id: "audio:create", label: "Add audio", hint: "Get upload URLs and register new recordings" },
      { id: "audio:edit", label: "Edit audio", hint: "Change title, speaker, type, date" },
      { id: "audio:delete", label: "Delete audio", hint: "Permanently delete recordings and files", danger: true },
    ],
  },
  {
    key: "analytics", label: "Analytics", icon: "📈",
    scopes: [
      { id: "analytics:read", label: "Overview analytics", hint: "Totals: users, audio, listens, activity" },
      { id: "audioAnalytics:read", label: "Audio analytics", hint: "Listens per recording, guests included" },
      { id: "userAnalytics:read", label: "User analytics", hint: "Signups, roles, active users (aggregate)" },
      { id: "users:read", label: "Read user list", hint: "Names and emails of registered users", danger: true },
    ],
  },
  {
    key: "notices", label: "Notices", icon: "📌",
    scopes: [
      { id: "notices:read", label: "Read notices" },
      { id: "notices:edit", label: "Create & edit notices" },
      { id: "notices:delete", label: "Delete notices", danger: true },
    ],
  },
  {
    key: "campaign", label: "Doctrine Campaign", icon: "📖",
    scopes: [
      { id: "campaign:read", label: "Read campaign" },
      { id: "campaign:edit", label: "Modify campaign" },
      { id: "campaign:delete", label: "Delete campaign", danger: true },
    ],
  },
  {
    key: "pages", label: "Page Manager", icon: "🧭",
    scopes: [
      { id: "pages:read", label: "Read page settings" },
      { id: "pages:edit", label: "Manage pages", hint: "Names, visibility, maintenance / coming-soon" },
    ],
  },
  {
    key: "suggestions", label: "Suggestions", icon: "💡",
    scopes: [
      { id: "suggestions:read", label: "Read suggestions" },
      { id: "suggestions:comment", label: "Comment on suggestions" },
      { id: "suggestions:edit", label: "Change suggestion status" },
    ],
  },
  {
    key: "resources", label: "Resources", icon: "📚",
    scopes: [
      { id: "resources:read", label: "Read resources" },
      { id: "resources:edit", label: "Create & edit resources" },
      { id: "resources:delete", label: "Delete resources", danger: true },
    ],
  },
  {
    key: "other", label: "Other", icon: "🧰",
    scopes: [
      { id: "logs:read", label: "Read admin audit log" },
      { id: "settings:read", label: "Read app settings", hint: "Maintenance mode, registration, AI toggles (read-only)" },
    ],
  },
];

export const ALL_SCOPE_IDS = AGENT_SCOPE_GROUPS.flatMap((g) => g.scopes.map((s) => s.id));
export const SCOPE_LABELS = Object.fromEntries(AGENT_SCOPE_GROUPS.flatMap((g) => g.scopes.map((s) => [s.id, s.label])));

export const AGENT_PRESETS = [
  { key: "readonly", label: "Read-only", scopes: ALL_SCOPE_IDS.filter((s) => s.endsWith(":read") && s !== "users:read") },
  { key: "analytics", label: "Analytics only", scopes: ["analytics:read", "audioAnalytics:read", "userAnalytics:read"] },
  { key: "editor", label: "Content editor", scopes: ["audio:read", "audio:create", "audio:edit", "notices:read", "notices:edit", "campaign:read", "campaign:edit", "resources:read", "resources:edit"] },
  { key: "none", label: "Clear all", scopes: [] },
];

export const AGENT_PROVIDERS = ["Claude", "ChatGPT", "Gemini", "Other"];
// Everything that mutates or deletes — used to warn before granting.
export const RISKY_SCOPES = ALL_SCOPE_IDS.filter((s) => /:(create|edit|delete|comment)$/.test(s) || s === "users:read");
