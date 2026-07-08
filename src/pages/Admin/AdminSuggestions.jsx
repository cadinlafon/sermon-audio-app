import { useEffect, useState } from "react";
import { db } from "../../firebase";
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from "firebase/firestore";

const STATUS_CONFIG = {
  none:        { label: "No Status",   bg: "#f6e4b0", color: "#7a5a10" },
  planned:     { label: "Planned",     bg: "#e8f0fe", color: "#2a5ab5" },
  "in progress":{ label: "In Progress", bg: "#fef3c7", color: "#92400e" },
  complete:    { label: "Complete",    bg: "#dcfce7", color: "#166534" },
};

export default function AdminSuggestions() {
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    async function fetchData() {
      const snap = await getDocs(query(collection(db, "suggestions"), orderBy("createdAt", "desc")));
      setSuggestions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }
    fetchData();
  }, []);

  const updateStatus = async (id, status) => {
    await updateDoc(doc(db, "suggestions", id), { status });
    setSuggestions((prev) => prev.map((s) => s.id === id ? { ...s, status } : s));
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this suggestion?")) return;
    await deleteDoc(doc(db, "suggestions", id));
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div style={page}>
      <div style={pageHeader}>
        <h1 style={pageTitle}>Suggestions</h1>
        <p style={pageSubtitle}>{suggestions.length} suggestion{suggestions.length !== 1 ? "s" : ""} from users.</p>
      </div>

      {suggestions.map((s) => {
        const statusCfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.none;
        return (
          <div key={s.id} style={card}>
            <div style={cardTop}>
              <div style={cardLeft}>
                <h3 style={cardTitle}>{s.title}</h3>
                <p style={cardDetails}>{s.details}</p>
                <p style={cardUser}>Submitted by: {s.userId || "Unknown"}</p>
              </div>
              <div style={cardRight}>
                <div style={votesBox}>
                  <span style={votesNum}>👍 {s.votes || 0}</span>
                  <span style={votersNum}>{s.voters?.length || 0} voter{s.voters?.length !== 1 ? "s" : ""}</span>
                </div>
                <span style={{ ...statusPill, background: statusCfg.bg, color: statusCfg.color }}>{statusCfg.label}</span>
              </div>
            </div>

            <div style={statusRow}>
              <span style={statusRowLabel}>Set status:</span>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => updateStatus(s.id, key)}
                  style={{ ...statusBtn, background: s.status === key ? cfg.bg : "transparent", color: s.status === key ? cfg.color : "#7a4f10", borderColor: s.status === key ? cfg.color + "44" : "#eddfc8", fontWeight: s.status === key ? "600" : "normal" }}
                >
                  {cfg.label}
                </button>
              ))}
              <button style={deleteBtn} onClick={() => handleDelete(s.id)}>Delete</button>
            </div>
          </div>
        );
      })}

      {suggestions.length === 0 && <p style={empty}>No suggestions yet.</p>}
    </div>
  );
}

const page = { maxWidth: "860px" };
const pageHeader = { marginBottom: "24px" };
const pageTitle = { fontSize: "26px", fontWeight: "normal", color: "#3d2200", margin: "0 0 4px", fontFamily: "'Georgia', serif" };
const pageSubtitle = { fontSize: "14px", color: "#9b7040", fontFamily: "sans-serif", margin: 0 };

const card = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "16px", padding: "18px 20px", marginBottom: "12px", boxShadow: "0 2px 10px rgba(160,100,40,0.06)" };
const cardTop = { display: "flex", justifyContent: "space-between", gap: "16px", marginBottom: "14px" };
const cardLeft = { flex: 1 };
const cardRight = { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px", flexShrink: 0 };
const cardTitle = { fontSize: "16px", color: "#3d2200", fontFamily: "'Georgia', serif", margin: "0 0 6px" };
const cardDetails = { fontSize: "13px", color: "#7a5530", fontFamily: "sans-serif", lineHeight: 1.6, margin: "0 0 6px" };
const cardUser = { fontSize: "11px", color: "#b08050", fontFamily: "sans-serif", margin: 0 };
const votesBox = { textAlign: "right" };
const votesNum = { display: "block", fontSize: "18px", fontFamily: "sans-serif", color: "#3d2200", fontWeight: "bold" };
const votersNum = { display: "block", fontSize: "11px", fontFamily: "sans-serif", color: "#9b7040" };
const statusPill = { fontSize: "11px", padding: "4px 10px", borderRadius: "999px", fontFamily: "sans-serif", fontWeight: "600" };

const statusRow = { display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center", borderTop: "1px solid #f0e4d0", paddingTop: "12px" };
const statusRowLabel = { fontSize: "11px", fontFamily: "sans-serif", color: "#9b7040", letterSpacing: "0.06em", marginRight: "4px" };
const statusBtn = { padding: "5px 10px", borderRadius: "8px", border: "1px solid", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer" };
const deleteBtn = { marginLeft: "auto", padding: "5px 12px", borderRadius: "8px", border: "1px solid #fca5a5", background: "transparent", color: "#dc2626", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer" };
const empty = { textAlign: "center", color: "#b08050", fontFamily: "sans-serif", fontStyle: "italic", padding: "40px 0" };