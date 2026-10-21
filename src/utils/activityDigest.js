////////////////////////////////////////////////////////////////
// ACTIVITY DIGEST — what happened in the app over a period.
//
// Boils raw log / listen / user documents down to a small, structured
// summary the admin Analytics "AI Summary" sends to the AI. Pure
// functions (no Firebase / React). Only first names / full names are
// included — never emails, IDs, or device details.
////////////////////////////////////////////////////////////////

import { pageLabel } from "./todayActivity";

const MAX_USERS = 40;
const MAX_ITEMS_PER_USER = 15;

// Plain-English action for each logged event. Events not listed here (and
// not in SKIP) are ignored — they're technical noise.
const EVENT_ACTIONS = {
  user_login: "signed in",
  google_login: "signed in with Google",
  logout: "signed out",
  account_created: "created an account",
  account_created_google: "created an account with Google",
  continue_listening_resume: "resumed a sermon from Continue Listening",
  notice_view: "viewed a notice",
  notice_click: "clicked a notice",
  pwa_installed: "installed the app to their home screen",
  pwa_installed_ios: "installed the app to their home screen",
  create_account_popup_create_clicked: "clicked Create Account on the sign-up popup",
  create_account_popup_not_now: "dismissed the sign-up popup",
};

export function periodStart(period, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "week") start.setDate(start.getDate() - start.getDay());
  return start;
}

function toDate(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  if (value.seconds) return new Date(value.seconds * 1000);
  return null;
}

function bump(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function topEntries(map, limit) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, limit)
    .map(([name, count]) => (count > 1 ? `${name} (x${count})` : name));
}

/**
 * @param {object} input
 * @param {Array<object>} input.logs     log documents in the period
 * @param {Array<object>} input.listens  appUsage documents in the period ({sermonId,userId,createdAt})
 * @param {Array<object>} input.users    ALL user documents, each with `id`
 * @param {Array<object>} input.audio    ALL audio documents, each with `id`
 * @param {Date} input.start             start of the period
 */
export function buildActivityDigest({ logs, listens, users, audio, start }) {
  const usersById = new Map(users.map((u) => [u.id, u]));
  const titleById = new Map(audio.map((a) => [a.id, a.title || "Untitled"]));
  const nameOf = (id) => {
    const u = usersById.get(id);
    return u?.fullName || u?.name || "A user";
  };

  const signedUp = users
    .filter((u) => {
      const d = toDate(u.createdAt);
      return d && d >= start;
    })
    .map((u) => u.fullName || u.name || "A new user");

  const perUser = new Map();
  const entry = (id) => {
    if (!perUser.has(id)) perUser.set(id, { name: nameOf(id), pages: new Map(), sermons: new Map(), actions: new Map() });
    return perUser.get(id);
  };

  let guestVisitors = new Set();
  let guestListens = 0;

  for (const log of logs) {
    if (!log.userId) {
      const key = log.visitorId || log.sessionId;
      if (key) guestVisitors.add(key);
      continue;
    }
    const e = entry(log.userId);
    if (log.event === "page_visit") {
      bump(e.pages, pageLabel(log.path || log.page));
    } else if (EVENT_ACTIONS[log.event]) {
      bump(e.actions, EVENT_ACTIONS[log.event]);
    }
  }

  for (const l of listens) {
    const title = titleById.get(l.sermonId) || "an audio recording";
    if (!l.userId) { guestListens++; continue; }
    bump(entry(l.userId).sermons, title);
  }

  const userList = [...perUser.values()]
    .map((u) => ({
      name: u.name,
      played: topEntries(u.sermons, MAX_ITEMS_PER_USER),
      pagesVisited: topEntries(u.pages, MAX_ITEMS_PER_USER),
      otherActions: topEntries(u.actions, MAX_ITEMS_PER_USER),
      weight: u.sermons.size * 3 + u.pages.size + u.actions.size,
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_USERS)
    .map(({ weight, ...rest }) => rest);

  const sermonTotals = new Map();
  for (const l of listens) bump(sermonTotals, titleById.get(l.sermonId) || "an audio recording");

  return {
    newUsers: signedUp,
    activeUsers: userList,
    signedOutVisitors: guestVisitors.size,
    signedOutPlays: guestListens,
    totalPlays: listens.length,
    mostPlayed: topEntries(sermonTotals, 5),
  };
}
