import { NOTICE_TYPES } from "../data/audioPageDefaults";

////////////////////////////////////////////////////////////////
// PAGE NOTICES — messages shown on the audio pages. Managed in Admin → Audio
// Page Manager → Notices; stored in the pageNotices collection:
//   title, message, enabled
//   page         "sermons" | "sundayschool" | "all"
//   placement    "pageTop" | "aboveFilters" | "aboveList" | "belowList"
//                (older notices have `position` "top"/"bottom" instead)
//   type         "info" | "warning" | "announcement" | "important"
//   startDate / endDate   "YYYY-MM-DD", both optional (inclusive)
//   linkUrl / linkText    optional button (https://… or an in-app /path)
//   dismissible  people can close it (remembered on their device)
//   categories   [] = all, or ["sermon","homily","sundayschool"] subset
////////////////////////////////////////////////////////////////

export const todayString = (now = new Date()) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
};

export function noticePlacement(n) {
  if (["pageTop", "aboveFilters", "aboveList", "belowList"].includes(n.placement)) return n.placement;
  return n.position === "bottom" ? "belowList" : "aboveList"; // older notices
}

export function noticeType(n) {
  return NOTICE_TYPES.find((t) => t.id === n.type) || NOTICE_TYPES[0];
}

// "scheduled" | "active" | "expired" | "disabled" — what the admin list shows.
export function noticeStatus(n, now = new Date()) {
  if (!n.enabled) return "disabled";
  const today = todayString(now);
  if (n.startDate && today < n.startDate) return "scheduled";
  if (n.endDate && today > n.endDate) return "expired";
  return "active";
}

// Does this notice belong on this page, right now, for the category selection shown?
export function noticeApplies(n, { pageKey, pageCategories, typeFilter = "all", now = new Date() }) {
  if (noticeStatus(n, now) !== "active") return false;
  if (n.page !== pageKey && n.page !== "all") return false;
  const cats = Array.isArray(n.categories) ? n.categories : [];
  if (cats.length === 0) return true;
  return typeFilter === "all" ? pageCategories.some((c) => cats.includes(c)) : cats.includes(typeFilter);
}

// Safe link target: https/http URLs or an in-app path; anything else is dropped.
export function noticeLink(n) {
  const url = typeof n.linkUrl === "string" ? n.linkUrl.trim() : "";
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return { href: url, external: true, text: (n.linkText || "Learn more").trim() || "Learn more" };
  if (url.startsWith("/") && !url.startsWith("//")) return { href: url, external: false, text: (n.linkText || "Learn more").trim() || "Learn more" };
  return null;
}

// ---- dismissing ------------------------------------------------------------
const DISMISS_KEY = "pf-dismissed-page-notices";

// Editing a notice's text brings it back for people who had closed the old one.
const fingerprint = (n) => `${n.id}:${(n.title || "").length}:${(n.message || "").length}:${(n.title || "").charCodeAt(0) || 0}:${(n.message || "").charCodeAt(0) || 0}`;

export function dismissedNotices() {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]")); } catch { return new Set(); }
}
export function isDismissed(n) {
  return n.dismissible === true && dismissedNotices().has(fingerprint(n));
}
export function dismissNotice(n) {
  try {
    const set = dismissedNotices();
    set.add(fingerprint(n));
    localStorage.setItem(DISMISS_KEY, JSON.stringify([...set].slice(-200)));
  } catch { /* private mode — it just comes back next visit */ }
}
