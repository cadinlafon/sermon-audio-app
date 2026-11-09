import { useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { usePermissions } from "../../hooks/usePermissions";
import { useAuth } from "../../context/AuthContext";
import { ADMIN_MODULES, NO_ACCESS_MESSAGE } from "../../config/adminModules";
import { applyOrder, defaultSections, extId, TOP_LEVEL } from "../../config/adminNav";
import useAdminNavLayout from "../../hooks/useAdminNavLayout";
import { useAnalyticsPages } from "../../utils/analyticsPages";
import { useUnseenReportCount } from "../../utils/problemReports";

////////////////////////////////////////////////////////////////
// ADMIN SIDEBAR NAV
//
// Dashboard on top, then pinned pages, then collapsible sections. Each admin
// can collapse sections, pin pages (hover a page → 📌), and drag to reorder
// the pinned pages, the pages inside a section, and the sections themselves.
// The arrangement is remembered on this device (see useAdminNavLayout).
// Keyboard: focus a page and press Alt+↑ / Alt+↓ to move it.
////////////////////////////////////////////////////////////////

const PinIcon = ({ filled }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 17v5" />
    <path d="M9 3h6l-1 7 3 3v2H7v-2l3-3-1-7z" />
  </svg>
);

export default function AdminSidebarNav() {
  const location = useLocation();
  const { user } = useAuth();
  const { canView, permissions, isAdmin } = usePermissions();
  const externalPages = useAnalyticsPages();
  // Red dot on the Reports button while any problem report hasn't been opened.
  const unseenReports = useUnseenReportCount(canView("reports"));
  const nav = useAdminNavLayout(user?.uid);
  const { layout } = nav;

  // id → what to render
  const items = useMemo(() => {
    const map = {};
    ADMIN_MODULES.forEach((m) => { map[m.key] = { id: m.key, to: `/admin/${m.path}`, label: m.label, icon: m.icon, accessible: canView(m.key), pinnable: true }; });
    externalPages.forEach((p) => { map[extId(p.id)] = { id: extId(p.id), href: p.url, label: p.label, icon: "📈", accessible: true, external: true }; });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalPages, permissions, isAdmin]);

  const sections = useMemo(() => {
    const defs = defaultSections(ADMIN_MODULES, externalPages);
    const byId = Object.fromEntries(defs.map((s) => [s.id, s]));
    return applyOrder(layout.sectionOrder, defs.map((s) => s.id)).map((id) => ({
      ...byId[id],
      items: applyOrder(layout.itemOrder[id], byId[id].items),
    }));
  }, [externalPages, layout.sectionOrder, layout.itemOrder]);

  const pinned = layout.pinned.filter((id) => items[id]?.pinnable);
  const dashboard = items[TOP_LEVEL[0]];

  // ── drag and drop ────────────────────────────────────────────────────────
  const drag = useRef(null); // { kind: "pin" | "item" | "section", id, section? }
  const [mark, setMark] = useState(null); // { key, pos } — where a drop would land
  const half = (e) => { const r = e.currentTarget.getBoundingClientRect(); return e.clientY > r.top + r.height / 2 ? "after" : "before"; };

  const dragProps = (kind, id, section) => ({
    draggable: true,
    onDragStart: (e) => {
      drag.current = { kind, id, section };
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", id); } catch { /* some browsers */ }
      e.stopPropagation();
    },
    onDragEnd: () => { drag.current = null; setMark(null); },
  });
  const dropProps = (kind, id, section, onDrop) => ({
    onDragOver: (e) => {
      const d = drag.current;
      if (!d || d.kind !== kind || (kind === "item" && d.section !== section) || d.id === id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const pos = half(e);
      setMark((m) => (m && m.key === `${kind}:${id}` && m.pos === pos ? m : { key: `${kind}:${id}`, pos }));
    },
    onDrop: (e) => {
      const d = drag.current;
      if (!d || d.kind !== kind || (kind === "item" && d.section !== section) || d.id === id) return;
      e.preventDefault();
      onDrop(d.id, half(e) === "after");
      drag.current = null;
      setMark(null);
    },
  });
  const markStyle = (kind, id) => (mark?.key === `${kind}:${id}` ? (mark.pos === "after" ? dropAfter : dropBefore) : null);

  const keyboardMove = (e, list, id, apply) => {
    if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    e.preventDefault();
    const i = list.indexOf(id);
    const j = e.key === "ArrowUp" ? i - 1 : i + 1;
    if (j < 0 || j >= list.length) return;
    apply(list[j], e.key === "ArrowDown");
  };

  // ── rows ─────────────────────────────────────────────────────────────────
  // A plain function (not a component): it must not remount while a drag is in progress.
  const renderRow = ({ item, kind, section, list, apply }) => {
    const active = item.accessible && !item.external && location.pathname.startsWith(item.to);
    const isPinned = layout.pinned.includes(item.id);
    const style = !item.accessible ? { ...link, ...linkDisabled } : active ? { ...link, ...linkActive } : link;
    const body = (
      <>
        <span style={linkIcon}>{item.icon}</span>
        <span style={labelText}>{item.label}</span>
        {item.external && <span style={externalMark} aria-hidden="true">↗</span>}
        {!item.external && item.id === "reports" && unseenReports > 0 && <span style={unseenDot} role="status" aria-label={`${unseenReports} unopened ${unseenReports === 1 ? "report" : "reports"}`} />}
        {!item.external && active && !(item.id === "reports" && unseenReports > 0) && <span className="pf-nav-dot" style={activeDot} />}
      </>
    );
    const props = { ...(kind ? dragProps(kind, item.id, section) : {}), ...(kind ? dropProps(kind, item.id, section, (id, after) => apply(id, item.id, after)) : {}) };
    return (
      <div key={`${kind || "top"}:${item.id}`} className="pf-nav-row" style={{ ...rowWrap, ...(kind ? markStyle(kind, item.id) : null) }} {...props}>
        {item.external ? (
          <a href={item.href} target="_blank" rel="noopener noreferrer" draggable={false} style={style} onKeyDown={kind ? (e) => keyboardMove(e, list, item.id, (t, a) => apply(item.id, t, a)) : undefined}>{body}</a>
        ) : (
          <Link to={item.to} draggable={false} title={item.accessible ? undefined : NO_ACCESS_MESSAGE} style={style} onKeyDown={kind ? (e) => keyboardMove(e, list, item.id, (t, a) => apply(item.id, t, a)) : undefined}>{body}</Link>
        )}
        {item.pinnable && item.accessible && (
          <button type="button" className={`pf-nav-pin${isPinned ? " is-pinned" : ""}`} onClick={() => nav.togglePin(item.id)} aria-pressed={isPinned} aria-label={`${isPinned ? "Unpin" : "Pin"} ${item.label}`} title={isPinned ? "Unpin" : "Pin to top"}>
            <PinIcon filled={isPinned} />
          </button>
        )}
      </div>
    );
  };

  const sectionIds = sections.map((s) => s.id);

  return (
    <nav style={navStyle} aria-label="Admin">
      <style>{CSS}</style>

      {dashboard && renderRow({ item: dashboard })}

      {pinned.length > 0 && (
        <div style={pinnedBlock}>
          <div style={pinnedLabel}>Pinned</div>
          {pinned.map((id) => renderRow({ item: items[id], kind: "pin", list: pinned, apply: (dragId, targetId, after) => nav.movePinned(dragId, targetId, after, pinned) }))}
        </div>
      )}

      {sections.map((s) => {
        const collapsed = !!layout.collapsed[s.id];
        const visible = s.items.filter((id) => items[id]);
        const hasActive = visible.some((id) => items[id].accessible && !items[id].external && location.pathname.startsWith(items[id].to));
        return (
          <div key={s.id} style={sectionWrap}>
            <div
              className="pf-nav-head"
              style={{ ...sectionHead, ...markStyle("section", s.id) }}
              {...dragProps("section", s.id)}
              {...dropProps("section", s.id, null, (id, after) => nav.moveSection(id, s.id, after, sectionIds))}
              onKeyDown={(e) => keyboardMove(e, sectionIds, s.id, (t, a) => nav.moveSection(s.id, t, a, sectionIds))}
            >
              <button type="button" onClick={() => nav.toggleCollapsed(s.id)} aria-expanded={!collapsed} style={sectionBtn}>
                <span style={chevron} aria-hidden="true">{collapsed ? "▸" : "▾"}</span>
                <span>{s.title}</span>
                {collapsed && hasActive && <span style={{ ...activeDot, marginLeft: "auto" }} aria-label="Contains the current page" />}
              </button>
            </div>
            {!collapsed && (
              <div style={sectionBody}>
                {visible.map((id) => renderRow({ item: items[id], kind: "item", section: s.id, list: visible, apply: (dragId, targetId, after) => nav.moveItem(s.id, dragId, targetId, after, visible) }))}
              </div>
            )}
          </div>
        );
      })}

      <button type="button" onClick={nav.reset} style={resetBtn}>Reset sidebar layout</button>
    </nav>
  );
}

const CSS = `
.pf-nav-row .pf-nav-pin { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border: none; border-radius: 7px; background: rgba(42,21,0,0.85); color: rgba(255,220,160,0.85); cursor: pointer; opacity: 0; transition: opacity 0.12s; padding: 0; }
.pf-nav-row:hover .pf-nav-pin, .pf-nav-row:focus-within .pf-nav-pin { opacity: 1; }
.pf-nav-row .pf-nav-pin.is-pinned { color: var(--color-e08930); }
.pf-nav-row .pf-nav-pin:hover { background: rgba(224,137,48,0.35); }
.pf-nav-row:hover .pf-nav-dot { opacity: 0; }
.pf-nav-row[draggable="true"] { cursor: grab; }
.pf-nav-head[draggable="true"] { cursor: grab; }
.pf-nav-head:hover { background: rgba(255,255,255,0.04); }
`;

const dropBefore = { boxShadow: "0 -2px 0 0 var(--color-e08930)" };
const dropAfter = { boxShadow: "0 2px 0 0 var(--color-e08930)" };

const navStyle = { display: "flex", flexDirection: "column", gap: "2px", padding: "0 12px", flex: 1 };
const rowWrap = { position: "relative", borderRadius: "10px" };
const link = { display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "10px", fontSize: "13px", color: "rgba(255,220,160,0.7)", textDecoration: "none", fontFamily: "sans-serif", transition: "background 0.15s", position: "relative" };
const linkActive = { background: "rgba(224,137,48,0.18)", color: "var(--color-fde8b8)" };
const linkDisabled = { color: "rgba(255,220,160,0.28)", cursor: "not-allowed" };
const linkIcon = { fontSize: "16px", width: "20px", textAlign: "center", flexShrink: 0 };
const labelText = { minWidth: 0 };
const externalMark = { marginLeft: "auto", fontSize: "11px", opacity: 0.6, paddingRight: "22px" };
const unseenDot = { marginLeft: "auto", minWidth: "9px", height: "9px", borderRadius: "50%", background: "var(--color-dc2626)", boxShadow: "0 0 0 2px rgba(239,68,68,0.28)" };
const activeDot = { marginLeft: "auto", width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-e08930)", transition: "opacity 0.12s" };
const pinnedBlock = { display: "flex", flexDirection: "column", gap: "2px", margin: "6px 0 2px", paddingBottom: "8px", borderBottom: "1px solid rgba(255,220,160,0.12)" };
const pinnedLabel = { padding: "6px 12px 4px", fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,210,140,0.45)", fontFamily: "sans-serif" };
const sectionWrap = { marginTop: "8px" };
const sectionHead = { borderRadius: "8px" };
const sectionBtn = { display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "8px 12px", background: "none", border: "none", cursor: "inherit", fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,210,140,0.6)", fontFamily: "sans-serif", textAlign: "left" };
const chevron = { fontSize: "10px", width: "10px", opacity: 0.8 };
const sectionBody = { display: "flex", flexDirection: "column", gap: "2px" };
const resetBtn = { margin: "14px 4px 8px", padding: "6px 8px", background: "none", border: "none", color: "rgba(255,210,140,0.35)", fontSize: "11px", fontFamily: "sans-serif", cursor: "pointer", textAlign: "left" };
