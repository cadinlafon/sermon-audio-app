import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";
import { usePlaylists, playlistDuration, COVER_EMOJIS, COVER_COLORS } from "../context/PlaylistContext";
import { useAudioPlayer } from "../context/AudioPlayerContext";
import { useToast } from "../context/ToastContext";
import { downloadMany, MAX_DOWNLOADS } from "../utils/offlineDownloads";
import { loadAudioList } from "../utils/audioListCache";
import PlaylistCover from "../components/PlaylistCover";

const fmt = (s) => { const n = Number(s); if (!n) return ""; const h = Math.floor(n / 3600); const m = Math.floor((n % 3600) / 60); return h ? `${h}:${String(m).padStart(2, "0")}:00`.replace(/:00$/, "") + "h" : `${m} min`; };

export default function PlaylistDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const store = usePlaylists();
  const { playAll, playSermon, addAllToQueue } = useAudioPlayer();
  const { toast } = useToast();

  const mine = store.playlists.find((p) => p.id === id) || null;
  const [shared, setShared] = useState(null); // public copy of someone else's playlist
  const [sharedState, setSharedState] = useState("idle"); // idle | loading | missing
  const [sortMode, setSortMode] = useState("manual");
  const [editing, setEditing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mine || store.loading) return undefined;
    let cancelled = false;
    setSharedState("loading");
    getDoc(doc(db, "playlists", id))
      .then((snap) => { if (cancelled) return; if (snap.exists() && snap.data().public) { setShared({ id: snap.id, ...snap.data() }); setSharedState("idle"); } else setSharedState("missing"); })
      .catch(() => !cancelled && setSharedState("missing"));
    return () => { cancelled = true; };
  }, [id, mine, store.loading]);

  const playlist = mine || shared;
  const isOwner = !!mine;

  const items = useMemo(() => {
    if (!playlist) return [];
    return sortMode === "recent" ? [...playlist.items].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)) : playlist.items;
  }, [playlist, sortMode]);

  if (store.loading || sharedState === "loading") return <Shell><p style={muted}>Loading…</p></Shell>;
  if (!playlist) {
    return (
      <Shell>
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <div style={{ fontSize: "36px" }}>🎶</div>
          <h2 style={h2}>Playlist not found</h2>
          <p style={muted}>It may have been deleted or made private.</p>
          <button style={primary} onClick={() => navigate("/playlists")}>Back to playlists</button>
        </div>
      </Shell>
    );
  }

  const shareUrl = `${window.location.origin}/playlists/${playlist.id}`;

  const goPlayer = () => navigate("/player");
  const onPlay = () => { if (!items.length) return; playAll(items); goPlayer(); };
  const onShuffle = () => { if (!items.length) return; const a = [...items]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } playAll(a); goPlayer(); };

  const onDownload = async () => {
    if (!auth.currentUser) { toast("Sign in to download.", { type: "error" }); return; }
    setBusy(true);
    try {
      const r = await downloadMany(auth.currentUser, items);
      toast([r.done && `Downloaded ${r.done}`, r.alreadyHad && `${r.alreadyHad} already downloaded`, r.skippedForLimit && `${r.skippedForLimit} didn't fit (limit ${MAX_DOWNLOADS})`].filter(Boolean).join(" · ") || "Nothing to download", { type: r.done ? "success" : "info" });
    } catch (e) { toast(e.message || "Couldn't download.", { type: "error" }); }
    setBusy(false);
  };

  const copy = async (text, msg) => { try { await navigator.clipboard.writeText(text); toast(msg, { type: "success" }); } catch { toast("Couldn't copy.", { type: "error" }); } };
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: playlist.name, text: playlist.description || `${playlist.items.length} recordings`, url: shareUrl }); } catch { /* cancelled */ } }
    else copy(shareUrl, "Link copied");
  };
  const togglePublic = async () => {
    try {
      await store.setPublic(playlist.id, !playlist.public);
      toast(playlist.public ? "Playlist is private again." : "Anyone with the link can now listen.", { type: "success" });
    } catch (e) { toast(`Couldn't change sharing: ${e.message || "check Firestore rules for the playlists collection"}`, { type: "error" }); }
  };
  const saveCopy = async () => {
    try {
      const created = await store.create(`${playlist.name} (copy)`, playlist.description || "");
      await store.addItems(created.id, playlist.items);
      toast("Saved to your playlists", { type: "success" });
      navigate(`/playlists/${created.id}`);
    } catch (e) { toast(e.message || "Couldn't save.", { type: "error" }); }
  };

  const removeItem = async (item, index) => {
    await store.removeItem(playlist.id, item.id);
    toast(`Removed “${item.title}”`, { action: { label: "Undo", onClick: () => store.insertItem(playlist.id, item, index) } });
  };

  return (
    <Shell>
      <button style={back} onClick={() => navigate("/playlists")}>← Playlists</button>

      <div style={header}>
        <PlaylistCover cover={playlist.cover} size={96} radius={22} />
        <div style={{ minWidth: 0, flex: 1 }}>
          {isOwner && editing ? (
            <>
              <input style={nameInput} value={playlist.name} onChange={(e) => store.update(playlist.id, { name: e.target.value })} maxLength={60} aria-label="Playlist name" />
              <textarea style={descInput} value={playlist.description || ""} onChange={(e) => store.update(playlist.id, { description: e.target.value })} placeholder="Add a description" maxLength={300} aria-label="Description" />
            </>
          ) : (
            <>
              <h1 style={h1}>{playlist.name}</h1>
              {playlist.description && <p style={desc}>{playlist.description}</p>}
            </>
          )}
          <p style={meta}>
            {playlist.items.length} recording{playlist.items.length === 1 ? "" : "s"}{playlistDuration(playlist) ? ` · ${playlistDuration(playlist)}` : ""}
            {!isOwner && playlist.ownerName ? ` · by ${playlist.ownerName}` : ""}
          </p>
        </div>
      </div>

      {editing && isOwner && (
        <div style={card}>
          <div style={label}>Cover</div>
          <div style={coverRow}>
            {COVER_EMOJIS.map((e) => <button key={e} style={playlist.cover?.emoji === e ? { ...coverBtn, ...coverOn } : coverBtn} onClick={() => store.update(playlist.id, { cover: { ...playlist.cover, emoji: e } })} aria-label={`Cover ${e}`}>{e}</button>)}
          </div>
          <div style={coverRow}>
            {COVER_COLORS.map(([a, b], i) => <button key={i} style={{ ...swatch, background: `linear-gradient(135deg, ${a}, ${b})`, outline: (playlist.cover?.color ?? 0) === i ? "3px solid #3d2200" : "none" }} onClick={() => store.update(playlist.id, { cover: { ...playlist.cover, color: i } })} aria-label={`Color ${i + 1}`} />)}
          </div>
          <label style={toggleRow}>
            <span><strong>Public</strong><span style={muted}> — anyone with the link can listen</span></span>
            <input type="checkbox" checked={!!playlist.public} onChange={togglePublic} />
          </label>
        </div>
      )}

      <div style={actions}>
        <button style={primary} onClick={onPlay} disabled={!items.length}>▶ Play</button>
        <button style={secondary} onClick={onShuffle} disabled={!items.length}>🔀 Shuffle</button>
        <button style={secondary} onClick={() => { addAllToQueue(items); toast("Added to queue", { type: "success" }); }} disabled={!items.length}>＋ Queue</button>
        <button style={secondary} onClick={onDownload} disabled={busy || !items.length}>{busy ? "Downloading…" : "⬇ Download"}</button>
        <button style={secondary} onClick={share}>↗ Share</button>
        {isOwner ? (
          <button style={secondary} onClick={() => setEditing((v) => !v)}>{editing ? "✓ Done" : "✎ Edit"}</button>
        ) : (
          auth.currentUser && <button style={secondary} onClick={saveCopy}>＋ Save a copy</button>
        )}
      </div>
      {isOwner && playlist.public && !editing && (
        <p style={muted}>Public link: <button style={linkBtn} onClick={() => copy(shareUrl, "Link copied")}>{shareUrl.replace(/^https?:\/\//, "")} ⧉</button></p>
      )}

      <div style={sortBar}>
        <h2 style={h2}>Recordings</h2>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value)} style={select} aria-label="Sort">
            <option value="manual">Your order</option><option value="recent">Recently added</option>
          </select>
          {isOwner && <button style={secondary} onClick={() => setShowAdd(true)}>＋ Add recordings</button>}
        </div>
      </div>

      {items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "26px 0" }}>
          <div style={{ fontSize: "34px" }}>🎧</div>
          <p style={muted}>{isOwner ? "Empty for now — add recordings here or with the ☰＋ button on any card." : "This playlist is empty."}</p>
        </div>
      ) : (
        <ItemList items={items} playlist={playlist} isOwner={isOwner && sortMode === "manual"} onPlay={(item) => { playSermon(item); goPlayer(); }} onRemove={removeItem} onMove={(from, to) => store.move(playlist.id, from, to)} />
      )}

      {showAdd && <AddRecordings playlist={playlist} onClose={() => setShowAdd(false)} onAdd={(list) => store.addItems(playlist.id, list).then(() => toast(`Added ${list.length}`, { type: "success" }))} />}
    </Shell>
  );
}

function ItemList({ items, playlist, isOwner, onPlay, onRemove, onMove }) {
  const { current, isPlaying } = useAudioPlayer();
  const rowRefs = useRef([]);
  const [drag, setDrag] = useState(null);

  const overAt = (y) => { let over = 0; rowRefs.current.forEach((el, i) => { if (el && y > el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2) over = i; }); return over; };
  const start = (e, from) => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ } setDrag({ from, over: from }); };
  const move = (e) => { if (drag) { const over = overAt(e.clientY); if (over !== drag.over) setDrag({ ...drag, over }); } };
  const end = () => { if (drag && drag.over !== drag.from) onMove(drag.from, drag.over); setDrag(null); };

  return (
    <div onPointerMove={move} onPointerUp={end} onPointerCancel={() => setDrag(null)}>
      {items.map((item, i) => {
        const now = current?.id === item.id;
        return (
          <div key={item.id} ref={(el) => { rowRefs.current[i] = el; }} style={{ ...row, opacity: drag?.from === i ? 0.5 : 1, borderTop: drag && drag.over === i && drag.from > i ? "2px solid #c97c2e" : "2px solid transparent", borderBottom: drag && drag.over === i && drag.from < i ? "2px solid #c97c2e" : "2px solid transparent" }}>
            {isOwner && (
              <button style={handle} onPointerDown={(e) => start(e, i)} onKeyDown={(e) => { if (e.key === "ArrowUp") { e.preventDefault(); onMove(i, i - 1); } if (e.key === "ArrowDown") { e.preventDefault(); onMove(i, i + 1); } }} aria-label={`Reorder ${item.title}. Drag or use arrow keys.`} title="Drag to reorder">⋮⋮</button>
            )}
            <button style={rowMain} onClick={() => onPlay(item)}>
              <span style={rowTitle}>{now && isPlaying ? "🔊 " : ""}{item.title}</span>
              <span style={rowSub}>{item.speaker}{fmt(item.duration) ? ` · ${fmt(item.duration)}` : ""}</span>
            </button>
            {isOwner && <button style={x} onClick={() => onRemove(item, playlist.items.findIndex((p) => p.id === item.id))} aria-label={`Remove ${item.title}`}>✕</button>}
          </div>
        );
      })}
    </div>
  );
}

function AddRecordings({ playlist, onClose, onAdd }) {
  const [all, setAll] = useState(null);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState(new Set());

  useEffect(() => {
    loadAudioList(async () => (await getDocs(collection(db, "audio"))).docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.order ?? 0) - (a.order ?? 0)), () => true).then(setAll);
  }, []);

  const have = new Set(playlist.items.map((i) => i.id));
  const shown = (all || []).filter((a) => !have.has(a.id) && `${a.title} ${a.speaker}`.toLowerCase().includes(q.toLowerCase()));
  const toggle = (a) => setPicked((s) => { const n = new Set(s); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n; });

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={sheet} role="dialog" aria-modal="true" aria-label="Add recordings" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h3 style={h2}>Add recordings</h3><button style={x} onClick={onClose} aria-label="Close">✕</button></div>
        <input style={nameInput} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" aria-label="Search recordings" />
        <div style={{ maxHeight: "46vh", overflowY: "auto", margin: "10px 0" }}>
          {all === null && <p style={muted}>Loading…</p>}
          {all && shown.length === 0 && <p style={muted}>Nothing more to add.</p>}
          {shown.map((a) => (
            <label key={a.id} style={pickRow}><input type="checkbox" checked={picked.has(a.id)} onChange={() => toggle(a)} /><span><span style={rowTitle}>{a.title}</span><span style={rowSub}>{a.speaker}</span></span></label>
          ))}
        </div>
        <button style={primary} disabled={picked.size === 0} onClick={() => { onAdd((all || []).filter((a) => picked.has(a.id))); onClose(); }}>Add {picked.size || ""} selected</button>
      </div>
    </div>
  );
}

function Shell({ children }) { return <div style={page}>{children}</div>; }

const page = { padding: "24px 20px 60px", maxWidth: "720px", margin: "0 auto", background: "#fdf8f3", minHeight: "100vh", fontFamily: "'Georgia', serif" };
const back = { background: "none", border: "none", color: "#9b7040", fontFamily: "sans-serif", fontSize: "14px", cursor: "pointer", padding: "4px 0", marginBottom: "14px" };
const header = { display: "flex", gap: "18px", alignItems: "center", marginBottom: "16px" };
const h1 = { margin: "0 0 4px", fontSize: "26px", fontWeight: "normal", color: "#3d2200" };
const h2 = { margin: 0, fontSize: "17px", fontWeight: "600", color: "#3d2200", fontFamily: "sans-serif" };
const desc = { margin: "0 0 4px", fontSize: "14px", color: "#7a5530", fontFamily: "sans-serif" };
const meta = { margin: 0, fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif" };
const muted = { fontSize: "13px", color: "#9b7040", fontFamily: "sans-serif" };
const nameInput = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "10px", border: "1px solid #eddfc8", background: "#fffdf9", fontSize: "18px", fontFamily: "'Georgia', serif", color: "#3d2200" };
const descInput = { width: "100%", boxSizing: "border-box", marginTop: "8px", padding: "10px 12px", borderRadius: "10px", border: "1px solid #eddfc8", background: "#fffdf9", fontSize: "13px", fontFamily: "sans-serif", color: "#3d2200", resize: "vertical", minHeight: "60px" };
const card = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "14px", padding: "14px", marginBottom: "14px", fontFamily: "sans-serif" };
const label = { fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#9b7040", marginBottom: "8px" };
const coverRow = { display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" };
const coverBtn = { width: "42px", height: "42px", borderRadius: "12px", border: "1px solid #eddfc8", background: "#fdf8f3", fontSize: "20px", cursor: "pointer" };
const coverOn = { borderColor: "#c97c2e", background: "#fff1d6" };
const swatch = { width: "34px", height: "34px", borderRadius: "50%", border: "none", cursor: "pointer", outlineOffset: "2px" };
const toggleRow = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", fontSize: "13px", color: "#3d2200", cursor: "pointer" };
const actions = { display: "flex", gap: "8px", flexWrap: "wrap", margin: "0 0 14px" };
const primary = { padding: "10px 18px", borderRadius: "999px", border: "none", background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", fontSize: "13px", fontFamily: "sans-serif", fontWeight: "600", cursor: "pointer" };
const secondary = { padding: "10px 14px", borderRadius: "999px", border: "1px solid #eddfc8", background: "#fffdf9", color: "#7a4f10", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
const linkBtn = { background: "none", border: "none", color: "#a85e18", fontSize: "12px", cursor: "pointer", textDecoration: "underline", padding: 0 };
const sortBar = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap", margin: "18px 0 10px" };
const select = { padding: "8px 12px", borderRadius: "999px", border: "1px solid #eddfc8", background: "#fffdf9", fontSize: "12px", fontFamily: "sans-serif", color: "#3d2200" };
const row = { display: "flex", alignItems: "center", gap: "6px", background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "12px", padding: "8px 10px", marginBottom: "8px" };
const rowMain = { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2px", background: "none", border: "none", textAlign: "left", cursor: "pointer", padding: "4px" };
const rowTitle = { display: "block", fontSize: "14px", color: "#3d2200" };
const rowSub = { display: "block", fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif" };
const handle = { border: "none", background: "transparent", color: "#b08050", fontSize: "18px", padding: "0 6px", cursor: "grab", touchAction: "none", letterSpacing: "-3px", minWidth: "30px", minHeight: "40px" };
const x = { width: "32px", height: "32px", borderRadius: "50%", border: "none", background: "#f4e7d4", color: "#7a4f10", cursor: "pointer", fontSize: "12px", flexShrink: 0 };
const backdrop = { position: "fixed", inset: 0, background: "rgba(40,18,0,0.5)", zIndex: 6000, display: "flex", alignItems: "flex-end", justifyContent: "center" };
const sheet = { background: "#fffdf9", width: "100%", maxWidth: "520px", borderRadius: "22px 22px 0 0", padding: "20px 20px calc(env(safe-area-inset-bottom, 0px) + 20px)", fontFamily: "sans-serif" };
const pickRow = { display: "flex", alignItems: "center", gap: "10px", padding: "8px 4px", borderBottom: "1px solid #f0e4d0", cursor: "pointer" };
