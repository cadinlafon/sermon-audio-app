////////////////////////////////////////////////////////////////
// PAGE MANAGER — shared logic
//
// Pure helpers used by the Page Manager admin UI, the dynamic
// navigation, and the PageGate route guard. Kept dependency-free
// so it can be safely imported from anywhere in the app.
////////////////////////////////////////////////////////////////

export const PAGE_STATUSES = [
  "active",
  "locked",
  "hidden",
  "maintenance",
  "coming-soon",
  "beta",
];

export const STATUS_META = {
  active: { label: "Active", color: "#166534", bg: "#dcfce7", icon: "✅" },
  locked: { label: "Locked", color: "#92400e", bg: "#fef3c7", icon: "🔒" },
  hidden: { label: "Hidden", color: "#4b5563", bg: "#e9e4d9", icon: "🙈" },
  maintenance: { label: "Maintenance", color: "#991b1b", bg: "#fee2e2", icon: "🔧" },
  "coming-soon": { label: "Coming Soon", color: "#6547a5", bg: "#eee8ff", icon: "🚀" },
  beta: { label: "Beta", color: "#2a5ab5", bg: "#e8f0fe", icon: "🧪" },
};

export const ACCESS_LEVELS = [
  { value: "public", label: "Everyone (Public)" },
  { value: "loggedIn", label: "Logged-in Users" },
  { value: "role", label: "Specific Role" },
];

export const BADGE_TYPES = ["text", "number", "status", "custom"];

export const BADGE_COLORS = {
  amber: { bg: "#f6e4b0", color: "#7a5a10", label: "Amber" },
  green: { bg: "#dcfce7", color: "#166534", label: "Green" },
  red: { bg: "#fee2e2", color: "#991b1b", label: "Red" },
  blue: { bg: "#e8f0fe", color: "#2a5ab5", label: "Blue" },
  purple: { bg: "#eee8ff", color: "#6547a5", label: "Purple" },
  gray: { bg: "#e9e4d9", color: "#4b5563", label: "Gray" },
};

export const ICON_CHOICES = [
  "🏠", "📖", "🎧", "🏫", "ℹ️", "💬", "✉️", "🔖", "📊", "💡",
  "⚙️", "🔔", "📌", "📄", "📂", "🎙️", "👥", "📈", "📣", "🔗",
  "🛡️", "🗓️", "📚", "🙏", "✨", "🎯", "🧭", "📝", "🚀", "🧪",
];

export const SCHEDULE_TYPES = [
  { value: "status", label: "Change status to…", needsValue: "status" },
  { value: "lock", label: "Lock page", needsValue: null },
  { value: "unlock", label: "Unlock page (→ Active)", needsValue: null },
  { value: "enable", label: "Enable page", needsValue: null },
  { value: "disable", label: "Disable page", needsValue: null },
  { value: "show-nav", label: "Show in navigation", needsValue: null },
  { value: "hide-nav", label: "Hide from navigation", needsValue: null },
  { value: "add-badge", label: "Add badge…", needsValue: "text" },
  { value: "remove-badge", label: "Remove badge", needsValue: null },
];

////////////////////////////////////////////////////////////////
// DEFAULTS / MERGING
////////////////////////////////////////////////////////////////

export function buildDefaultConfig(registryEntry) {
  return {
    id: registryEntry.id,
    route: registryEntry.route,
    defaultName: registryEntry.defaultName,
    name: registryEntry.defaultName,
    navLabel: "",
    description: registryEntry.defaultDescription || "",
    defaultIcon: registryEntry.defaultIcon,
    icon: registryEntry.defaultIcon,
    navSlot: registryEntry.navSlot,
    enabled: true,
    status: "active",
    showInNavigation: registryEntry.navSlot !== null,
    badgeEnabled: false,
    badgeText: "",
    badgeType: "text",
    badgeColor: "amber",
    pinned: false,
    order: registryEntry.defaultOrder ?? 0,
    accessLevel: registryEntry.defaultRequireLogin ? "loggedIn" : "public",
    requiredRole: "",
    requireLogin: !!registryEntry.defaultRequireLogin,
    userOverrides: { allow: [], deny: [] },
    maintenanceTitle: "",
    maintenanceMessage: "",
    maintenanceUntil: null,
    comingSoonTitle: "",
    comingSoonMessage: "",
    comingSoonBadge: "",
    releaseDate: null,
    schedules: [],
  };
}

// Merge Firestore overrides on top of the registry defaults.
// Does NOT apply schedules — this is the "base" stored config,
// used by the editor so admins edit what is actually stored.
export function mergeBaseConfig(registryEntry, firestoreData) {
  const base = buildDefaultConfig(registryEntry);
  if (!firestoreData) return base;

  return {
    ...base,
    ...firestoreData,
    // Never let a stale override change the route/registry-bound fields
    id: registryEntry.id,
    route: registryEntry.route,
    defaultName: registryEntry.defaultName,
    defaultIcon: registryEntry.defaultIcon,
    navSlot: registryEntry.navSlot,
    userOverrides: {
      allow: [],
      deny: [],
      ...(firestoreData.userOverrides || {}),
    },
    schedules: Array.isArray(firestoreData.schedules) ? firestoreData.schedules : [],
  };
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export { toDate };

// Apply any schedule entries whose runAt has passed, in
// chronological order, producing the "as of right now" config.
export function applySchedules(config, now = new Date()) {
  const schedules = config.schedules || [];
  if (schedules.length === 0) return config;

  const due = schedules
    .map((s) => ({ ...s, runAtDate: toDate(s.runAt) }))
    .filter((s) => s.runAtDate && s.runAtDate.getTime() <= now.getTime())
    .sort((a, b) => a.runAtDate - b.runAtDate);

  if (due.length === 0) return config;

  let effective = { ...config };

  for (const s of due) {
    switch (s.type) {
      case "status":
        if (s.value) effective.status = s.value;
        break;
      case "lock":
        effective.status = "locked";
        break;
      case "unlock":
        effective.status = "active";
        break;
      case "enable":
        effective.enabled = true;
        break;
      case "disable":
        effective.enabled = false;
        break;
      case "show-nav":
        effective.showInNavigation = true;
        break;
      case "hide-nav":
        effective.showInNavigation = false;
        break;
      case "add-badge":
        effective.badgeEnabled = true;
        if (s.value) effective.badgeText = s.value;
        break;
      case "remove-badge":
        effective.badgeEnabled = false;
        break;
      default:
        break;
    }
  }

  return effective;
}

export function getEffectiveConfig(registryEntry, firestoreData, now) {
  const base = mergeBaseConfig(registryEntry, firestoreData);
  return applySchedules(base, now);
}

////////////////////////////////////////////////////////////////
// DISPLAY / SORT
////////////////////////////////////////////////////////////////

export function getDisplayName(config) {
  return (config.navLabel && config.navLabel.trim()) || (config.name && config.name.trim()) || config.defaultName;
}

export function isVisibleInNav(config) {
  return (
    config.enabled !== false &&
    config.status !== "hidden" &&
    !!config.showInNavigation
  );
}

export function sortForNavigation(configs) {
  return [...configs].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    const orderA = typeof a.order === "number" ? a.order : 0;
    const orderB = typeof b.order === "number" ? b.order : 0;
    if (orderA !== orderB) return orderA - orderB;
    return (a.defaultName || "").localeCompare(b.defaultName || "");
  });
}

////////////////////////////////////////////////////////////////
// ACCESS CONTROL
//
// Central decision function — used by BOTH the nav renderer and
// the route guard (PageGate) so there is exactly one place that
// understands page access. Admins always pass, so they can find
// and fix anything they've misconfigured; use Preview to see the
// page the way a normal visitor would.
////////////////////////////////////////////////////////////////

export function resolvePageAccess(config, { user, role, isAdmin } = {}) {
  if (!config) return { decision: "ok" };
  if (isAdmin) return { decision: "ok" };

  const uid = user?.uid;

  if (uid && config.userOverrides?.deny?.some((u) => u.uid === uid)) {
    return { decision: "access-denied" };
  }

  const hasIndividualAllow =
    !!uid && !!config.userOverrides?.allow?.some((u) => u.uid === uid);

  const needsLogin = !!config.requireLogin || config.accessLevel !== "public";

  if (needsLogin && !user && !hasIndividualAllow) {
    return { decision: "login-required" };
  }

  if (!hasIndividualAllow && config.accessLevel === "role") {
    const required = (config.requiredRole || "admin").toLowerCase();
    if ((role || "").toLowerCase() !== required) {
      return { decision: "access-denied" };
    }
  }

  if (config.enabled === false) {
    return { decision: "disabled" };
  }

  if (config.status === "maintenance") return { decision: "maintenance" };
  if (config.status === "coming-soon") return { decision: "coming-soon" };
  if (config.status === "locked") return { decision: "locked" };

  return { decision: "ok" };
}

////////////////////////////////////////////////////////////////
// STATS
////////////////////////////////////////////////////////////////

export function computePageStats(pages) {
  return {
    total: pages.length,
    active: pages.filter((p) => p.enabled !== false && p.status === "active").length,
    locked: pages.filter((p) => p.status === "locked").length,
    hidden: pages.filter((p) => p.status === "hidden" || !p.showInNavigation).length,
    comingSoon: pages.filter((p) => p.status === "coming-soon").length,
    maintenance: pages.filter((p) => p.status === "maintenance").length,
    beta: pages.filter((p) => p.status === "beta").length,
    disabled: pages.filter((p) => p.enabled === false).length,
  };
}

////////////////////////////////////////////////////////////////
// VALIDATION
////////////////////////////////////////////////////////////////

// Emoji / short glyph only — keeps icon values safe and consistent
// with the rest of the app's existing emoji-based icon usage.
export function sanitizeIcon(value) {
  if (!value) return "";
  return Array.from(value.trim()).slice(0, 4).join("");
}
