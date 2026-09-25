import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { fetchAllNotes, formatTime, saveBookmarks } from "../utils/notes";
import usePlayAt from "../hooks/usePlayAt";
import { useToast } from "../context/ToastContext";

// Every bookmarked moment, across all recordings. Tap one to start playing right there.
export default function Bookmarks() {
  const navigate = useNavigate();
  const playAt = usePlayAt();
  const { toast } = useToast();
  const [user, setUser] = useState(auth.currentUser);
  const [docs, setDocs] = useState(null);
  const [q, setQ] = useState("");

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    if (!user) { setDocs([]); return; }
    fetchAllNotes(user.uid).then((d) => setDocs(d.filter((x) => x.bookmarks.length))).catch(() => setDocs([]));
  }, [user]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (docs || []).map((d) => ({ ...d, bookmarks: d.bookmarks.filter((b) => !term || (b.label || "").toLowerCase().includes(term) || d.title.toLowerCase().includes(term)) })).filter((d) => d.bookmarks.length);
  }, [docs, q]);

  const total = shown.reduce((s, d) => s + d.bookmarks.length, 0);

  const remove = async (d, b) => {
    const next = d.bookmarks.filter((x) => x.id !== b.id);
    setDocs((all) => all.map((x) => (x.id === d.id ? { ...x, bookmarks: next } : x)));
    await saveBookmarks(user.uid, d.audioId, next, d);
    toast("Bookmark removed", { action: { label: "Undo", onClick: async () => { const back = [...next, b].sort((a, c) => a.t - c.t); setDocs((all) => all.map((x) => (x.id === d.id ? { ...x, bookmarks: back } : x))); await saveBookmarks(user.uid, d.audioId, back, d); } } });
  };

  const copyLink = async (d, b) => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/listen/${d.audioId}?t=${b.t}`); toast(`Link to ${formatTime(b.t)} copied`, { type: "success" }); } catch { toast("Couldn't copy.", { type: "error" }); }
  };

  if (!user) return <Shell><h1 style={title}>Bookmarks</h1><div style={empty}><div style={{ fontSize: "34px" }}>🔒</div><p style={emptyText}>Sign in to see your bookmarks.</p><button style={primary} onClick={() => navigate("/login")}>Sign in</button></div></Shell>;

  return (
    <Shell>
      <h1 style={title}>Bookmarks</h1>
      <p style={subtitle}>{docs && total ? `${total} saved moment${total === 1 ? "" : "s"}` : "Moments you've marked while listening."}</p>
      <input type="search" style={search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search bookmarks…" aria-label="Search bookmarks" />

      {docs === null ? <p style={emptyText}>Loading…</p> : shown.length === 0 ? (
        <div style={empty}>
          <div style={{ fontSize: "34px" }}>🔖</div>
          <h3 style={emptyTitle}>{q ? "No matches" : "No bookmarks yet"}</h3>
          <p style={emptyText}>Tap “Bookmark” on the player page to save a moment.</p>
        </div>
      ) : shown.map((d) => (
        <div key={d.id} style={card}>
          <div style={cardTitle}>{d.title || "Recording"}</div>
          <div style={cardSub}>{d.speaker}</div>
          {d.bookmarks.sort((a, b) => a.t - b.t).map((b) => (
            <div key={b.id} style={row}>
              <button style={main} onClick={() => playAt(d.audioId, b.t, { title: d.title, speaker: d.speaker })} title="Play from here">
                <span style={time}>{formatTime(b.t)}</span>
                <span style={label}>{b.label || "Bookmark"}</span>
              </button>
              <button style={mini} onClick={() => copyLink(d, b)} aria-label="Copy link to this moment" title="Copy link">🔗</button>
              <button style={mini} onClick={() => remove(d, b)} aria-label="Remove bookmark">✕</button>
            </div>
          ))}
        </div>
      ))}
    </Shell>
  );
}

function Shell({ children }) { return <div style={page}>{children}</div>; }

const page = { padding: "32px 20px 60px", maxWidth: "720px", margin: "0 auto", background: "#fdf8f3", minHeight: "100vh", fontFamily: "'Georgia', serif" };
const title = { textAlign: "center", margin: "0 0 6px", fontSize: "28px", fontWeight: "normal", color: "#3d2200" };
const subtitle = { textAlign: "center", margin: "0 0 16px", fontSize: "14px", color: "#9b7040", fontFamily: "sans-serif" };
const search = { width: "100%", boxSizing: "border-box", padding: "10px 16px", borderRadius: "999px", border: "1px solid #eddfc8", background: "#fffdf9", fontSize: "14px", fontFamily: "sans-serif", marginBottom: "16px" };
const card = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "16px", padding: "14px", marginBottom: "12px" };
const cardTitle = { fontSize: "16px", color: "#3d2200" };
const cardSub = { fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif", marginBottom: "8px" };
const row = { display: "flex", alignItems: "center", gap: "8px", padding: "6px 0", borderTop: "1px solid #f0e4d0" };
const main = { flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "12px", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "4px 0" };
const time = { padding: "6px 12px", borderRadius: "999px", background: "#fde8b8", color: "#7a4f10", fontSize: "13px", fontWeight: "600", fontFamily: "sans-serif", flexShrink: 0 };
const label = { fontSize: "14px", color: "#3d2200", fontFamily: "sans-serif" };
const mini = { width: "32px", height: "32px", borderRadius: "50%", border: "none", background: "#f4e7d4", color: "#7a4f10", cursor: "pointer", fontSize: "13px", flexShrink: 0 };
const primary = { padding: "10px 18px", borderRadius: "999px", border: "none", background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", fontSize: "13px", fontWeight: "600", cursor: "pointer" };
const empty = { textAlign: "center", padding: "36px 10px" };
const emptyTitle = { margin: "8px 0 4px", fontSize: "18px", fontWeight: "normal", color: "#3d2200" };
const emptyText = { margin: "0 0 12px", color: "#9b7040", fontFamily: "sans-serif", fontSize: "14px", textAlign: "center" };
