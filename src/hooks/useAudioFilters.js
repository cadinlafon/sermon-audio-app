import { useCallback, useEffect, useMemo, useState } from "react";
import useUserAudioState from "./useUserAudioState";

export const SORTS = [
  ["newest", "Newest first"], ["oldest", "Oldest first"], ["shortest", "Shortest → longest"],
  ["longest", "Longest → shortest"], ["title", "Title A–Z"], ["speaker", "Speaker A–Z"],
];
export const DURATIONS = [["any", "Any length"], ["short", "Under 15 min"], ["medium", "15–30 min"], ["long", "30–60 min"], ["xl", "Over 60 min"]];
export const STATUSES = [["all", "Any progress"], ["unstarted", "Not started"], ["in-progress", "In progress"], ["completed", "Completed"]];
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const DEFAULT_FILTERS = { search: "", speaker: "all", type: "all", series: "all", sort: "newest", duration: "any", year: "all", month: "all", status: "all", liked: false, downloaded: false };

const dateOf = (a) => {
  if (a.date && /^\d{4}-\d{2}-\d{2}/.test(a.date)) return { y: Number(a.date.slice(0, 4)), m: Number(a.date.slice(5, 7)) };
  if (a.createdAt?.seconds) { const d = new Date(a.createdAt.seconds * 1000); return { y: d.getFullYear(), m: d.getMonth() + 1 }; }
  return null;
};

// The text search looks at — only the fields the admin left on.
const searchText = (i, fields) => {
  const parts = [];
  if (fields.title !== false) parts.push(i.title);
  if (fields.speaker !== false) parts.push(i.speaker);
  if (fields.series) parts.push(i.series);
  if (fields.summary) parts.push(i.aiSummary);
  if (fields.date) {
    parts.push(i.date);
    const d = dateOf(i);
    if (d) parts.push(`${MONTHS[d.m - 1]} ${d.y}`);
  }
  return parts.filter(Boolean).join(" ").toLowerCase();
};

const inDuration = (seconds, bucket) => {
  if (bucket === "any") return true;
  const m = (Number(seconds) || 0) / 60;
  if (!m) return false;
  return bucket === "short" ? m < 15 : bucket === "medium" ? m >= 15 && m < 30 : bucket === "long" ? m >= 30 && m < 60 : m >= 60;
};

// Search / filter / sort state for an audio list, remembered per page.
// `items` arrive ordered by `order` ascending (oldest first), as the pages fetch them.
//
// Options (from the Audio Page Manager — see data/audioPageDefaults.js):
//   defaultSort      the page's default sort. It applies until the visitor picks
//                    a sort themselves (then theirs is remembered).
//   legacyDefault    the sort the page used before it was configurable — a stored
//                    sort that differs from it counts as the visitor's own choice.
//   defaultType      category selection on open ("all" or a category id), same rule.
//   remember         false = filters never persist (every visit starts fresh).
//   persist          false = don't touch localStorage at all (the admin preview).
//   searchFields     { title, speaker, series, summary, date } — what search looks at.
//   typeLabel        (id) => display name for a category (for chips).
export default function useAudioFilters(items, storageKey, {
  defaultSort = "newest", legacyDefault, defaultType = "all", remember = true, persist = true,
  searchFields = { title: true, speaker: true }, typeLabel,
} = {}) {
  const key = `audioFilters:${storageKey}`;
  const legacy = legacyDefault || defaultSort;
  const base = { ...DEFAULT_FILTERS, sort: defaultSort, type: defaultType };
  const canStore = persist && remember;

  const [initial] = useState(() => {
    if (!canStore) return { filters: { ...base }, chosen: {} };
    try {
      const stored = JSON.parse(localStorage.getItem(key) || "{}");
      const { chosen: storedChosen, ...rest } = stored;
      const sortChosen = storedChosen?.sort ?? (rest.sort !== undefined && rest.sort !== legacy);
      const typeChosen = storedChosen?.type ?? (rest.type !== undefined && rest.type !== "all");
      const merged = { ...base, ...rest, search: "" };
      if (!sortChosen) merged.sort = defaultSort;
      if (!typeChosen) merged.type = defaultType;
      return { filters: merged, chosen: { sort: !!sortChosen, type: !!typeChosen } };
    } catch { return { filters: { ...base }, chosen: {} }; }
  });
  const [chosen, setChosen] = useState(initial.chosen);
  const [filters, setFilters] = useState(initial.filters);
  const userState = useUserAudioState();

  // Remember everything except the search text.
  useEffect(() => {
    if (!canStore) return;
    try { localStorage.setItem(key, JSON.stringify({ ...filters, search: "", chosen })); } catch { /* ignore */ }
  }, [filters, chosen, key, canStore]);

  // The page's defaults changed (admin edited them, or settings just loaded):
  // follow them for anything the visitor hasn't chosen themselves.
  useEffect(() => {
    setFilters((f) => ({
      ...f,
      ...(chosen.sort ? null : { sort: defaultSort }),
      ...(chosen.type ? null : { type: defaultType }),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultSort, defaultType]);

  const set = useCallback((patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    if ("sort" in patch || "type" in patch) setChosen((c) => ({ ...c, ...("sort" in patch ? { sort: true } : null), ...("type" in patch ? { type: true } : null) }));
  }, []);
  const reset = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS, sort: defaultSort, type: defaultType });
    setChosen({});
  }, [defaultSort, defaultType]);

  const options = useMemo(() => {
    const speakers = [...new Set(items.map((i) => i.speaker).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const years = [...new Set(items.map((i) => dateOf(i)?.y).filter(Boolean))].sort((a, b) => b - a);
    const series = [...new Set(items.map((i) => (typeof i.series === "string" ? i.series.trim() : "")).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return { speakers, years, series };
  }, [items]);

  const result = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    let list = items.filter((i) => {
      if (q && !searchText(i, searchFields).includes(q)) return false;
      if (filters.speaker !== "all" && i.speaker !== filters.speaker) return false;
      if (filters.type !== "all" && i.type !== filters.type) return false;
      if (filters.series !== "all" && (i.series || "").trim() !== filters.series) return false;
      if (!inDuration(i.duration, filters.duration)) return false;
      const d = dateOf(i);
      if (filters.year !== "all" && d?.y !== Number(filters.year)) return false;
      if (filters.month !== "all" && d?.m !== Number(filters.month)) return false;
      if (filters.status !== "all") {
        const s = userState.status[i.id] || "not-started";
        if (filters.status === "unstarted" ? s !== "not-started" : s !== filters.status) return false;
      }
      if (filters.liked && !userState.liked.has(i.id)) return false;
      if (filters.downloaded && !userState.downloaded.has(i.id)) return false;
      return true;
    });

    const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);
    const dur = (a) => Number(a.duration) || 0;
    switch (filters.sort) {
      case "oldest": list = [...list].sort(byOrder); break;
      case "shortest": list = [...list].sort((a, b) => (dur(a) || Infinity) - (dur(b) || Infinity)); break;
      case "longest": list = [...list].sort((a, b) => dur(b) - dur(a)); break;
      case "title": list = [...list].sort((a, b) => (a.title || "").localeCompare(b.title || "")); break;
      case "speaker": list = [...list].sort((a, b) => (a.speaker || "").localeCompare(b.speaker || "") || (a.title || "").localeCompare(b.title || "")); break;
      default: list = [...list].sort((a, b) => byOrder(b, a));
    }
    return list;
  }, [items, filters, userState, searchFields]);

  // Active filters, for chips (the sort order isn't a filter).
  const chips = useMemo(() => {
    const c = [];
    if (filters.search.trim()) c.push({ key: "search", label: `“${filters.search.trim()}”`, clear: { search: "" } });
    if (filters.speaker !== "all") c.push({ key: "speaker", label: filters.speaker, clear: { speaker: "all" } });
    if (filters.type !== "all") c.push({ key: "type", label: typeLabel ? typeLabel(filters.type) : filters.type === "homily" ? "Homilies" : filters.type === "sundayschool" ? "Sunday School" : "Sermons", clear: { type: "all" } });
    if (filters.series !== "all") c.push({ key: "series", label: `Series: ${filters.series}`, clear: { series: "all" } });
    if (filters.duration !== "any") c.push({ key: "duration", label: DURATIONS.find((d) => d[0] === filters.duration)[1], clear: { duration: "any" } });
    if (filters.year !== "all") c.push({ key: "year", label: String(filters.year), clear: { year: "all" } });
    if (filters.month !== "all") c.push({ key: "month", label: MONTHS[filters.month - 1], clear: { month: "all" } });
    if (filters.status !== "all") c.push({ key: "status", label: STATUSES.find((s) => s[0] === filters.status)[1], clear: { status: "all" } });
    if (filters.liked) c.push({ key: "liked", label: "Liked", clear: { liked: false } });
    if (filters.downloaded) c.push({ key: "downloaded", label: "Downloaded", clear: { downloaded: false } });
    return c;
  }, [filters, typeLabel]);

  return { filters, set, reset, options, result, chips, total: items.length, userState };
}
