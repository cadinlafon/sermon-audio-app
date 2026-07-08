import { useEffect, useState } from "react";
import { collection, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "../../firebase";

// Event type → badge color
const EVENT_COLORS = {
  session_start:   { bg: "#dcfce7", color: "#166534" },
  session_end:     { bg: "#f1f5f9", color: "#475569" },
  app_opened:      { bg: "#e8f0fe", color: "#2a5ab5" },
  pwa_installed:   { bg: "#fef3c7", color: "#92400e" },
  pwa_installed_ios: { bg: "#fef3c7", color: "#92400e" },
  route_change:    { bg: "#f3e8ff", color: "#6d28d9" },
  audio_play:      { bg: "#f6e4b0", color: "#7a5a10" },
};

const eventStyle = (event) =>
  EVENT_COLORS[event] || { bg: "#f0e4d0", color: "#5c3a1e" };

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [userMap, setUserMap] = useState({});
  const [filter, setFilter] = useState("today");
  const [days, setDays] = useState(7);
  const [customDate, setCustomDate] = useState("");

  useEffect(() => {
    const fetchUsers = async () => {
      const snap = await getDocs(collection(db, "users"));
      const map = {};
      snap.docs.forEach((doc) => {
        const d = doc.data();
        map[doc.id] = d.name || d.fullName || d.email || doc.id;
      });
      setUserMap(map);
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, "logs"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setLogs(data);
    });
  }, []);

  const formatTime = (ts) =>
    ts?.seconds ? new Date(ts.seconds * 1000).toLocaleString() : "—";

  const getUserName = (log) => {
    if (log.fullName) return log.fullName;
    if (log.userId && userMap[log.userId]) return userMap[log.userId];
    if (log.email) return log.email;
    return "Guest";
  };

  const now = new Date();
  const isSameDay = (d1, d2) => d1.toDateString() === d2.toDateString();

  const filteredLogs = logs.filter((log) => {
    if (!log.createdAt?.seconds) return false;
    const date = new Date(log.createdAt.seconds * 1000);
    if (filter === "today") return isSameDay(date, now);
    if (filter === "yesterday") { const y = new Date(); y.setDate(now.getDate() - 1); return isSameDay(date, y); }
    if (filter === "lastX") { const past = new Date(); past.setDate(now.getDate() - days); return date >= past; }
    if (filter === "custom" && customDate) return isSameDay(date, new Date(customDate));
    return true;
  });

  return (
    <div style={page}>
      {/* HEADER */}
      <div style={pageHeader}>
        <h1 style={pageTitle}>Activity Logs</h1>
        <p style={pageSubtitle}>{filteredLogs.length} event{filteredLogs.length !== 1 ? "s" : ""} in view</p>
      </div>

      {/* FILTER BAR */}
      <div style={filterBar}>
        <div style={filterGroup}>
          {[
            { key: "today",     label: "Today" },
            { key: "yesterday", label: "Yesterday" },
            { key: "lastX",     label: `Last ${days}d` },
            { key: "custom",    label: "Pick date" },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)} style={filter === key ? { ...filterBtn, ...filterBtnActive } : filterBtn}>
              {label}
            </button>
          ))}
        </div>

        {filter === "lastX" && (
          <div style={filterExtra}>
            <label style={filterExtraLabel}>Days</label>
            <input
              type="number"
              value={days}
              min={1}
              onChange={(e) => setDays(Number(e.target.value))}
              style={smallInput}
            />
          </div>
        )}

        {filter === "custom" && (
          <input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            style={{ ...smallInput, width: "160px" }}
          />
        )}
      </div>

      {/* LOG LIST */}
      <div style={list}>
        {filteredLogs.map((log) => {
          const { bg, color } = eventStyle(log.event);
          const detail = log.page || log.mode || log.message || null;
          return (
            <div key={log.id} style={row}>
              <div style={rowLeft}>
                <span style={{ ...eventBadge, background: bg, color }}>{log.event}</span>
                <div style={metaRow}>
                  <span style={metaUser}>👤 {getUserName(log)}</span>
                  <span style={metaDot}>·</span>
                  <span style={metaTime}>{formatTime(log.createdAt)}</span>
                </div>
              </div>
              {detail && <div style={rowRight}>{detail}</div>}
            </div>
          );
        })}

        {filteredLogs.length === 0 && (
          <div style={emptyState}>
            <span style={emptyIcon}>📋</span>
            <p style={emptyText}>No logs found for this time period.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const page       = { maxWidth: "900px" };
const pageHeader = { marginBottom: "20px" };
const pageTitle  = { fontSize: "26px", fontWeight: "normal", color: "#3d2200", margin: "0 0 4px", fontFamily: "'Georgia', serif" };
const pageSubtitle = { fontSize: "14px", color: "#9b7040", fontFamily: "sans-serif", margin: 0 };

const filterBar   = { display: "flex", gap: "12px", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "14px", padding: "12px 16px" };
const filterGroup = { display: "flex", gap: "6px", flexWrap: "wrap" };
const filterBtn   = { padding: "6px 14px", borderRadius: "999px", border: "1px solid #eddfc8", background: "transparent", color: "#7a4f10", cursor: "pointer", fontSize: "13px", fontFamily: "sans-serif" };
const filterBtnActive = { background: "linear-gradient(135deg, #c97c2e, #a85e18)", border: "1px solid transparent", color: "#fff8ee", boxShadow: "0 2px 8px rgba(160,80,20,0.22)" };
const filterExtra = { display: "flex", alignItems: "center", gap: "6px" };
const filterExtraLabel = { fontSize: "12px", fontFamily: "sans-serif", color: "#9b7040" };
const smallInput  = { padding: "6px 10px", borderRadius: "8px", border: "1px solid #eddfc8", background: "#fdf8f3", fontSize: "13px", fontFamily: "sans-serif", color: "#3d2200", outline: "none", width: "70px" };

const list = { display: "flex", flexDirection: "column", gap: "8px" };

const row      = { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "12px", padding: "12px 16px", gap: "12px", flexWrap: "wrap" };
const rowLeft  = { display: "flex", flexDirection: "column", gap: "5px" };
const rowRight = { fontSize: "12px", fontFamily: "sans-serif", color: "#9b7040", textAlign: "right", maxWidth: "240px", wordBreak: "break-word" };

const eventBadge = { display: "inline-block", fontSize: "11px", padding: "3px 10px", borderRadius: "999px", fontFamily: "sans-serif", letterSpacing: "0.03em", fontWeight: "500" };
const metaRow  = { display: "flex", alignItems: "center", gap: "6px" };
const metaUser = { fontSize: "12px", fontFamily: "sans-serif", color: "#5c3a1e" };
const metaDot  = { fontSize: "12px", color: "#c8a87a" };
const metaTime = { fontSize: "12px", fontFamily: "sans-serif", color: "#9b7040" };

const emptyState = { textAlign: "center", padding: "50px 20px" };
const emptyIcon  = { fontSize: "36px", display: "block", marginBottom: "10px" };
const emptyText  = { color: "#b08050", fontFamily: "sans-serif", fontStyle: "italic", margin: 0 };