import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { db } from "../../firebase";
import { useShutdown } from "../../context/ShutdownContext";
import { useModulePermissions } from "../../hooks/usePermissions";
import { logAdminAction } from "../../utils/adminAudit";
import { PAGE_KEYS, PAGE_META, defaultPage, sanitizeAudioPages } from "../../data/audioPageDefaults";
import { Button } from "./audioPages/ui";
import Preview from "./audioPages/Preview";
import LayoutSection from "./audioPages/sections/LayoutSection";
import AppearanceSection from "./audioPages/sections/AppearanceSection";
import NoticesSection from "./audioPages/sections/NoticesSection";
import FeaturedSection from "./audioPages/sections/FeaturedSection";
import SearchSection from "./audioPages/sections/SearchSection";
import CategoriesSection from "./audioPages/sections/CategoriesSection";
import PlaybackSection from "./audioPages/sections/PlaybackSection";
import AdvancedSection from "./audioPages/sections/AdvancedSection";

////////////////////////////////////////////////////////////////
// AUDIO PAGE MANAGER
//
// One place to control how the Sermons and Sunday School pages look and
// behave. Everything except notices is a DRAFT until you press Save; the
// live preview on the right renders the real page from that draft.
// Stored as one `audioPages` object on appConfig/status.
////////////////////////////////////////////////////////////////

const TABS = [
  { id: "layout", label: "Layout & Cards", perPage: true },
  { id: "appearance", label: "Appearance", perPage: true },
  { id: "notices", label: "Notices", perPage: true },
  { id: "featured", label: "Featured", perPage: true },
  { id: "search", label: "Search & Filters", perPage: true },
  { id: "categories", label: "Categories", perPage: false },
  { id: "playback", label: "Playback", perPage: false },
  { id: "advanced", label: "Advanced", perPage: false },
];

const clone = (v) => JSON.parse(JSON.stringify(v));

export default function AudioPageManager() {
  const perms = useModulePermissions("audioPages");
  const { audioPages, configLoaded } = useShutdown();
  const saved = useMemo(() => sanitizeAudioPages(audioPages), [audioPages]);

  const [draft, setDraft] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [pageKey, setPageKey] = useState("sermons");
  const [tab, setTab] = useState("layout");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [notices, setNotices] = useState([]);

  // Start from what's saved once it has loaded (and never clobber edits).
  useEffect(() => {
    if (configLoaded && !draft) { setDraft(clone(saved)); setBaseline(JSON.stringify(saved)); }
  }, [configLoaded, saved, draft]);

  const dirty = !!draft && JSON.stringify(draft) !== baseline;
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // The recordings for the page being edited (one read per page switch).
  useEffect(() => {
    let cancelled = false;
    setItemsLoading(true);
    getDocs(query(collection(db, "audio"), where("type", "in", PAGE_META[pageKey].categories)))
      .then((snap) => {
        if (cancelled) return;
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        data.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setItems(data);
      })
      .catch((err) => { console.error("Couldn't load recordings for the preview", err); if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setItemsLoading(false); });
    return () => { cancelled = true; };
  }, [pageKey]);

  const loadNotices = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, "pageNotices"));
      setNotices(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error("Couldn't load notices", err); }
  }, []);
  useEffect(() => { loadNotices(); }, [loadNotices]);

  if (perms.loading || !configLoaded || !draft) return <div style={loadingStyle}>Loading…</div>;

  const page = draft.pages[pageKey];
  const canEdit = perms.canEdit;
  const setPage = (fn) => setDraft((d) => ({ ...d, pages: { ...d.pages, [pageKey]: typeof fn === "function" ? fn(d.pages[pageKey]) : fn } }));
  const up = (section, key, value) => setPage((p) => ({ ...p, [section]: { ...p[section], [key]: value } }));
  const upPlayback = (key, value) => setDraft((d) => ({ ...d, playback: { ...d.playback, [key]: value } }));
  const upAdvanced = (key, value) => setDraft((d) => ({ ...d, advanced: { ...d.advanced, [key]: value } }));
  const setAdvanced = (fn) => setDraft((d) => ({ ...d, advanced: typeof fn === "function" ? fn(d.advanced) : fn }));
  const setCategories = (fn) => setDraft((d) => ({ ...d, categories: typeof fn === "function" ? fn(d.categories) : fn }));
  const setFeatured = (id) => setDraft((d) => ({ ...d, featuredCategory: id }));

  const save = async () => {
    if (!perms.requireEdit()) return;
    setSaving(true);
    setMessage("");
    try {
      // Round-trip through the sanitizer so only valid, bounded values are stored.
      const clean = clone(sanitizeAudioPages(draft));
      await updateDoc(doc(db, "appConfig", "status"), { audioPages: clean });
      logAdminAction({
        category: "settings_change",
        action: "saveAudioPages",
        targetType: "appConfig",
        targetId: "status",
        targetLabel: "Audio Page Manager",
        before: JSON.parse(baseline),
        after: clean,
      });
      setDraft(clone(clean));
      setBaseline(JSON.stringify(clean));
      setMessage("Saved ✓");
      setTimeout(() => setMessage(""), 3500);
    } catch (err) {
      console.error("Couldn't save the Audio Page Manager settings", err);
      setMessage("Couldn't save. Please try again.");
    }
    setSaving(false);
  };

  const discard = () => {
    if (dirty && !window.confirm("Throw away your unsaved changes?")) return;
    setDraft(JSON.parse(baseline));
  };
  const resetPage = () => {
    if (!window.confirm(`Reset every setting for ${PAGE_META[pageKey].label} (layout, appearance, featured, search) back to the defaults? Categories, playback and advanced settings aren't touched. You can still Discard before saving.`)) return;
    setPage(defaultPage(pageKey));
  };

  const current = TABS.find((t) => t.id === tab);
  const body = (() => {
    switch (tab) {
      case "layout": return <LayoutSection page={page} up={up} setPage={setPage} canEdit={canEdit} />;
      case "appearance": return <AppearanceSection page={page} pageKey={pageKey} categories={draft.categories} featuredCategory={draft.featuredCategory} up={up} setPage={setPage} canEdit={canEdit} />;
      case "notices": return <NoticesSection notices={notices} reload={loadNotices} perms={perms} />;
      case "featured": return <FeaturedSection page={page} setPage={setPage} items={items} canEdit={canEdit} />;
      case "search": return <SearchSection page={page} up={up} setPage={setPage} canEdit={canEdit} />;
      case "categories": return <CategoriesSection categories={draft.categories} featuredCategory={draft.featuredCategory} setCategories={setCategories} setFeatured={setFeatured} canEdit={canEdit} />;
      case "playback": return <PlaybackSection playback={draft.playback} upPlayback={upPlayback} canEdit={canEdit} />;
      case "advanced": return <AdvancedSection advanced={draft.advanced} upAdvanced={upAdvanced} setAdvanced={setAdvanced} page={page} up={up} canEdit={canEdit} pageLabel={PAGE_META[pageKey].label} />;
      default: return null;
    }
  })();

  return (
    <div style={wrap}>
      <style>{`
        .apm-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; align-items: start; }
        @media (min-width: 1100px) { .apm-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } .apm-preview { position: sticky; top: 12px; } }
      `}</style>

      <h1 style={h1}>🎛️ Audio Page Manager</h1>
      <p style={sub}>Control how the Sermons and Sunday School pages look and behave. Changes show in the preview straight away and go live when you press <strong>Save</strong>. Visitors can still pick their own sort, view and playback speed.</p>

      <div style={topBar}>
        <div style={pageSwitch} role="tablist" aria-label="Page">
          {PAGE_KEYS.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={k === pageKey} onClick={() => setPageKey(k)} style={k === pageKey ? { ...pageBtn, ...pageBtnOn } : pageBtn}>{PAGE_META[k].label}</button>
          ))}
        </div>
        <div style={saveGroup}>
          {message && <span style={message.startsWith("Saved") ? okMsg : badMsg} role="status">{message}</span>}
          {dirty && !message && <span style={dirtyMsg}>Unsaved changes</span>}
          {canEdit && <Button onClick={resetPage}>Reset page</Button>}
          {canEdit && <Button onClick={discard} disabled={!dirty || saving}>Discard</Button>}
          {canEdit && <Button kind="primary" onClick={save} disabled={!dirty || saving}>{saving ? "Saving…" : "Save changes"}</Button>}
        </div>
      </div>
      {!canEdit && <p style={viewOnly}>You have view-only access — you can look around, but not save changes.</p>}

      <div style={tabsRow} role="tablist" aria-label="Settings">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={t.id === tab} onClick={() => setTab(t.id)} style={t.id === tab ? { ...tabBtn, ...tabOn } : tabBtn}>{t.label}</button>
        ))}
      </div>
      {!current.perPage && <p style={scopeNote}>These settings apply to <strong>both</strong> audio pages.</p>}

      <div className="apm-grid">
        <div style={{ minWidth: 0 }}>{body}</div>
        <div className="apm-preview" style={{ minWidth: 0 }}>
          <Preview draft={draft} pageKey={pageKey} items={items} loading={itemsLoading} notices={notices} />
        </div>
      </div>
    </div>
  );
}

const wrap = { maxWidth: "1400px", margin: "0 auto", padding: "24px 16px 60px", fontFamily: "sans-serif" };
const loadingStyle = { padding: "40px", textAlign: "center", color: "var(--color-9b7040)", fontFamily: "sans-serif" };
const h1 = { margin: "0 0 6px", fontSize: "22px", fontWeight: "600", color: "var(--color-3d2200)" };
const sub = { margin: "0 0 16px", fontSize: "13.5px", color: "var(--color-7a5530)", lineHeight: 1.55, maxWidth: "760px" };
const topBar = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "12px" };
const pageSwitch = { display: "flex", gap: "4px", padding: "4px", background: "var(--color-f4e7d4)", borderRadius: "999px" };
const pageBtn = { padding: "7px 16px", borderRadius: "999px", border: "none", background: "transparent", color: "var(--color-7a4f10)", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
const pageBtnOn = { background: "var(--color-fffdf9)", fontWeight: "600", boxShadow: "0 1px 4px rgba(0,0,0,0.12)" };
const saveGroup = { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" };
const okMsg = { fontSize: "13px", color: "var(--color-2f8a4a)" };
const badMsg = { fontSize: "13px", color: "var(--color-b3432c)" };
const dirtyMsg = { fontSize: "12.5px", color: "var(--color-9b7040)" };
const viewOnly = { margin: "0 0 12px", padding: "9px 12px", borderRadius: "10px", background: "var(--color-f6e4b0)", color: "var(--color-7a5a10)", fontSize: "13px" };
const tabsRow = { display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "6px", marginBottom: "12px" };
const tabBtn = { flexShrink: 0, padding: "8px 14px", borderRadius: "10px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fffdf9)", color: "var(--color-7a4f10)", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
const tabOn = { background: "linear-gradient(135deg, var(--color-c97c2e), var(--color-a85e18))", color: "var(--color-fff8ee)", border: "1px solid transparent", fontWeight: "600" };
const scopeNote = { margin: "0 0 12px", fontSize: "12.5px", color: "var(--color-9b7040)" };
