import { useState } from "react";
import { usePlaylists, STARTER_NAMES } from "../context/PlaylistContext";
import { useToast } from "../context/ToastContext";
import PlaylistCover from "./PlaylistCover";

// "＋ Playlist" popup on an audio card: tick the playlists it belongs in, or
// start a new one.
export default function AddToPlaylistModal({ audio, onClose }) {
  const pl = usePlaylists();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const toggle = async (p) => {
    setBusy(true);
    try {
      if (p.items.some((i) => i.id === audio.id)) {
        await pl.removeItem(p.id, audio.id);
        toast(`Removed from “${p.name}”`);
      } else {
        await pl.addItems(p.id, [audio]);
        toast(`Added to “${p.name}”`, { type: "success" });
      }
    } catch (e) { toast(e.message || "Couldn't update the playlist.", { type: "error" }); }
    setBusy(false);
  };

  const create = async (n) => {
    if (!(n || name).trim()) return;
    setBusy(true);
    try {
      const created = await pl.create(n || name);
      await pl.addItems(created.id, [audio]);
      toast(`Added to “${created.name}”`, { type: "success" });
      setName("");
    } catch (e) { toast(e.message || "Couldn't create the playlist.", { type: "error" }); }
    setBusy(false);
  };

  const unused = STARTER_NAMES.filter((n) => !pl.playlists.some((p) => p.name.toLowerCase() === n.toLowerCase())).slice(0, 4);

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={sheet} role="dialog" aria-modal="true" aria-label="Add to playlist" onClick={(e) => e.stopPropagation()}>
        <div style={head}><h3 style={title}>Add to playlist</h3><button style={x} onClick={onClose} aria-label="Close">✕</button></div>
        <p style={sub}>{audio.title}</p>

        {!pl.user ? (
          <p style={sub}>Sign in to make playlists.</p>
        ) : (
          <>
            <div style={list}>
              {pl.playlists.length === 0 && <p style={sub}>No playlists yet — start one below.</p>}
              {pl.playlists.map((p) => {
                const inIt = p.items.some((i) => i.id === audio.id);
                return (
                  <button key={p.id} style={row} onClick={() => toggle(p)} disabled={busy} aria-pressed={inIt}>
                    <PlaylistCover cover={p.cover} size={36} radius={10} />
                    <span style={{ flex: 1, textAlign: "left" }}>{p.name}<span style={count}> · {p.items.length}</span></span>
                    <span style={{ ...check, ...(inIt ? checkOn : null) }}>{inIt ? "✓" : "＋"}</span>
                  </button>
                );
              })}
            </div>
            <div style={newRow}>
              <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="New playlist name" onKeyDown={(e) => e.key === "Enter" && create()} maxLength={60} />
              <button style={primary} onClick={() => create()} disabled={busy || !name.trim()}>Create</button>
            </div>
            {unused.length > 0 && (
              <div style={chips}>
                {unused.map((n) => <button key={n} style={chip} onClick={() => create(n)} disabled={busy}>＋ {n}</button>)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const backdrop = { position: "fixed", inset: 0, background: "rgba(40,18,0,0.5)", zIndex: 6000, display: "flex", alignItems: "flex-end", justifyContent: "center" };
const sheet = { background: "#fffdf9", width: "100%", maxWidth: "480px", borderRadius: "22px 22px 0 0", padding: "20px 20px calc(env(safe-area-inset-bottom, 0px) + 20px)", maxHeight: "80vh", overflowY: "auto", fontFamily: "sans-serif" };
const head = { display: "flex", justifyContent: "space-between", alignItems: "center" };
const title = { margin: 0, fontSize: "19px", fontWeight: "normal", color: "#3d2200", fontFamily: "'Georgia', serif" };
const x = { width: "34px", height: "34px", borderRadius: "50%", border: "1px solid #eddfc8", background: "#fdf8f3", cursor: "pointer", color: "#7a4f10" };
const sub = { margin: "4px 0 12px", fontSize: "13px", color: "#9b7040" };
const list = { display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" };
const row = { display: "flex", alignItems: "center", gap: "12px", padding: "8px 10px", borderRadius: "12px", border: "1px solid #eddfc8", background: "#fdf8f3", cursor: "pointer", fontSize: "14px", color: "#3d2200" };
const count = { color: "#9b7040", fontSize: "12px" };
const check = { width: "30px", height: "30px", borderRadius: "50%", background: "#f0e4d0", color: "#7a4f10", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px" };
const checkOn = { background: "#2f8a4a", color: "#fff" };
const newRow = { display: "flex", gap: "8px" };
const input = { flex: 1, padding: "10px 14px", borderRadius: "999px", border: "1px solid #eddfc8", background: "#fdf8f3", fontSize: "14px", color: "#3d2200" };
const primary = { padding: "10px 18px", borderRadius: "999px", border: "none", background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", fontWeight: "600", cursor: "pointer", fontSize: "13px" };
const chips = { display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" };
const chip = { padding: "7px 12px", borderRadius: "999px", border: "1px solid #eddfc8", background: "transparent", color: "#7a4f10", fontSize: "12px", cursor: "pointer" };
