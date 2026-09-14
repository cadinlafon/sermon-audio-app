// Every real routed admin page gets one entry here. Keys are camelCase
// (not the raw hyphenated route segment) because a hyphen in a key breaks
// dotted Firestore field-update paths like "permissions.send-notifications.view".
// `actions` lists only the capabilities that page actually has — a
// view-only page like Dashboard has no Edit/Delete checkbox to show.
export const ADMIN_MODULES = [
  { key: "dashboard", path: "dashboard", label: "Dashboard", icon: "📊", actions: ["view"] },
  { key: "upload", path: "upload", label: "Upload Audio", icon: "🎙️", actions: ["view", "edit"] },
  { key: "content", path: "content", label: "Content Manager", icon: "📂", actions: ["view", "edit", "delete"] },
  { key: "users", path: "users", label: "Users", icon: "👥", actions: ["view", "edit", "delete"] },
  { key: "analytics", path: "analytics", label: "Analytics", icon: "📈", actions: ["view"] },
  { key: "notifications", path: "notifications", label: "Notifications", icon: "🔔", actions: ["view"] },
  { key: "sendNotifications", path: "send-notifications", label: "Send Push", icon: "📣", actions: ["view", "edit"] },
  { key: "notices", path: "notices", label: "Notices", icon: "📌", actions: ["view", "edit", "delete"] },
  { key: "doctrine", path: "doctrine", label: "Doctrine Campaign", icon: "📖", actions: ["view", "edit"] },
  { key: "resources", path: "resources", label: "Resources", icon: "📚", actions: ["view", "edit", "delete"] },
  { key: "pageManager", path: "pagemanager", label: "Page Manager", icon: "🧭", actions: ["view", "edit"] },
  { key: "pageNotices", path: "pagenotices", label: "Page Notices", icon: "📄", actions: ["view", "edit", "delete"] },
  { key: "suggestions", path: "suggestions", label: "Suggestions", icon: "💡", actions: ["view", "edit", "delete"] },
  { key: "logs", path: "logs", label: "Logs", icon: "📋", actions: ["view"] },
  { key: "referrals", path: "referrals", label: "Referrals", icon: "📣", actions: ["view", "edit", "delete"] },
  { key: "settings", path: "settings", label: "Settings", icon: "⚙️", actions: ["view", "edit"] },
];

export const ADMIN_MODULE_MAP = Object.fromEntries(ADMIN_MODULES.map((m) => [m.key, m]));

// Starting point for a brand-new restricted admin, and the merge base when
// pre-filling an existing one — any module added to the config later than
// a stored permissions object comes through unchecked instead of undefined.
export function blankPermissions() {
  return Object.fromEntries(
    ADMIN_MODULES.map((m) => [m.key, { view: false, edit: false, delete: false }])
  );
}

export const NO_ACCESS_MESSAGE = "Sorry, this is private. You don't have access.";
