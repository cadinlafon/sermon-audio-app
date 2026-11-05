////////////////////////////////////////////////////////////////
// AUDIO PAGE SETTINGS — defaults + sanitizing
//
// Everything the admin "Audio Page Manager" controls. Stored as ONE object
// (`audioPages`) on the app-config document appConfig/status, so every visitor
// already receives it with the status snapshot the app listens to anyway — no
// extra reads. Nothing saved = these defaults, which reproduce the pages
// exactly as they looked before the manager existed.
//
// Shape:
//   pages.sermons / pages.sundayschool   per-page settings (layout, card,
//                                        appearance, featured, search, pagination)
//   categories[]                         the audio categories (sermon, homily,
//                                        sundayschool): names, icons, order…
//   featuredCategory                     id of the featured category ("" = none)
//   playback{}                           player behavior (global)
//   advanced{}                           downloads, quality, sharing, favorites,
//                                        card animations (global)
////////////////////////////////////////////////////////////////

export const PAGE_KEYS = ["sermons", "sundayschool"];

export const PAGE_META = {
  sermons: { label: "Sermons & Homilies", route: "/sermons", categories: ["sermon", "homily"], defaultTitle: "Sermons & Homilies", defaultSort: "newest" },
  sundayschool: { label: "Sunday School", route: "/sundayschool", categories: ["sundayschool"], defaultTitle: "Sunday School", defaultSort: "oldest" },
};

export const SORT_OPTIONS = [
  ["newest", "Newest first"], ["oldest", "Oldest first"], ["shortest", "Shortest → longest"],
  ["longest", "Longest → shortest"], ["title", "Title A–Z"], ["speaker", "Speaker A–Z"],
];

export const CARD_LAYOUTS = [["compact", "Compact"], ["comfortable", "Comfortable (default)"], ["spacious", "Spacious"]];
export const VIEWS = [["list", "List"], ["grid", "Grid"]];
export const GROUP_BY = [["none", "No grouping"], ["category", "By category"], ["year", "By year"], ["month", "By month"]];
export const HEADER_STYLES = [["plain", "Plain"], ["underline", "Underlined"], ["band", "Shaded band"], ["pill", "Pill"]];
export const SPACING = [["tight", "Tight"], ["normal", "Normal (default)"], ["relaxed", "Relaxed"]];

// Card buttons the admin can reorder / hide.
export const PRIMARY_BUTTONS = [
  { id: "play", label: "Play / Resume", locked: true },
  { id: "playNext", label: "+ Play Next" },
  { id: "more", label: "More ▾" },
];
export const MORE_BUTTONS = [
  { id: "transcript", label: "View Transcript" },
  { id: "copyLink", label: "Copy link" },
  { id: "share", label: "Share" },
  { id: "playlist", label: "Add to playlist" },
  { id: "download", label: "Download" },
];

// Details a card can show.
export const CARD_DETAILS = [
  { id: "categoryTag", label: "Category tag (Sermon, Homily…)" },
  { id: "newBadge", label: "“New” badge (first 7 days)" },
  { id: "durationBadge", label: "Length badge" },
  { id: "downloadedBadge", label: "“Downloaded” badge" },
  { id: "speaker", label: "Speaker" },
  { id: "date", label: "Date" },
  { id: "series", label: "Series" },
  { id: "progressBar", label: "Listening progress bar" },
  { id: "likeButton", label: "Like (heart) button" },
  { id: "aiSummary", label: "AI summary button" },
];

export const NOTICE_TYPES = [
  { id: "info", label: "Information", icon: "ℹ️" },
  { id: "warning", label: "Warning", icon: "⚠️" },
  { id: "announcement", label: "Announcement", icon: "📣" },
  { id: "important", label: "Important", icon: "❗" },
];
export const NOTICE_PLACEMENTS = [
  ["pageTop", "Very top of the page"],
  ["aboveFilters", "Above search & filters (under the title)"],
  ["aboveList", "Above the audio list"],
  ["belowList", "Below the audio list"],
];

export const SEARCH_FIELDS = [
  { id: "title", label: "Title" },
  { id: "speaker", label: "Speaker" },
  { id: "series", label: "Series" },
  { id: "summary", label: "AI summary text" },
  { id: "date", label: "Date" },
];
export const FILTER_TOGGLES = [
  { id: "category", label: "Category filter" },
  { id: "speaker", label: "Speaker filter" },
  { id: "date", label: "Date filter (year & month)" },
  { id: "series", label: "Series filter" },
  { id: "length", label: "Length filter" },
  { id: "progress", label: "Progress filter" },
  { id: "liked", label: "“Liked only”" },
  { id: "downloaded", label: "“Downloaded only”" },
];

export const PAGE_SIZES = [10, 20, 30, 50];
export const SKIP_CHOICES = [10, 15, 30, 45, 60];
export const SPEED_CHOICES = [0.75, 1, 1.25, 1.5, 1.75, 2];
export const PLAYER_STYLES = [["standard", "Standard (large artwork)"], ["compact", "Compact (small artwork)"], ["minimal", "Minimal (no artwork)"]];
export const QUALITIES = [["high", "High (original audio)"], ["saver", "Data saver (smaller, voice-quality)"]];
export const ANIMATIONS = [["none", "None"], ["subtle", "Subtle (default)"], ["lively", "Lively"]];

export const DEFAULT_CATEGORIES = [
  { id: "sermon", name: "Sermon", plural: "Sermons", icon: "", description: "", visible: true, defaultSort: "" },
  { id: "homily", name: "Homily", plural: "Homilies", icon: "", description: "", visible: true, defaultSort: "" },
  { id: "sundayschool", name: "Sunday School", plural: "Sunday School", icon: "", description: "", visible: true, defaultSort: "" },
];

export function defaultPage(key) {
  return {
    layout: { defaultSort: PAGE_META[key].defaultSort, defaultView: "list", cardLayout: "comfortable", defaultExpanded: false, groupBy: "none" },
    card: {
      buttonOrder: PRIMARY_BUTTONS.map((b) => b.id),
      moreOrder: MORE_BUTTONS.map((b) => b.id),
      buttons: { playNext: true, more: true, transcript: true, copyLink: true, share: true, playlist: true, download: true },
      details: { categoryTag: true, newBadge: true, durationBadge: true, downloadedBadge: true, speaker: true, date: false, series: false, progressBar: true, likeButton: true, aiSummary: true },
    },
    appearance: {
      title: "", subtitle: "",
      banner: { url: "", storageKey: "", focusX: 50, focusY: 50, zoom: 1, height: 200 },
      headerStyle: "plain", headerAlign: "left",
      showCategoryDescriptions: true,
      defaultCategory: "all", // "all" | "featured" | a category id
      emptyMessage: "", noResultsMessage: "", loadingMessage: "",
      spacing: "normal",
    },
    featured: {
      enabled: false, title: "Featured",
      pinned: [], // [{ id, expiresAt: "YYYY-MM-DD" | "" }]
      series: { enabled: false, name: "", title: "" },
      recent: { enabled: false, title: "Recently added", count: 3, days: 30 },
      popular: { enabled: false, title: "Most played", count: 3, ids: [], updatedAt: "" },
      collections: [], // [{ id, title, ids: [], enabled, expiresAt }]
    },
    search: {
      enabled: true, placeholder: "",
      fields: { title: true, speaker: true, series: false, summary: false, date: false },
      filters: { category: true, speaker: true, date: true, series: true, length: true, progress: true, liked: true, downloaded: true },
      rememberFilters: true, filtersOpenByDefault: false,
    },
    pagination: { mode: "all", size: 20 },
  };
}

export const DEFAULT_PLAYBACK = {
  defaultSpeed: 1, rememberSpeed: true, rememberPosition: true, autoPlayNext: true,
  showProgress: true, backgroundPlayback: true, playerStyle: "standard", skipBack: 30, skipForward: 30,
};

export const DEFAULT_ADVANCED = {
  downloads: { enabled: true, roles: { user: true, admin: true } },
  quality: "high",
  sharing: { enabled: true, text: "Listen to “{title}” by {speaker} — Palouse Fellowship" },
  favorites: true,
  animations: "subtle",
};

export function defaultAudioPages() {
  return {
    pages: { sermons: defaultPage("sermons"), sundayschool: defaultPage("sundayschool") },
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    featuredCategory: "",
    playback: { ...DEFAULT_PLAYBACK },
    advanced: JSON.parse(JSON.stringify(DEFAULT_ADVANCED)),
  };
}

////////////////////////////////////////////////////////////////
// Sanitizing — whatever is stored (older, partial, hand-edited) is coerced
// into a valid, complete settings object, so a bad value can never break a page.
////////////////////////////////////////////////////////////////

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const str = (v, fallback = "", max = 300) => (typeof v === "string" ? v.slice(0, max) : fallback);
const bool = (v, fallback) => (typeof v === "boolean" ? v : fallback);
const oneOf = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);
const num = (v, lo, hi, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};
const boolMap = (stored, defaults) => Object.fromEntries(Object.keys(defaults).map((k) => [k, bool(stored?.[k], defaults[k])]));
const dateStr = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

// Keep a saved ordering, drop unknown ids, append any new ids at the end.
function orderOf(stored, allIds) {
  const seen = new Set();
  const out = [];
  for (const id of Array.isArray(stored) ? stored : []) if (allIds.includes(id) && !seen.has(id)) { seen.add(id); out.push(id); }
  for (const id of allIds) if (!seen.has(id)) out.push(id);
  return out;
}

const idList = (v, max = 60) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x).slice(0, max) : []);

export function sanitizePage(key, stored) {
  const d = defaultPage(key);
  const s = isObj(stored) ? stored : {};
  const L = isObj(s.layout) ? s.layout : {};
  const C = isObj(s.card) ? s.card : {};
  const A = isObj(s.appearance) ? s.appearance : {};
  const B = isObj(A.banner) ? A.banner : {};
  const F = isObj(s.featured) ? s.featured : {};
  const S = isObj(s.search) ? s.search : {};
  const P = isObj(s.pagination) ? s.pagination : {};

  const sortIds = SORT_OPTIONS.map((o) => o[0]);
  const primaryIds = PRIMARY_BUTTONS.map((b) => b.id);
  const moreIds = MORE_BUTTONS.map((b) => b.id);

  const buttons = boolMap(C.buttons, d.card.buttons);

  return {
    layout: {
      defaultSort: oneOf(L.defaultSort, sortIds, d.layout.defaultSort),
      defaultView: oneOf(L.defaultView, VIEWS.map((v) => v[0]), d.layout.defaultView),
      cardLayout: oneOf(L.cardLayout, CARD_LAYOUTS.map((v) => v[0]), d.layout.cardLayout),
      defaultExpanded: bool(L.defaultExpanded, d.layout.defaultExpanded),
      groupBy: oneOf(L.groupBy, GROUP_BY.map((v) => v[0]), d.layout.groupBy),
    },
    card: {
      buttonOrder: orderOf(C.buttonOrder, primaryIds),
      moreOrder: orderOf(C.moreOrder, moreIds),
      buttons,
      details: boolMap(C.details, d.card.details),
    },
    appearance: {
      title: str(A.title, "", 80),
      subtitle: str(A.subtitle, "", 200),
      banner: {
        url: typeof B.url === "string" && /^(https?:\/\/|\/)/.test(B.url) ? B.url.slice(0, 600) : "",
        storageKey: str(B.storageKey, "", 300),
        focusX: num(B.focusX, 0, 100, 50),
        focusY: num(B.focusY, 0, 100, 50),
        zoom: num(B.zoom, 1, 3, 1),
        height: Math.round(num(B.height, 120, 360, 200)),
      },
      headerStyle: oneOf(A.headerStyle, HEADER_STYLES.map((v) => v[0]), d.appearance.headerStyle),
      headerAlign: oneOf(A.headerAlign, ["left", "center"], d.appearance.headerAlign),
      showCategoryDescriptions: bool(A.showCategoryDescriptions, d.appearance.showCategoryDescriptions),
      defaultCategory: str(A.defaultCategory, "all", 30) || "all",
      emptyMessage: str(A.emptyMessage, "", 200),
      noResultsMessage: str(A.noResultsMessage, "", 200),
      loadingMessage: str(A.loadingMessage, "", 120),
      spacing: oneOf(A.spacing, SPACING.map((v) => v[0]), d.appearance.spacing),
    },
    featured: {
      enabled: bool(F.enabled, d.featured.enabled),
      title: str(F.title, d.featured.title, 60) || d.featured.title,
      pinned: (Array.isArray(F.pinned) ? F.pinned : [])
        .filter((p) => isObj(p) && typeof p.id === "string" && p.id)
        .slice(0, 30)
        .map((p) => ({ id: p.id, expiresAt: dateStr(p.expiresAt) })),
      series: {
        enabled: bool(F.series?.enabled, false),
        name: str(F.series?.name, "", 100),
        title: str(F.series?.title, "", 60),
      },
      recent: {
        enabled: bool(F.recent?.enabled, false),
        title: str(F.recent?.title, d.featured.recent.title, 60) || d.featured.recent.title,
        count: Math.round(num(F.recent?.count, 1, 12, 3)),
        days: Math.round(num(F.recent?.days, 1, 365, 30)),
      },
      popular: {
        enabled: bool(F.popular?.enabled, false),
        title: str(F.popular?.title, d.featured.popular.title, 60) || d.featured.popular.title,
        count: Math.round(num(F.popular?.count, 1, 12, 3)),
        ids: idList(F.popular?.ids, 12),
        updatedAt: str(F.popular?.updatedAt, "", 40),
      },
      collections: (Array.isArray(F.collections) ? F.collections : [])
        .filter((c) => isObj(c) && typeof c.id === "string")
        .slice(0, 6)
        .map((c) => ({
          id: c.id,
          title: str(c.title, "Collection", 60) || "Collection",
          ids: idList(c.ids, 30),
          enabled: bool(c.enabled, true),
          expiresAt: dateStr(c.expiresAt),
        })),
    },
    search: {
      enabled: bool(S.enabled, d.search.enabled),
      placeholder: str(S.placeholder, "", 80),
      fields: boolMap(S.fields, d.search.fields),
      filters: boolMap(S.filters, d.search.filters),
      rememberFilters: bool(S.rememberFilters, d.search.rememberFilters),
      filtersOpenByDefault: bool(S.filtersOpenByDefault, d.search.filtersOpenByDefault),
    },
    pagination: {
      mode: oneOf(P.mode, ["all", "loadMore"], "all"),
      size: PAGE_SIZES.includes(Number(P.size)) ? Number(P.size) : d.pagination.size,
    },
  };
}

export function sanitizeCategories(stored) {
  const byId = new Map((Array.isArray(stored) ? stored : []).filter((c) => isObj(c) && typeof c.id === "string").map((c) => [c.id, c]));
  const ids = orderOf(Array.isArray(stored) ? stored.map((c) => c?.id) : [], DEFAULT_CATEGORIES.map((c) => c.id));
  const sortIds = SORT_OPTIONS.map((o) => o[0]);
  return ids.map((id) => {
    const d = DEFAULT_CATEGORIES.find((c) => c.id === id);
    const c = byId.get(id) || {};
    return {
      id,
      name: str(c.name, d.name, 40) || d.name,
      plural: str(c.plural, d.plural, 40) || d.plural,
      icon: str(c.icon, "", 8),
      description: str(c.description, "", 300),
      visible: bool(c.visible, true),
      defaultSort: oneOf(c.defaultSort, ["", ...sortIds], ""),
    };
  });
}

export function sanitizePlayback(stored) {
  const s = isObj(stored) ? stored : {};
  const d = DEFAULT_PLAYBACK;
  return {
    defaultSpeed: SPEED_CHOICES.includes(Number(s.defaultSpeed)) ? Number(s.defaultSpeed) : d.defaultSpeed,
    rememberSpeed: bool(s.rememberSpeed, d.rememberSpeed),
    rememberPosition: bool(s.rememberPosition, d.rememberPosition),
    autoPlayNext: bool(s.autoPlayNext, d.autoPlayNext),
    showProgress: bool(s.showProgress, d.showProgress),
    backgroundPlayback: bool(s.backgroundPlayback, d.backgroundPlayback),
    playerStyle: oneOf(s.playerStyle, PLAYER_STYLES.map((v) => v[0]), d.playerStyle),
    skipBack: SKIP_CHOICES.includes(Number(s.skipBack)) ? Number(s.skipBack) : d.skipBack,
    skipForward: SKIP_CHOICES.includes(Number(s.skipForward)) ? Number(s.skipForward) : d.skipForward,
  };
}

export function sanitizeAdvanced(stored) {
  const s = isObj(stored) ? stored : {};
  const d = DEFAULT_ADVANCED;
  return {
    downloads: {
      enabled: bool(s.downloads?.enabled, d.downloads.enabled),
      roles: { user: bool(s.downloads?.roles?.user, true), admin: bool(s.downloads?.roles?.admin, true) },
    },
    quality: oneOf(s.quality, QUALITIES.map((v) => v[0]), d.quality),
    sharing: {
      enabled: bool(s.sharing?.enabled, d.sharing.enabled),
      text: str(s.sharing?.text, d.sharing.text, 200) || d.sharing.text,
    },
    favorites: bool(s.favorites, d.favorites),
    animations: oneOf(s.animations, ANIMATIONS.map((v) => v[0]), d.animations),
  };
}

export function sanitizeAudioPages(stored) {
  const s = isObj(stored) ? stored : {};
  const categories = sanitizeCategories(s.categories);
  const featuredCategory = categories.some((c) => c.id === s.featuredCategory) ? s.featuredCategory : "";
  return {
    pages: Object.fromEntries(PAGE_KEYS.map((k) => [k, sanitizePage(k, s.pages?.[k])])),
    categories,
    featuredCategory,
    playback: sanitizePlayback(s.playback),
    advanced: sanitizeAdvanced(s.advanced),
  };
}

////////////////////////////////////////////////////////////////
// Resolved config for one page — what components read.
////////////////////////////////////////////////////////////////

export function resolveAudioConfig(stored, pageKey = "sermons") {
  const all = sanitizeAudioPages(stored);
  const key = PAGE_KEYS.includes(pageKey) ? pageKey : "sermons";
  const page = all.pages[key];
  return {
    pageKey: key,
    page,
    categories: all.categories,
    featuredCategory: all.featuredCategory,
    playback: all.playback,
    advanced: all.advanced,
  };
}

export const categoryById = (config, id) => config.categories.find((c) => c.id === id);
export const categoryLabel = (config, id, fallback = "") => categoryById(config, id)?.name || fallback;
