import { useEffect, useMemo, useState } from "react";
import AudioCard from "./AudioCard";
import PlayAllBar from "./PlayAllBar";
import AudioFilterBar, { NoResults } from "./AudioFilterBar";
import SkeletonList from "./Skeleton";
import PageNoticeList from "./PageNoticeList";
import DoctrineBanner from "./DoctrineBanner";
import useAudioFilters from "../hooks/useAudioFilters";
import useAudioConfig, { AudioConfigContext } from "../hooks/useAudioConfig";
import useOnlineStatus from "../hooks/useOnlineStatus";
import { PAGE_META } from "../data/audioPageDefaults";
import { noticeApplies, noticePlacement, todayString } from "../utils/pageNotices";

////////////////////////////////////////////////////////////////
// AUDIO LIST VIEW
//
// The whole audio list page — title, banner, notices, search & filters,
// featured sections, grouped / paginated cards — driven by the Audio Page
// Manager settings. The Sermons and Sunday School pages are thin wrappers
// around this, and the admin visualizer renders it with DRAFT settings
// (`preview`), so what the admin sees is the real page.
////////////////////////////////////////////////////////////////

const SPACING = {
  tight: { pad: "20px 14px 40px", gap: "10px", section: "20px" },
  normal: { pad: "32px 20px 60px", gap: "16px", section: "28px" },
  relaxed: { pad: "44px 28px 80px", gap: "24px", section: "40px" },
};

const dateOf = (a) => {
  if (a.date && /^\d{4}-\d{2}-\d{2}/.test(a.date)) return { y: Number(a.date.slice(0, 4)), m: Number(a.date.slice(5, 7)) };
  if (a.createdAt?.seconds) { const d = new Date(a.createdAt.seconds * 1000); return { y: d.getFullYear(), m: d.getMonth() + 1 }; }
  return null;
};
const createdMs = (a) => (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.date ? Date.parse(a.date) || 0 : 0);
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function AudioListView({ pageKey, items, loading, onPlay, onSummarySaved, notices = [], preview = false }) {
  const cfg = useAudioConfig(pageKey);
  const { page } = cfg;
  const meta = PAGE_META[cfg.pageKey];
  const isOnline = useOnlineStatus();
  const sp = SPACING[page.appearance.spacing] || SPACING.normal;

  // ── categories on this page: visible ones, in the admin's order ──────────
  const pageCategories = useMemo(
    () => cfg.categories.filter((c) => meta.categories.includes(c.id) && c.visible),
    [cfg.categories, meta.categories]
  );
  const visibleIds = useMemo(() => new Set(pageCategories.map((c) => c.id)), [pageCategories]);
  const categoryOrder = (id) => {
    const i = pageCategories.findIndex((c) => c.id === id);
    return i < 0 ? 999 : i;
  };
  const visibleItems = useMemo(() => items.filter((i) => visibleIds.has(i.type)), [items, visibleIds]);

  // ── defaults: category selection and sort ───────────────────────────────
  const defaultType = (() => {
    const want = page.appearance.defaultCategory;
    if (want === "featured") return visibleIds.has(cfg.featuredCategory) ? cfg.featuredCategory : "all";
    return want !== "all" && visibleIds.has(want) ? want : "all";
  })();
  const defaultSort = (() => {
    const forCategory = (id) => pageCategories.find((c) => c.id === id)?.defaultSort;
    if (defaultType !== "all" && forCategory(defaultType)) return forCategory(defaultType);
    if (pageCategories.length === 1 && forCategory(pageCategories[0].id)) return forCategory(pageCategories[0].id);
    return page.layout.defaultSort;
  })();

  const typeLabel = (id) => pageCategories.find((c) => c.id === id)?.plural || id;
  const f = useAudioFilters(visibleItems, cfg.pageKey, {
    defaultSort,
    legacyDefault: meta.defaultSort,
    defaultType,
    remember: page.search.rememberFilters,
    persist: !preview,
    searchFields: page.search.fields,
    typeLabel,
  });

  // ── view (list / grid): the admin's default until the visitor picks ─────
  const viewKey = `audioView:${cfg.pageKey}`;
  const [viewChoice, setViewChoice] = useState(() => {
    if (preview) return null;
    try { return localStorage.getItem(viewKey) || null; } catch { return null; }
  });
  const view = viewChoice || page.layout.defaultView;
  const chooseView = (v) => {
    setViewChoice(v);
    if (!preview) { try { localStorage.setItem(viewKey, v); } catch { /* ignore */ } }
  };
  useEffect(() => { if (preview) setViewChoice(null); }, [preview, page.layout.defaultView]);
  const grid = view === "grid";

  // ── pinned items float up; featured sections ────────────────────────────
  const today = todayString();
  const byId = useMemo(() => new Map(visibleItems.map((i) => [i.id, i])), [visibleItems]);
  const pinnedItems = page.featured.pinned
    .filter((p) => !p.expiresAt || p.expiresAt >= today)
    .map((p) => byId.get(p.id))
    .filter(Boolean);
  const pinnedIds = new Set(pinnedItems.map((i) => i.id));
  const filtering = f.chips.length > 0;

  const sections = [];
  if (!filtering) {
    if (page.featured.enabled && pinnedItems.length) sections.push({ key: "featured", title: page.featured.title, items: pinnedItems });
    const fs = page.featured.series;
    if (fs.enabled && fs.name) {
      const list = visibleItems.filter((i) => (i.series || "").trim() === fs.name).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      if (list.length) sections.push({ key: "series", title: fs.title || `Series: ${fs.name}`, items: list });
    }
    const fr = page.featured.recent;
    if (fr.enabled) {
      const cutoff = Date.now() - fr.days * 86400000;
      const list = [...visibleItems].filter((i) => createdMs(i) >= cutoff).sort((a, b) => createdMs(b) - createdMs(a) || (b.order ?? 0) - (a.order ?? 0)).slice(0, fr.count);
      if (list.length) sections.push({ key: "recent", title: fr.title, items: list });
    }
    const fp = page.featured.popular;
    if (fp.enabled) {
      const list = fp.ids.map((id) => byId.get(id)).filter(Boolean).slice(0, fp.count);
      if (list.length) sections.push({ key: "popular", title: fp.title, items: list });
    }
    for (const c of page.featured.collections) {
      if (!c.enabled || (c.expiresAt && c.expiresAt < today)) continue;
      const list = c.ids.map((id) => byId.get(id)).filter(Boolean);
      if (list.length) sections.push({ key: `col-${c.id}`, title: c.title, items: list });
    }
  }
  const sectionPinnedInSection = page.featured.enabled && !filtering;

  // The main list: pinned first (unless they're in their own section).
  const mainList = useMemo(() => {
    let list = f.result;
    if (!filtering && pinnedItems.length) {
      const inList = list.filter((i) => pinnedIds.has(i.id));
      const rest = list.filter((i) => !pinnedIds.has(i.id));
      list = sectionPinnedInSection ? rest : [...pinnedItems.filter((p) => inList.some((i) => i.id === p.id)), ...rest];
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.result, filtering, page.featured.pinned, page.featured.enabled, byId]);

  // ── pagination ─────────────────────────────────────────────────────────
  const pageSize = page.pagination.mode === "loadMore" ? page.pagination.size : Infinity;
  const [shown, setShown] = useState(pageSize);
  const filterSignature = JSON.stringify(f.filters);
  useEffect(() => { setShown(pageSize); }, [filterSignature, pageSize]);
  const slice = mainList.slice(0, shown);
  const hasMore = mainList.length > slice.length;

  // ── grouping ───────────────────────────────────────────────────────────
  const groups = useMemo(() => {
    const mode = page.layout.groupBy;
    if (mode === "none") return [{ key: "all", title: "", items: slice }];
    const map = new Map();
    for (const item of slice) {
      let key;
      let title;
      let order = 0;
      if (mode === "category") {
        key = item.type;
        const c = pageCategories.find((x) => x.id === item.type);
        title = c ? `${c.icon ? `${c.icon} ` : ""}${c.plural}` : item.type;
        order = categoryOrder(item.type);
      } else {
        const d = dateOf(item);
        key = d ? (mode === "year" ? String(d.y) : `${d.y}-${String(d.m).padStart(2, "0")}`) : "unknown";
        title = d ? (mode === "year" ? String(d.y) : `${MONTH_NAMES[d.m - 1]} ${d.y}`) : "Undated";
        order = d ? d.y * 100 + (mode === "year" ? 0 : d.m) : 0;
      }
      if (!map.has(key)) map.set(key, { key, title, order, items: [], category: mode === "category" ? pageCategories.find((x) => x.id === item.type) : null });
      map.get(key).items.push(item);
    }
    const out = [...map.values()];
    if (mode === "category") out.sort((a, b) => a.order - b.order);
    else out.sort((a, b) => (f.filters.sort === "oldest" ? a.order - b.order : b.order - a.order));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slice, page.layout.groupBy, pageCategories, f.filters.sort]);

  // ── notices by placement ───────────────────────────────────────────────
  const pageCategoryIds = pageCategories.map((c) => c.id);
  const noticesAt = (placement) =>
    notices.filter((n) => noticePlacement(n) === placement && noticeApplies(n, { pageKey: cfg.pageKey, pageCategories: pageCategoryIds, typeFilter: f.filters.type }));

  // ── category descriptions under the title ───────────────────────────────
  const describedCategories = !page.appearance.showCategoryDescriptions || page.layout.groupBy === "category"
    ? []
    : (f.filters.type !== "all" ? pageCategories.filter((c) => c.id === f.filters.type) : pageCategories).filter((c) => c.description);

  const title = page.appearance.title || meta.defaultTitle;
  const banner = page.appearance.banner;
  const showLiked = cfg.advanced.favorites;

  const renderCards = (list, startIndex = 0) => (
    <div style={grid ? { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: sp.gap, alignItems: "stretch" } : { display: "flex", flexDirection: "column", gap: sp.gap }}>
      {list.map((item, i) => (
        <AudioCard key={item.id} audio={item} onPlay={onPlay} onSummarySaved={onSummarySaved} grid index={startIndex + i} preview={preview} />
      ))}
    </div>
  );

  return (
    <AudioConfigContext.Provider value={cfg}>
      <div style={{ ...pageStyle, padding: sp.pad }}>
        <PageNoticeList notices={noticesAt("pageTop")} preview={preview} />

        {banner.url && (
          <div style={{ marginBottom: "20px" }}>
            <DoctrineBanner url={banner.url} settings={banner} />
          </div>
        )}

        <h1 style={pageTitle}>{title}</h1>
        {page.appearance.subtitle && <p style={pageSubtitle}>{page.appearance.subtitle}</p>}
        {describedCategories.length > 0 && (
          <div style={descBlock}>
            {describedCategories.map((c) => (
              <p key={c.id} style={descLine}>{describedCategories.length > 1 && <strong>{c.icon ? `${c.icon} ` : ""}{c.plural}: </strong>}{c.description}</p>
            ))}
          </div>
        )}

        <PageNoticeList notices={noticesAt("aboveFilters")} preview={preview} />

        <AudioFilterBar
          f={f}
          loading={loading}
          searchCfg={page.search}
          categories={pageCategories}
          view={view}
          onView={chooseView}
          showLiked={showLiked}
        />

        <PageNoticeList notices={noticesAt("aboveList")} preview={preview} />

        {sections.map((s) => (
          <section key={s.key} style={{ marginBottom: sp.section }}>
            <SectionHeader title={s.title} appearance={page.appearance} />
            {renderCards(s.items)}
          </section>
        ))}

        {loading && items.length === 0 && (
          <>
            {page.appearance.loadingMessage && <p style={loadingText} role="status">{page.appearance.loadingMessage}</p>}
            <SkeletonList label={page.appearance.loadingMessage || "Loading"} />
          </>
        )}
        {!loading && f.result.length === 0 && (
          <NoResults f={f} offlineNothing={!isOnline && items.length === 0} emptyMessage={page.appearance.emptyMessage} noResultsMessage={page.appearance.noResultsMessage} />
        )}

        <PlayAllBar items={f.result} filtered={f.chips.length > 0} />

        {groups.map((g, gi) => (
          <section key={g.key} style={{ marginBottom: g.title ? sp.section : 0 }}>
            {g.title && <SectionHeader title={g.title} description={page.appearance.showCategoryDescriptions ? g.category?.description : ""} appearance={page.appearance} />}
            {renderCards(g.items, groups.slice(0, gi).reduce((n, x) => n + x.items.length, 0))}
          </section>
        ))}

        {hasMore && (
          <div style={{ textAlign: "center", marginTop: "18px" }}>
            <button type="button" style={moreBtn} onClick={() => setShown((n) => n + pageSize)}>
              Show more ({mainList.length - slice.length} left)
            </button>
          </div>
        )}

        <PageNoticeList notices={noticesAt("belowList")} preview={preview} />
      </div>
    </AudioConfigContext.Provider>
  );
}

// Heading above a group of cards (a category, year, featured section…).
function SectionHeader({ title, description, appearance }) {
  const style = HEADER_STYLES[appearance.headerStyle] || HEADER_STYLES.plain;
  const center = appearance.headerAlign === "center";
  return (
    <div style={{ marginBottom: "14px", textAlign: center ? "center" : "left" }}>
      <h2 style={{ ...headerBase, ...style, ...(appearance.headerStyle === "pill" ? { display: "inline-block" } : null) }}>{title}</h2>
      {description && <p style={{ ...descLine, textAlign: center ? "center" : "left", marginTop: "6px" }}>{description}</p>}
    </div>
  );
}

const HEADER_STYLES = {
  plain: {},
  underline: { borderBottom: "2px solid var(--color-c97c2e)", paddingBottom: "6px" },
  band: { background: "var(--color-f4e7d4)", padding: "9px 14px", borderRadius: "10px" },
  pill: { background: "linear-gradient(135deg, var(--color-c97c2e), var(--color-a85e18))", color: "var(--color-fff8ee)", padding: "7px 18px", borderRadius: "999px", fontSize: "14px" },
};

const pageStyle = { maxWidth: "860px", margin: "0 auto", background: "var(--color-fdf8f3)", minHeight: "100vh", fontFamily: "'Georgia', serif", boxSizing: "border-box" };
const pageTitle = { textAlign: "center", marginBottom: "28px", fontSize: "28px", fontWeight: "normal", color: "var(--color-3d2200)" };
const pageSubtitle = { textAlign: "center", margin: "-18px 0 24px", fontSize: "14px", fontFamily: "sans-serif", color: "var(--color-9b7040)", lineHeight: 1.5 };
const descBlock = { margin: "-12px 0 20px", textAlign: "center" };
const descLine = { margin: "4px 0", fontSize: "13px", fontFamily: "sans-serif", color: "var(--color-7a5530)", lineHeight: 1.55 };
const headerBase = { margin: 0, fontSize: "18px", fontWeight: "normal", color: "var(--color-3d2200)", fontFamily: "'Georgia', serif" };
const loadingText = { textAlign: "center", fontFamily: "sans-serif", fontSize: "13px", color: "var(--color-9b7040)", margin: "0 0 12px" };
const moreBtn = { padding: "10px 22px", borderRadius: "999px", border: "1px solid var(--color-c8922a)", background: "transparent", color: "var(--color-7a4f10)", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
