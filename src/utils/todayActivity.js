////////////////////////////////////////////////////////////////
// TODAY'S ACTIVITY
//
// Turns today's raw `logs` documents into "who used the app today and
// which pages they visited" for the admin Analytics page. Pure
// functions (no Firebase / React).
////////////////////////////////////////////////////////////////

import { PAGE_REGISTRY } from "../pageRegistry";

const EXTRA_PAGES = {
  "/audio-app": "Audio App",
  "/tv": "TV",
  "/player": "Player",
  "/login": "Log In",
  "/signup": "Sign Up",
  "/account": "Account",
  "/search": "Search",
  "/dev-info": "Dev Info",
  "/admin-access": "Admin Access",
  "/agent-authorize": "Agent Authorize",
};

const PREFIX_PAGES = [
  ["/listen/", "Listening Page"],
  ["/resources/", "Resource"],
  ["/playlists/", "Playlist"],
  ["/transcripts/", "Transcript"],
  ["/admin", "Admin"],
];

const BY_ROUTE = new Map(PAGE_REGISTRY.map((p) => [p.route, p.defaultName]));

export function pageLabel(path) {
  if (typeof path !== "string" || !path) return "Unknown";
  const clean = path.length > 1 ? path.replace(/\/+$/, "") : path;
  if (BY_ROUTE.has(clean)) return BY_ROUTE.get(clean);
  const lower = clean.toLowerCase();
  if (EXTRA_PAGES[lower]) return EXTRA_PAGES[lower];
  for (const [prefix, label] of PREFIX_PAGES) {
    if (lower === prefix.replace(/\/$/, "") || lower.startsWith(prefix.endsWith("/") ? prefix : prefix + "/")) return label;
  }
  return clean;
}

export function startOfToday(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * @param {Array<object>} logs today's log documents
 * @param {Map<string, object>} usersById user documents keyed by uid
 * @returns {{ users: Array<{id: string, name: string, email: string|null, events: number, pages: Array<{label: string, count: number}>}>, anonymous: number }}
 *   users sorted by name; `anonymous` = distinct signed-out visitors.
 */
export function summarizeToday(logs, usersById) {
  const byUser = new Map();
  const anonymous = new Set();

  for (const log of logs) {
    if (!log.userId) {
      const key = log.visitorId || log.sessionId;
      if (key) anonymous.add(key);
      continue;
    }
    let entry = byUser.get(log.userId);
    if (!entry) {
      const u = usersById.get(log.userId) || {};
      const email = u.email || log.email || null;
      entry = {
        id: log.userId,
        name: u.fullName || u.name || log.fullName || email || "Unknown user",
        email,
        events: 0,
        pageCounts: new Map(),
      };
      byUser.set(log.userId, entry);
    }
    entry.events++;
    if (log.event === "page_visit") {
      const label = pageLabel(log.path || log.page);
      entry.pageCounts.set(label, (entry.pageCounts.get(label) || 0) + 1);
    }
  }

  const users = [...byUser.values()]
    .map(({ pageCounts, ...rest }) => ({
      ...rest,
      pages: [...pageCounts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { users, anonymous: anonymous.size };
}
