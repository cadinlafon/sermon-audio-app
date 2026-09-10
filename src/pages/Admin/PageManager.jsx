import { useMemo, useState } from "react";
import { usePages } from "../../context/PagesContext";
import { useAuth } from "../../context/AuthContext";
import {
  STATUS_META,
  BADGE_COLORS,
  ACCESS_LEVELS,
  getDisplayName,
  isVisibleInNav,
  sortForNavigation,
  computePageStats,
} from "../../lib/pageManager";
import {
  quickUpdate,
  persistOrder,
  applyBulkAction,
  fetchAllUsers,
} from "../../lib/pageManagerFirestore";
import PageManagerEditor from "./PageManagerEditor";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "locked", label: "Locked" },
  { id: "hidden", label: "Hidden" },
  { id: "maintenance", label: "Maintenance" },
  { id: "coming-soon", label: "Coming Soon" },
  { id: "beta", label: "Beta" },
];

export default function PageManager() {
  const { pages, baseConfigs, rawDocsById, loading } = usePages();
  const { user, isAdmin } = useAuth();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [allUsers, setAllUsers] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirmBulk, setConfirmBulk] = useState(null);
  const [busy, setBusy] = useState(false);

  const stats = useMemo(() => computePageStats(pages || []), [pages]);

  const filtered = useMemo(() => {
    let list = sortForNavigation(pages || []);

    if (filter !== "all") {
      list = list.filter((p) => {
        if (filter === "hidden") return p.status === "hidden" || !isVisibleInNav(p);
        return p.status === filter;
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) => getDisplayName(p).toLowerCase().includes(q) || p.route.toLowerCase().includes(q)
      );
    }

    return list;
  }, [pages, filter, search]);

  const actor = user ? { uid: user.uid, email: user.email } : null;

  //////////////////////////////////////////////////
  // TOAST
  //////////////////////////////////////////////////
  const showToast = (message, isError) => {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 3000);
  };

  //////////////////////////////////////////////////
  // QUICK ACTIONS
  //////////////////////////////////////////////////
  const getBase = (id) => baseConfigs.find((p) => p.id === id);

  const toggleField = async (id, field, value) => {
    try {
      await quickUpdate(id, getBase(id), field, value, actor);
      showToast("Updated.");
    } catch (err) {
      console.error(err);
      showToast("Couldn't save that change.", true);
    }
  };

  const toggleLock = (page) => toggleField(page.id, "status", page.status === "locked" ? "active" : "locked");
  const toggleHidden = (page) => toggleField(page.id, "showInNavigation", !page.showInNavigation);
  const toggleEnabled = (page) => toggleField(page.id, "enabled", page.enabled === false);

  //////////////////////////////////////////////////
  // EDITOR
  //////////////////////////////////////////////////
  const openEditor = async (id) => {
    setEditingId(id);
    if (!allUsers) {
      try {
        setAllUsers(await fetchAllUsers());
      } catch (err) {
        console.error("Couldn't load users for access exceptions:", err);
        setAllUsers([]);
      }
    }
  };

  //////////////////////////////////////////////////
  // SELECTION / BULK ACTIONS
  //////////////////////////////////////////////////
  const toggleSelect = (id) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const toggleSelectAll = () => {
    if (selected.length === filtered.length) setSelected([]);
    else setSelected(filtered.map((p) => p.id));
  };

  const runBulkAction = async (action) => {
    setBusy(true);
    try {
      const baseById = {};
      selected.forEach((id) => { baseById[id] = getBase(id); });
      await applyBulkAction(selected, action, baseById, actor);
      showToast(`Bulk action applied to ${selected.length} page${selected.length === 1 ? "" : "s"}.`);
      setSelected([]);
      setConfirmBulk(null);
    } catch (err) {
      console.error(err);
      showToast("Bulk action failed.", true);
    } finally {
      setBusy(false);
    }
  };

  const DISRUPTIVE_ACTIONS = ["lock", "hide", "disable"];

  const requestBulkAction = (action) => {
    if (DISRUPTIVE_ACTIONS.includes(action)) {
      setConfirmBulk(action);
    } else {
      runBulkAction(action);
    }
  };

  //////////////////////////////////////////////////
  // REORDER
  //
  // A page can only reorder against pages that share both its
  // pinned state AND its nav slot (primary bar / more sheet /
  // account menu) — those are the only pages it ever appears
  // alongside in an actual nav list, so that's the only group
  // whose order values matter to it.
  //////////////////////////////////////////////////
  const reorderGroupOf = (list, page) =>
    list.filter((p) => p.pinned === page.pinned && p.navSlot === page.navSlot);

  const commitOrder = async (orderedIds) => {
    try {
      await persistOrder(orderedIds, rawDocsById);
      showToast("Order updated.");
    } catch (err) {
      console.error(err);
      showToast("Couldn't save the new order.", true);
    }
  };

  // Drag-and-drop — works on desktop pointer devices.
  const handleDrop = async (targetId) => {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }

    const list = sortForNavigation(pages || []);
    const dragged = list.find((p) => p.id === dragId);
    const target = list.find((p) => p.id === targetId);

    if (!dragged || !target || dragged.pinned !== target.pinned || dragged.navSlot !== target.navSlot) {
      setDragId(null);
      return;
    }

    const group = reorderGroupOf(list, dragged);
    const withoutDragged = group.filter((p) => p.id !== dragId);
    const targetIndex = withoutDragged.findIndex((p) => p.id === targetId);
    withoutDragged.splice(targetIndex, 0, dragged);

    setDragId(null);
    await commitOrder(withoutDragged.map((p) => p.id));
  };

  // Move up/down buttons — the reliable path on touch devices,
  // where native HTML5 drag-and-drop does not fire at all.
  const moveInGroup = async (page, direction) => {
    const list = sortForNavigation(pages || []);
    const group = reorderGroupOf(list, page);
    const index = group.findIndex((p) => p.id === page.id);
    const swapWith = index + direction;

    if (swapWith < 0 || swapWith >= group.length) return;

    [group[index], group[swapWith]] = [group[swapWith], group[index]];
    await commitOrder(group.map((p) => p.id));
  };

  //////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////

  if (loading) {
    return <p style={hintText}>Loading pages…</p>;
  }

  const editingPage = editingId ? baseConfigs.find((p) => p.id === editingId) : null;

  return (
    <div style={page}>
      <div style={pageHeader}>
        <h1 style={pageTitle}>Page Manager</h1>
        <p style={pageSubtitle}>
          Control navigation, availability, badges, and access for every page in the app.
        </p>
      </div>

      {/* STATS */}
      <div style={statsGrid}>
        <StatTile label="Total Pages" value={stats.total} icon="🧭" color="#c97c2e" />
        <StatTile label="Active" value={stats.active} icon="✅" color="#16a34a" />
        <StatTile label="Locked" value={stats.locked} icon="🔒" color="#b45309" />
        <StatTile label="Hidden" value={stats.hidden} icon="🙈" color="#6b7280" />
        <StatTile label="Coming Soon" value={stats.comingSoon} icon="🚀" color="#6547a5" />
        <StatTile label="Maintenance" value={stats.maintenance} icon="🔧" color="#b91c1c" />
        <StatTile label="Beta" value={stats.beta} icon="🧪" color="#2563eb" />
      </div>

      {/* TOOLBAR */}
      <div style={toolbar}>
        <input
          placeholder="Search by name or route…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={searchInput}
        />

        <div style={filterRow}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={filter === f.id ? { ...filterPill, ...filterPillActive } : filterPill}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* BULK ACTIONS */}
      {selected.length > 0 && (
        <div style={bulkBar}>
          <span style={bulkLabel}>{selected.length} selected</span>
          <div style={bulkActions}>
            <button style={bulkBtn} onClick={() => requestBulkAction("enable")}>Enable</button>
            <button style={bulkBtn} onClick={() => requestBulkAction("disable")}>Disable</button>
            <button style={bulkBtn} onClick={() => requestBulkAction("lock")}>Lock</button>
            <button style={bulkBtn} onClick={() => requestBulkAction("unlock")}>Unlock</button>
            <button style={bulkBtn} onClick={() => requestBulkAction("show")}>Show</button>
            <button style={bulkBtn} onClick={() => requestBulkAction("hide")}>Hide</button>
            <button style={bulkBtn} onClick={() => requestBulkAction("add-badge")}>+ Badge</button>
            <button style={bulkBtn} onClick={() => requestBulkAction("remove-badge")}>− Badge</button>
          </div>
        </div>
      )}

      {/* TABLE */}
      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th style={{ ...th, width: "36px" }}>
                <input
                  type="checkbox"
                  checked={selected.length > 0 && selected.length === filtered.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th style={th}>Page</th>
              <th style={th}>Status</th>
              <th style={th}>Nav</th>
              <th style={th}>Badge</th>
              <th style={th}>Access</th>
              <th style={th}>Order</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((p) => {
              const meta = STATUS_META[p.status] || STATUS_META.active;
              const badgeColors = p.badgeEnabled ? BADGE_COLORS[p.badgeColor] || BADGE_COLORS.amber : null;
              const accessLabel = ACCESS_LEVELS.find((a) => a.value === p.accessLevel)?.label || "Everyone";
              const group = reorderGroupOf(sortForNavigation(pages || []), p);
              const groupIndex = group.findIndex((g) => g.id === p.id);
              const isFirst = groupIndex <= 0;
              const isLast = groupIndex === -1 || groupIndex === group.length - 1;

              return (
                <tr
                  key={p.id}
                  style={tr}
                  draggable
                  onDragStart={() => setDragId(p.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(p.id)}
                >
                  <td style={td}>
                    <input
                      type="checkbox"
                      checked={selected.includes(p.id)}
                      onChange={() => toggleSelect(p.id)}
                    />
                  </td>

                  <td style={td}>
                    <div style={pageCell}>
                      <span style={dragHandle}>⋮⋮</span>
                      <span style={pageIcon}>
                        {p.icon?.startsWith("/") ? <img src={p.icon} alt="" style={{ width: 18, height: 18 }} /> : p.icon}
                      </span>
                      <div>
                        <div style={pageName}>
                          {getDisplayName(p)} {p.pinned && <span title="Pinned">📌</span>}
                        </div>
                        <div style={pageRoute}>{p.route}</div>
                      </div>
                    </div>
                  </td>

                  <td style={td}>
                    <span style={{ ...statusBadge, background: meta.bg, color: meta.color }}>
                      {meta.icon} {meta.label}
                    </span>
                    {p.enabled === false && <div style={disabledTag}>Disabled</div>}
                  </td>

                  <td style={td}>
                    <span style={p.showInNavigation ? navYes : navNo}>
                      {isVisibleInNav(p) ? "Visible" : "Hidden"}
                    </span>
                  </td>

                  <td style={td}>
                    {p.badgeEnabled && p.badgeText ? (
                      <span style={{ ...miniBadge, background: badgeColors.bg, color: badgeColors.color }}>
                        {p.badgeText}
                      </span>
                    ) : (
                      <span style={mutedText}>—</span>
                    )}
                  </td>

                  <td style={td}>
                    <span style={mutedText}>{accessLabel}</span>
                  </td>

                  <td style={td}>
                    <div style={orderCell}>
                      <button
                        style={isFirst ? { ...moveBtn, opacity: 0.35, cursor: "default" } : moveBtn}
                        disabled={isFirst}
                        onClick={() => moveInGroup(p, -1)}
                        title="Move up"
                      >
                        ▲
                      </button>
                      <span style={mutedText}>{p.order ?? 0}</span>
                      <button
                        style={isLast ? { ...moveBtn, opacity: 0.35, cursor: "default" } : moveBtn}
                        disabled={isLast}
                        onClick={() => moveInGroup(p, 1)}
                        title="Move down"
                      >
                        ▼
                      </button>
                    </div>
                  </td>

                  <td style={td}>
                    <div style={actionRow}>
                      <button style={actionBtn} onClick={() => openEditor(p.id)}>Edit</button>
                      <button style={actionBtn} onClick={() => toggleLock(p)}>
                        {p.status === "locked" ? "Unlock" : "Lock"}
                      </button>
                      <button style={actionBtn} onClick={() => toggleHidden(p)}>
                        {p.showInNavigation ? "Hide" : "Show"}
                      </button>
                      <button style={actionBtn} onClick={() => toggleEnabled(p)}>
                        {p.enabled === false ? "Enable" : "Disable"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && <p style={empty}>No pages match your filters.</p>}
      </div>

      {editingPage && (
        <PageManagerEditor
          page={editingPage}
          allUsers={allUsers}
          actor={actor}
          onClose={() => setEditingId(null)}
          onSaved={() => showToast("Saved successfully.")}
        />
      )}

      {confirmBulk && (
        <div style={confirmOverlay}>
          <div style={confirmBox}>
            <h3 style={confirmTitle}>
              {confirmBulk === "lock" && `Lock ${selected.length} page(s)?`}
              {confirmBulk === "hide" && `Hide ${selected.length} page(s) from navigation?`}
              {confirmBulk === "disable" && `Disable ${selected.length} page(s)?`}
            </h3>
            <p style={confirmText}>
              This will affect real visitors immediately. You can undo it from Page Manager at any time.
            </p>
            <div style={confirmActions}>
              <button style={cancelBtn} onClick={() => setConfirmBulk(null)}>Cancel</button>
              <button style={dangerBtn} onClick={() => runBulkAction(confirmBulk)} disabled={busy}>
                {busy ? "Applying…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={toast.isError ? { ...toastBox, ...toastError } : toastBox}>
          {toast.message}
        </div>
      )}

      {!isAdmin && (
        <p style={hintText}>You need admin access to make changes here.</p>
      )}
    </div>
  );
}

function StatTile({ label, value, icon, color }) {
  return (
    <div style={statCard}>
      <div style={{ ...statIconWrap, background: color + "18", color }}>{icon}</div>
      <div style={statLabel}>{label}</div>
      <div style={statValue}>{value}</div>
    </div>
  );
}

////////////////////////////////////////////////////////////////
// STYLES
////////////////////////////////////////////////////////////////

const page = { maxWidth: "1200px" };
const pageHeader = { marginBottom: "24px" };
const pageTitle = { fontSize: "26px", fontWeight: "normal", color: "#3d2200", margin: "0 0 4px", fontFamily: "'Georgia', serif" };
const pageSubtitle = { fontSize: "14px", color: "#9b7040", fontFamily: "sans-serif", margin: 0 };

const statsGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "14px", marginBottom: "24px" };
const statCard = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "14px", padding: "16px", boxShadow: "0 2px 10px rgba(160,100,40,0.06)" };
const statIconWrap = { width: "34px", height: "34px", borderRadius: "9px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", marginBottom: "8px" };
const statLabel = { fontSize: "11px", fontFamily: "sans-serif", color: "#9b7040", marginBottom: "4px" };
const statValue = { fontSize: "24px", fontWeight: "bold", color: "#3d2200", fontFamily: "sans-serif" };

const toolbar = { display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" };
const searchInput = { padding: "9px 14px", borderRadius: "10px", border: "1px solid #eddfc8", background: "#fffdf9", fontSize: "13px", fontFamily: "sans-serif", color: "#3d2200", outline: "none", width: "320px", maxWidth: "100%" };
const filterRow = { display: "flex", gap: "8px", flexWrap: "wrap" };
const filterPill = { padding: "6px 14px", borderRadius: "999px", border: "1px solid #eddfc8", background: "#fdf8f3", color: "#7a4f10", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer" };
const filterPillActive = { background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", border: "none" };

const bulkBar = { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", background: "#fdf1de", border: "1px solid #e0a458", borderRadius: "12px", padding: "10px 16px", marginBottom: "16px" };
const bulkLabel = { fontSize: "13px", fontFamily: "sans-serif", color: "#7a4f10", fontWeight: "600" };
const bulkActions = { display: "flex", gap: "6px", flexWrap: "wrap" };
const bulkBtn = { padding: "6px 12px", borderRadius: "8px", border: "1px solid #e0a458", background: "#fffdf9", color: "#7a4f10", fontSize: "11px", fontFamily: "sans-serif", cursor: "pointer" };

const tableWrap = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "16px", overflow: "auto", boxShadow: "0 2px 12px rgba(160,100,40,0.07)" };
const table = { width: "100%", borderCollapse: "collapse", minWidth: "1000px" };
const th = { padding: "12px 16px", textAlign: "left", fontSize: "11px", fontFamily: "sans-serif", color: "#9b7040", letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: "1px solid #eddfc8", background: "#fdf8f3" };
const tr = { borderBottom: "1px solid #f0e4d0", cursor: "grab" };
const td = { padding: "12px 16px", verticalAlign: "middle" };

const pageCell = { display: "flex", alignItems: "center", gap: "10px" };
const dragHandle = { color: "#d8c4a5", fontSize: "12px", cursor: "grab" };
const pageIcon = { fontSize: "16px", display: "inline-flex", alignItems: "center" };
const pageName = { fontSize: "14px", fontFamily: "'Georgia', serif", color: "#3d2200" };
const pageRoute = { fontSize: "11px", fontFamily: "sans-serif", color: "#b08050" };

const statusBadge = { fontSize: "11px", padding: "3px 9px", borderRadius: "999px", fontFamily: "sans-serif", whiteSpace: "nowrap" };
const disabledTag = { fontSize: "10px", color: "#991b1b", fontFamily: "sans-serif", marginTop: "4px" };
const navYes = { fontSize: "12px", color: "#166534", fontFamily: "sans-serif" };
const navNo = { fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif" };
const miniBadge = { fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "999px", fontFamily: "sans-serif" };
const mutedText = { fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif" };

const orderCell = { display: "flex", alignItems: "center", gap: "6px" };
const moveBtn = { width: "22px", height: "22px", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, borderRadius: "6px", border: "1px solid #eddfc8", background: "#fdf8f3", color: "#7a4f10", fontSize: "9px", cursor: "pointer" };

const actionRow = { display: "flex", gap: "6px", flexWrap: "wrap" };
const actionBtn = { padding: "5px 10px", borderRadius: "8px", border: "1px solid #eddfc8", background: "transparent", color: "#5c3a1e", fontSize: "11px", fontFamily: "sans-serif", cursor: "pointer" };

const empty = { textAlign: "center", color: "#b08050", fontFamily: "sans-serif", fontStyle: "italic", padding: "30px" };
const hintText = { fontSize: "12px", color: "#b08050", fontFamily: "sans-serif" };

const confirmOverlay = { position: "fixed", inset: 0, background: "rgba(40,18,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3100, padding: "20px" };
const confirmBox = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "16px", padding: "24px", maxWidth: "420px", width: "100%" };
const confirmTitle = { fontSize: "16px", color: "#3d2200", fontFamily: "'Georgia', serif", margin: "0 0 10px" };
const confirmText = { fontSize: "13px", color: "#7a5530", fontFamily: "sans-serif", lineHeight: 1.6, margin: "0 0 18px" };
const confirmActions = { display: "flex", justifyContent: "flex-end", gap: "10px" };
const cancelBtn = { padding: "9px 16px", borderRadius: "10px", border: "1px solid #eddfc8", background: "transparent", color: "#7a4f10", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
const dangerBtn = { padding: "9px 18px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #d65f5f, #a83232)", color: "#fff8ee", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };

const toastBox = { position: "fixed", bottom: "24px", right: "24px", background: "#166534", color: "#fff", padding: "12px 18px", borderRadius: "10px", fontSize: "13px", fontFamily: "sans-serif", boxShadow: "0 4px 16px rgba(0,0,0,0.2)", zIndex: 4000 };
const toastError = { background: "#991b1b" };
