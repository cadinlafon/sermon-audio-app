import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { ADMIN_ACTION_CATEGORIES, fetchRetentionDays, setRetentionDays, purgeAdminActionsOlderThan } from "../../utils/adminAudit";
import { downloadJson } from "../../utils/userAdmin";
import { useModulePermissions } from "../../hooks/usePermissions";

const CATEGORY_COLORS = {
  role_change: { bg: "#eee8ff", color: "#6547a5" },
  account_disable: { bg: "#fef3c7", color: "#92400e" },
  account_delete: { bg: "#fee2e2", color: "#991b1b" },
  content_edit: { bg: "#e8f0fe", color: "#2a5ab5" },
  content_delete: { bg: "#fee2e2", color: "#991b1b" },
  settings_change: { bg: "#dcfce7", color: "#166534" },
};

const categoryStyle = (category) => CATEGORY_COLORS[category] || { bg: "#f0e4d0", color: "#5c3a1e" };

export default function AdminActionsLog() {
  const perms = useModulePermissions("logs");

  const [actions, setActions] = useState([]);
  const [adminMap, setAdminMap] = useState({});
  const [expandedId, setExpandedId] = useState(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [adminFilter, setAdminFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [days, setDays] = useState(7);
  const [sortBy, setSortBy] = useState("newest");

  // Retention
  const [retentionDays, setRetentionDaysState] = useState(0);
  const [retentionInput, setRetentionInput] = useState("");
  const [savingRetention, setSavingRetention] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState(null);

  //////////////////////////////////////////////////
  // LOAD ADMINS (for display names)
  //////////////////////////////////////////////////

  useEffect(() => {
    const loadAdmins = async () => {
      try {
        const snap = await getDocs(collection(db, "users"));
        const map = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          map[d.id] = data.fullName || data.name || data.email || d.id;
        });
        setAdminMap(map);
      } catch (err) {
        console.error("Could not load admins:", err);
      }
    };
    loadAdmins();
  }, []);

  //////////////////////////////////////////////////
  // LOAD ADMIN ACTIONS
  //////////////////////////////////////////////////

  useEffect(() => {
    return onSnapshot(collection(db, "adminActions"), (snapshot) => {
      setActions(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  //////////////////////////////////////////////////
  // LOAD RETENTION SETTING
  //////////////////////////////////////////////////

  useEffect(() => {
    fetchRetentionDays().then((d) => {
      setRetentionDaysState(d);
      setRetentionInput(d ? String(d) : "");
    });
  }, []);

  //////////////////////////////////////////////////
  // HELPERS
  //////////////////////////////////////////////////

  const getDate = (a) => (a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) : null);
  const formatDateTime = (a) => {
    const d = getDate(a);
    return d ? d.toLocaleString() : "—";
  };
  const getAdminName = (a) => a.adminName || adminMap[a.adminId] || a.adminEmail || a.adminId || "Unknown";

  const adminOptions = useMemo(() => {
    const ids = [...new Set(actions.map((a) => a.adminId).filter(Boolean))];
    return ids
      .map((id) => ({ id, name: adminMap[id] || id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [actions, adminMap]);

  const categoryOptions = useMemo(
    () => [...new Set(actions.map((a) => a.category).filter(Boolean))].sort(),
    [actions]
  );

  //////////////////////////////////////////////////
  // FILTER + SORT
  //////////////////////////////////////////////////

  const filtered = useMemo(() => {
    const now = new Date();

    const result = actions.filter((a) => {
      const date = getDate(a);

      if (dateFilter !== "all") {
        if (!date) return false;
        if (dateFilter === "today" && date.toDateString() !== now.toDateString()) return false;
        if (dateFilter === "lastX") {
          const past = new Date();
          past.setDate(past.getDate() - Number(days || 7));
          if (date < past) return false;
        }
      }

      if (categoryFilter !== "all" && a.category !== categoryFilter) return false;
      if (adminFilter !== "all" && a.adminId !== adminFilter) return false;

      if (search.trim()) {
        const s = search.trim().toLowerCase();
        const searchable = [
          a.action,
          a.category,
          a.targetLabel,
          a.targetType,
          a.targetId,
          getAdminName(a),
          a.adminEmail,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!searchable.includes(s)) return false;
      }

      return true;
    });

    result.sort((a, b) => {
      const aT = a.createdAt?.seconds || 0;
      const bT = b.createdAt?.seconds || 0;
      return sortBy === "oldest" ? aT - bT : bT - aT;
    });

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, search, categoryFilter, adminFilter, dateFilter, days, sortBy, adminMap]);

  //////////////////////////////////////////////////
  // EXPORT
  //////////////////////////////////////////////////

  const handleExport = () => {
    const data = filtered.map((a) => ({
      ...a,
      createdAt: getDate(a)?.toISOString() || null,
      adminName: getAdminName(a),
    }));
    downloadJson(data, `admin-actions-${new Date().toISOString().slice(0, 10)}.json`);
  };

  //////////////////////////////////////////////////
  // RETENTION
  //////////////////////////////////////////////////

  const saveRetention = async () => {
    if (!perms.requireEdit()) return;
    setSavingRetention(true);
    try {
      const value = Number(retentionInput) || 0;
      await setRetentionDays(value);
      setRetentionDaysState(value);
    } finally {
      setSavingRetention(false);
    }
  };

  const handlePurge = async () => {
    if (!perms.requireEdit()) return;
    if (!retentionDays) {
      alert("Set a retention period first — 0 means logs are kept forever.");
      return;
    }
    if (!window.confirm(`Permanently delete admin action logs older than ${retentionDays} day${retentionDays === 1 ? "" : "s"}? This can't be undone.`)) return;
    setPurging(true);
    setPurgeResult(null);
    try {
      const count = await purgeAdminActionsOlderThan(retentionDays);
      setPurgeResult(count);
    } catch (err) {
      console.error(err);
      alert("Couldn't purge old logs.");
    }
    setPurging(false);
  };

  //////////////////////////////////////////////////
  // RENDER
  //////////////////////////////////////////////////

  return (
    <div>
      {/* RETENTION SETTINGS */}
      {perms.canEdit && (
        <div style={retentionCard}>
          <div style={retentionHeader}>
            <div>
              <h2 style={retentionTitle}>Log Retention</h2>
              <p style={retentionHint}>
                No scheduled cleanup runs automatically — set a retention window, then purge manually whenever you're ready.
              </p>
            </div>
          </div>

          <div style={retentionRow}>
            <input
              type="number"
              min="0"
              placeholder="Days (0 = forever)"
              value={retentionInput}
              onChange={(e) => setRetentionInput(e.target.value)}
              style={retentionInput_}
            />
            <button onClick={saveRetention} disabled={savingRetention} style={smallBtn}>
              {savingRetention ? "Saving…" : "Save"}
            </button>
            <button onClick={handlePurge} disabled={purging} style={dangerBtn}>
              {purging ? "Purging…" : "Purge Old Logs Now"}
            </button>
            <span style={retentionStatus}>
              {retentionDays ? `Currently keeping ${retentionDays} day${retentionDays === 1 ? "" : "s"}` : "Currently keeping forever"}
            </span>
          </div>

          {purgeResult !== null && (
            <p style={retentionResult}>
              Deleted {purgeResult} log{purgeResult === 1 ? "" : "s"} older than {retentionDays} days.
            </p>
          )}
        </div>
      )}

      {/* TOOLBAR */}
      <div style={toolbar}>
        <input
          placeholder="Search actions, targets, administrators…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={searchInput}
        />

        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={filterSelect}>
          <option value="all">All Categories</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {ADMIN_ACTION_CATEGORIES[c] || c}
            </option>
          ))}
        </select>

        <select value={adminFilter} onChange={(e) => setAdminFilter(e.target.value)} style={filterSelect}>
          <option value="all">All Administrators</option>
          {adminOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} style={filterSelect}>
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="lastX">Last X Days</option>
        </select>

        {dateFilter === "lastX" && (
          <input
            type="number"
            min="1"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            style={smallInput}
            title="Number of days"
          />
        )}

        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={filterSelect}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>

        <button onClick={handleExport} style={smallBtn}>
          ⬇ Export
        </button>
      </div>

      <p style={summaryText}>
        Showing <strong>{filtered.length}</strong> of {actions.length} admin actions
      </p>

      {/* LIST */}
      <div style={list}>
        {filtered.map((a) => {
          const { bg, color } = categoryStyle(a.category);
          const isOpen = expandedId === a.id;

          return (
            <div key={a.id} style={card}>
              <button style={cardHeaderBtn} onClick={() => setExpandedId(isOpen ? null : a.id)}>
                <div style={cardHeaderLeft}>
                  <span style={{ ...categoryBadge, background: bg, color }}>
                    {ADMIN_ACTION_CATEGORIES[a.category] || a.category}
                  </span>
                  <span style={actionText}>{a.action}</span>
                  {a.targetLabel && <span style={targetText}>→ {a.targetLabel}</span>}
                </div>

                <div style={cardHeaderRight}>
                  <span style={adminText}>👤 {getAdminName(a)}</span>
                  <span style={metaDot}>·</span>
                  <span style={timeText}>{formatDateTime(a)}</span>
                  <span style={chevron(isOpen)}>▾</span>
                </div>
              </button>

              {isOpen && (
                <div style={cardBody}>
                  <div style={detailGrid}>
                    <DetailField label="Administrator" value={`${getAdminName(a)}${a.adminEmail ? ` (${a.adminEmail})` : ""}`} />
                    <DetailField label="Target" value={a.targetType ? `${a.targetType}${a.targetId ? ` · ${a.targetId}` : ""}` : "—"} />
                    <DetailField label="Device" value={a.device ? `${a.device.platform || "Unknown"}${a.device.isMobile ? " (mobile)" : ""}` : "—"} />
                    <DetailField label="Device ID" value={a.deviceId ? a.deviceId.slice(0, 18) + "…" : "—"} mono />
                  </div>

                  <div style={diffGrid}>
                    <div>
                      <div style={diffLabel}>Before</div>
                      <pre style={diffBlock}>{a.before ? JSON.stringify(a.before, null, 2) : "—"}</pre>
                    </div>
                    <div>
                      <div style={diffLabel}>After</div>
                      <pre style={diffBlock}>{a.after ? JSON.stringify(a.after, null, 2) : "—"}</pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={emptyState}>
            <span style={emptyIcon}>📋</span>
            <p style={emptyText}>No admin actions match your current filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailField({ label, value, mono }) {
  return (
    <div>
      <div style={detailLabel}>{label}</div>
      <div style={mono ? { ...detailValue, fontFamily: "monospace" } : detailValue}>{value}</div>
    </div>
  );
}

//////////////////////////////////////////////////
// STYLES
//////////////////////////////////////////////////

const retentionCard = {
  background: "#fffdf9",
  border: "1px solid #eddfc8",
  borderRadius: "14px",
  padding: "16px 18px",
  marginBottom: "16px",
};

const retentionHeader = { marginBottom: "10px" };
const retentionTitle = { margin: 0, fontSize: "16px", fontWeight: "normal", color: "#3d2200", fontFamily: "'Georgia', serif" };
const retentionHint = { margin: "4px 0 0", fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif" };

const retentionRow = { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" };

const retentionInput_ = {
  padding: "8px 10px",
  borderRadius: "8px",
  border: "1px solid #eddfc8",
  background: "#fdf8f3",
  fontSize: "13px",
  fontFamily: "sans-serif",
  color: "#3d2200",
  width: "150px",
};

const retentionStatus = { fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif" };
const retentionResult = { marginTop: "10px", fontSize: "12px", color: "#7a4f10", fontFamily: "sans-serif" };

const smallBtn = {
  padding: "8px 13px",
  borderRadius: "8px",
  border: "1px solid #eddfc8",
  background: "#f8eee3",
  color: "#7a4f10",
  cursor: "pointer",
  fontFamily: "sans-serif",
  fontSize: "13px",
};

const dangerBtn = {
  padding: "8px 13px",
  borderRadius: "8px",
  border: "1px solid #f3c8ba",
  background: "#fff5f2",
  color: "#a33622",
  cursor: "pointer",
  fontFamily: "sans-serif",
  fontSize: "13px",
};

const toolbar = { display: "flex", gap: "10px", alignItems: "center", marginBottom: "12px", flexWrap: "wrap" };

const searchInput = {
  padding: "9px 14px",
  borderRadius: "10px",
  border: "1px solid #eddfc8",
  background: "#fffdf9",
  fontSize: "13px",
  fontFamily: "sans-serif",
  color: "#3d2200",
  outline: "none",
  width: "260px",
  flexShrink: 0,
};

const filterSelect = {
  padding: "9px 12px",
  borderRadius: "10px",
  border: "1px solid #eddfc8",
  background: "#fffdf9",
  fontSize: "13px",
  fontFamily: "sans-serif",
  color: "#3d2200",
  cursor: "pointer",
};

const smallInput = { ...filterSelect, width: "70px" };

const summaryText = { fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif", marginBottom: "12px" };

const list = { display: "flex", flexDirection: "column", gap: "8px" };

const card = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "14px", overflow: "hidden" };

const cardHeaderBtn = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  padding: "12px 16px",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  textAlign: "left",
  flexWrap: "wrap",
  fontFamily: "sans-serif",
};

const cardHeaderLeft = { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" };
const cardHeaderRight = { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" };

const categoryBadge = {
  display: "inline-block",
  fontSize: "11px",
  padding: "3px 10px",
  borderRadius: "999px",
  fontFamily: "sans-serif",
  fontWeight: "500",
};

const actionText = { fontSize: "13px", color: "#3d2200", fontFamily: "sans-serif", fontWeight: "600" };
const targetText = { fontSize: "13px", color: "#7a5530", fontFamily: "sans-serif" };
const adminText = { fontSize: "12px", color: "#5c3a1e", fontFamily: "sans-serif" };
const metaDot = { fontSize: "12px", color: "#c8a87a" };
const timeText = { fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif" };

const chevron = (open) => ({
  display: "inline-block",
  fontSize: "12px",
  color: "#a85e18",
  transition: "transform 0.15s",
  transform: open ? "rotate(0deg)" : "rotate(-90deg)",
});

const cardBody = {
  padding: "12px 16px 16px",
  borderTop: "1px solid #f0e4d0",
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};

const detailGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "10px",
};

const detailLabel = { fontSize: "10px", color: "#9b7040", fontFamily: "sans-serif", textTransform: "uppercase", letterSpacing: "0.04em" };
const detailValue = { fontSize: "13px", color: "#3d2200", fontFamily: "sans-serif", marginTop: "2px" };

const diffGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" };
const diffLabel = { fontSize: "11px", color: "#9b7040", fontFamily: "sans-serif", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "4px" };
const diffBlock = {
  margin: 0,
  padding: "10px 12px",
  borderRadius: "8px",
  background: "#fdf8f3",
  border: "1px solid #eddfc8",
  fontSize: "11px",
  fontFamily: "monospace",
  color: "#5c3a1e",
  overflowX: "auto",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const emptyState = { textAlign: "center", padding: "50px 20px" };
const emptyIcon = { fontSize: "36px", display: "block", marginBottom: "10px" };
const emptyText = { color: "#b08050", fontFamily: "sans-serif", fontStyle: "italic", margin: 0 };
