import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import MarkdownText, { toggleChecklistLine } from "../components/MarkdownText";
import { NOTE_CATEGORIES, categoryOf, downloadText, fetchAllNotes, formatTime, notesToMarkdown, saveNote } from "../utils/notes";
import usePlayAt from "../hooks/usePlayAt";

// Every note you've taken, across all recordings.
export default function Notes() {
  const navigate = useNavigate();
  const playAt = usePlayAt();
  const [user, setUser] = useState(auth.currentUser);
  const [docs, setDocs] = useState(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    if (!user) { setDocs([]); return; }
    fetchAllNotes(user.uid).then((d) => setDocs(d.filter((x) => x.text || x.entries.length))).catch(() => setDocs([]));
  }, [user]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (docs || []).map((d) => {
      const entries = d.entries.filter((e) => (cat === "all" || e.category === cat) && (!term || e.text.toLowerCase().includes(term)));
      const textMatch = cat === "all" && (!term || d.text.toLowerCase().includes(term) || d.title.toLowerCase().includes(term));
      return { ...d, entries, showText: !!d.text && textMatch };
    }).filter((d) => d.showText || d.entries.length);
  }, [docs, q, cat]);

  const toggleCheck = async (d, line) => {
    const text = toggleChecklistLine(d.text, line);
    setDocs((all) => all.map((x) => (x.id === d.id ? { ...x, text } : x)));
    await saveNote(user.uid, d.audioId, text, d);
  };

  if (!user) return <Shell><h1 style={title}>Notes</h1><div style={empty}><div style={{ fontSize: "34px" }}>🔒</div><p style={emptyText}>Sign in to see your notes.</p><button style={primary} onClick={() => navigate("/login")}>Sign in</button></div></Shell>;

  return (
    <Shell>
      <h1 style={title}>Notes</h1>
      <p style={subtitle}>Everything you've written while listening.</p>

      <div style={bar} className="pf-no-print">
        <input type="search" style={search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search all notes…" aria-label="Search notes" />
        <button style={ghost} onClick={() => downloadText(notesToMarkdown(shown), "my-notes.md", "text/markdown")} disabled={!shown.length}>⬇ Markdown</button>
        <button style={ghost} onClick={() => downloadText(JSON.stringify(shown, null, 2), "my-notes.json", "application/json")} disabled={!shown.length}>⬇ JSON</button>
        <button style={ghost} onClick={() => window.print()} disabled={!shown.length}>🖨 Print</button>
      </div>
      <div style={chips} className="pf-no-print">
        <button style={cat === "all" ? { ...chip, ...chipOn } : chip} onClick={() => setCat("all")}>All</button>
        {NOTE_CATEGORIES.map((c) => <button key={c.id} style={cat === c.id ? { ...chip, background: c.color, color: c.text, borderColor: c.text } : chip} onClick={() => setCat(c.id)}>{c.label}</button>)}
      </div>

      {docs === null ? <p style={emptyText}>Loading…</p> : shown.length === 0 ? (
        <div style={empty}>
          <div style={{ fontSize: "34px" }}>📝</div>
          <h3 style={emptyTitle}>{q || cat !== "all" ? "No matching notes" : "No notes yet"}</h3>
          <p style={emptyText}>Tap “Take Notes” on the player page while you listen.</p>
        </div>
      ) : (
        <div className="pf-print-area">
          {shown.map((d) => (
            <div key={d.id} style={card}>
              <div style={cardHead}>
                <div>
                  <div style={cardTitle}>{d.title || "Recording"}</div>
                  <div style={cardSub}>{d.speaker}</div>
                </div>
                <button style={ghost} className="pf-no-print" onClick={() => playAt(d.audioId, 0, { title: d.title, speaker: d.speaker })}>▶ Play</button>
              </div>
              {d.showText && <div style={block}><MarkdownText text={d.text} onSeek={(t) => playAt(d.audioId, t, { title: d.title, speaker: d.speaker })} onToggle={(i) => toggleCheck(d, i)} /></div>}
              {d.entries.sort((a, b) => a.t - b.t).map((e) => {
                const c = categoryOf(e.category);
                return (
                  <div key={e.id} style={entry}>
                    <button style={time} onClick={() => playAt(d.audioId, e.t, { title: d.title, speaker: d.speaker })} title="Play from here">{formatTime(e.t)}</button>
                    <span style={{ ...badge, background: c.color, color: c.text }}>{c.label}</span>
                    <span style={{ flex: 1, minWidth: "60%" }}><MarkdownText text={e.text} /></span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }) { return <div style={page}>{children}</div>; }

const page = { padding: "32px 20px 60px", maxWidth: "760px", margin: "0 auto", background: "#fdf8f3", minHeight: "100vh", fontFamily: "'Georgia', serif" };
const title = { textAlign: "center", margin: "0 0 6px", fontSize: "28px", fontWeight: "normal", color: "#3d2200" };
const subtitle = { textAlign: "center", margin: "0 0 20px", fontSize: "14px", color: "#9b7040", fontFamily: "sans-serif" };
const bar = { display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" };
const search = { flex: "1 1 220px", padding: "10px 16px", borderRadius: "999px", border: "1px solid #eddfc8", background: "#fffdf9", fontSize: "14px", fontFamily: "sans-serif" };
const ghost = { padding: "9px 14px", borderRadius: "999px", border: "1px solid #eddfc8", background: "#fffdf9", color: "#7a4f10", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
const primary = { padding: "10px 18px", borderRadius: "999px", border: "none", background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", fontSize: "13px", fontWeight: "600", cursor: "pointer" };
const chips = { display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px" };
const chip = { padding: "6px 12px", borderRadius: "999px", border: "1px solid #eddfc8", background: "transparent", color: "#9b7040", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer" };
const chipOn = { background: "#fde8b8", color: "#7a4f10", borderColor: "#e5c27a" };
const card = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "16px", padding: "16px", marginBottom: "14px", breakInside: "avoid" };
const cardHead = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "10px" };
const cardTitle = { fontSize: "17px", color: "#3d2200" };
const cardSub = { fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif" };
const block = { background: "#fdf8f3", borderRadius: "12px", padding: "10px 12px", marginBottom: "8px" };
const entry = { display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap", padding: "8px 0", borderTop: "1px solid #f0e4d0" };
const time = { padding: "4px 10px", borderRadius: "999px", border: "none", background: "#fde8b8", color: "#7a4f10", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "sans-serif" };
const badge = { padding: "2px 8px", borderRadius: "999px", fontSize: "10px", fontFamily: "sans-serif", fontWeight: "600" };
const empty = { textAlign: "center", padding: "36px 10px" };
const emptyTitle = { margin: "8px 0 4px", fontSize: "18px", fontWeight: "normal", color: "#3d2200" };
const emptyText = { margin: "0 0 12px", color: "#9b7040", fontFamily: "sans-serif", fontSize: "14px", textAlign: "center" };
