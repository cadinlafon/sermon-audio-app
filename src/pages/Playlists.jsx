import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlaylists, playlistDuration, STARTER_NAMES } from "../context/PlaylistContext";
import { useToast } from "../context/ToastContext";
import PlaylistCover from "../components/PlaylistCover";

export default function Playlists() {
  const pl = usePlaylists();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [sort, setSort] = useState("recent");
  const [busy, setBusy] = useState(false);

  const sorted = useMemo(() => {
    const list = [...pl.playlists];
    if (sort === "name") return list.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "size") return list.sort((a, b) => b.items.length - a.items.length);
    return list.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  }, [pl.playlists, sort]);

  const create = async (n) => {
    const value = (n ?? name).trim();
    if (!value) return;
    setBusy(true);
    try {
      const created = await pl.create(value);
      setName("");
      navigate(`/playlists/${created.id}`);
    } catch (e) {
      toast(e.message || "Couldn't create the playlist.", { type: "error" });
    }
    setBusy(false);
  };

  const remove = async (p) => {
    const removed = await pl.remove(p.id);
    toast(`Deleted “${p.name}”`, { action: { label: "Undo", onClick: () => pl.restore(removed) } });
  };

  if (!pl.user) {
    return (
      <div style={page}>
        <h1 style={title}>Playlists</h1>
        <div style={empty}><div style={{ fontSize: "36px" }}>🔒</div><p style={emptyText}>Sign in to create playlists.</p><button style={primary} onClick={() => navigate("/login")}>Sign in</button></div>
      </div>
    );
  }

  const suggestions = STARTER_NAMES.filter((n) => !pl.playlists.some((p) => p.name.toLowerCase() === n.toLowerCase()));

  return (
    <div style={page}>
      <h1 style={title}>Playlists</h1>
      <p style={subtitle}>Your own collections — Sunday listening, Doctrine study, whatever you like.</p>

      <div style={card}>
        <div style={newRow}>
          <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="New playlist name" maxLength={60} onKeyDown={(e) => e.key === "Enter" && create()} aria-label="New playlist name" />
          <button style={primary} onClick={() => create()} disabled={busy || !name.trim()}>＋ Create</button>
        </div>
        {suggestions.length > 0 && (
          <div style={chips}>
            {suggestions.map((n) => <button key={n} style={chip} onClick={() => create(n)} disabled={busy}>＋ {n}</button>)}
          </div>
        )}
      </div>

      {pl.playlists.length > 1 && (
        <div style={sortRow}>
          <label style={sortLabel}>Sort <select value={sort} onChange={(e) => setSort(e.target.value)} style={select}>
            <option value="recent">Recently added</option><option value="name">Name A–Z</option><option value="size">Most recordings</option>
          </select></label>
        </div>
      )}

      {pl.loading ? (
        <p style={emptyText}>Loading…</p>
      ) : sorted.length === 0 ? (
        <div style={empty}>
          <div style={{ fontSize: "36px" }}>🎶</div>
          <h3 style={emptyTitle}>No playlists yet</h3>
          <p style={emptyText}>Create one above, then use the ☰＋ button on any recording to add it.</p>
        </div>
      ) : (
        sorted.map((p) => (
          <div key={p.id} style={row}>
            <button style={rowBtn} onClick={() => navigate(`/playlists/${p.id}`)}>
              <PlaylistCover cover={p.cover} size={56} />
              <span style={{ minWidth: 0, textAlign: "left" }}>
                <span style={rowTitle}>{p.name} {p.public && <span style={pubPill}>Public</span>}</span>
                <span style={rowSub}>{p.items.length} recording{p.items.length === 1 ? "" : "s"}{playlistDuration(p) ? ` · ${playlistDuration(p)}` : ""}</span>
                {p.description && <span style={rowDesc}>{p.description}</span>}
              </span>
            </button>
            <button style={dangerGhost} onClick={() => remove(p)} aria-label={`Delete ${p.name}`}>Delete</button>
          </div>
        ))
      )}
    </div>
  );
}

const page = { padding: "32px 20px 60px", maxWidth: "720px", margin: "0 auto", background: "#fdf8f3", minHeight: "100vh", fontFamily: "'Georgia', serif" };
const title = { textAlign: "center", margin: "0 0 6px", fontSize: "28px", fontWeight: "normal", color: "#3d2200" };
const subtitle = { textAlign: "center", margin: "0 0 22px", fontSize: "14px", color: "#9b7040", fontFamily: "sans-serif" };
const card = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "16px", padding: "14px", marginBottom: "14px" };
const newRow = { display: "flex", gap: "8px" };
const input = { flex: 1, padding: "10px 14px", borderRadius: "999px", border: "1px solid #eddfc8", background: "#fdf8f3", fontSize: "14px", fontFamily: "sans-serif", color: "#3d2200" };
const primary = { padding: "10px 18px", borderRadius: "999px", border: "none", background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", fontSize: "13px", fontFamily: "sans-serif", fontWeight: "600", cursor: "pointer" };
const chips = { display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px" };
const chip = { padding: "7px 12px", borderRadius: "999px", border: "1px solid #eddfc8", background: "transparent", color: "#7a4f10", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer" };
const sortRow = { display: "flex", justifyContent: "flex-end", marginBottom: "10px" };
const sortLabel = { fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif" };
const select = { marginLeft: "6px", padding: "6px 10px", borderRadius: "999px", border: "1px solid #eddfc8", background: "#fffdf9", fontSize: "12px" };
const row = { display: "flex", alignItems: "center", gap: "10px", background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "16px", padding: "10px", marginBottom: "10px" };
const rowBtn = { flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "14px", background: "none", border: "none", cursor: "pointer", padding: 0 };
const rowTitle = { display: "block", fontSize: "16px", color: "#3d2200" };
const rowSub = { display: "block", fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif", marginTop: "2px" };
const rowDesc = { display: "block", fontSize: "12px", color: "#b08050", fontFamily: "sans-serif", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const pubPill = { fontSize: "10px", padding: "2px 8px", borderRadius: "999px", background: "#dcfce7", color: "#166534", fontFamily: "sans-serif", marginLeft: "6px" };
const dangerGhost = { padding: "8px 12px", borderRadius: "999px", border: "1px solid #f3c8ba", background: "#fff5f2", color: "#a33622", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer" };
const empty = { textAlign: "center", padding: "30px 10px" };
const emptyTitle = { margin: "8px 0 4px", fontSize: "18px", fontWeight: "normal", color: "#3d2200" };
const emptyText = { margin: "0 0 12px", color: "#9b7040", fontFamily: "sans-serif", fontSize: "14px", textAlign: "center" };
