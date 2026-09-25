import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAudioPlayer } from "../context/AudioPlayerContext";
import { useToast } from "../context/ToastContext";
import useOnlineStatus from "../hooks/useOnlineStatus";
import {
  MAX_DOWNLOADS, listDownloads, getRemoteDownloads, removeOfflineDownload, getDownloadRecord, restoreDownloadRecord,
  downloadMany, getPendingDownloads, cancelPendingDownload, processPendingDownloads,
} from "../utils/offlineDownloads";

const TYPE_LABEL = { sermon: "Sermon", homily: "Homily", sundayschool: "Sunday School" };
const TABS = [["all", "All"], ["sermon", "Sermons"], ["homily", "Homilies"], ["sundayschool", "Sunday School"]];

const formatBytes = (b) => {
  if (!b) return "0 MB";
  const mb = b / 1048576;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
};
const formatDate = (ms) => (ms ? new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—");

export default function Downloads() {
  const navigate = useNavigate();
  const { playSermon } = useAudioPlayer();
  const { toast } = useToast();
  const online = useOnlineStatus();

  const [user, setUser] = useState(auth.currentUser);
  const [items, setItems] = useState(null); // on this device
  const [remote, setRemote] = useState([]); // charged to the account
  const [pending, setPending] = useState([]);
  const [tab, setTab] = useState("all");
  const [onDeviceOnly, setOnDeviceOnly] = useState(true);
  const [storage, setStorage] = useState(null);
  const [busy, setBusy] = useState("");

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const refresh = useCallback(async () => {
    if (!user) { setItems([]); return; }
    try { setItems(await listDownloads(user.uid)); } catch { setItems([]); }
    try { setRemote(await getRemoteDownloads(user.uid)); } catch { setRemote([]); }
    setPending(getPendingDownloads(user.uid));
    try { setStorage(await navigator.storage?.estimate?.()); } catch { /* not supported */ }
  }, [user]);

  useEffect(() => {
    refresh();
    window.addEventListener("downloads-changed", refresh);
    window.addEventListener("pending-downloads-changed", refresh);
    return () => {
      window.removeEventListener("downloads-changed", refresh);
      window.removeEventListener("pending-downloads-changed", refresh);
    };
  }, [refresh]);

  const totalSize = useMemo(() => (items || []).reduce((s, i) => s + i.size, 0), [items]);
  const visible = useMemo(() => (items || []).filter((i) => tab === "all" || i.meta.type === tab).sort((a, b) => b.downloadedAt - a.downloadedAt), [items, tab]);
  const localIds = useMemo(() => new Set((items || []).map((i) => i.audioId)), [items]);
  const otherDevices = remote.filter((r) => !localIds.has(r.audioId));
  const slotsUsed = Math.max(remote.length, (items || []).length);
  const slotsLeft = Math.max(0, MAX_DOWNLOADS - slotsUsed);

  ////////////////////////////////////////////////
  // ACTIONS
  ////////////////////////////////////////////////
  const play = (meta) => playSermon(meta).then(() => navigate("/player"));

  const remove = async (d) => {
    const record = await getDownloadRecord(user.uid, d.audioId);
    await removeOfflineDownload(user, d.audioId);
    toast(`Removed “${d.meta.title}”`, {
      action: { label: "Undo", onClick: async () => { if (record) { await restoreDownloadRecord(user, record); toast("Download restored", { type: "success" }); } } },
    });
  };

  const removeAll = async () => {
    if (!window.confirm(`Delete all ${items.length} downloads from this device? You can download them again later.`)) return;
    setBusy("all");
    for (const d of items) await removeOfflineDownload(user, d.audioId);
    setBusy("");
    toast("All downloads removed");
  };

  const releaseRemote = async (r) => {
    await removeOfflineDownload(user, r.audioId);
    toast(`Freed a slot (“${r.title || "download"}”)`, { type: "success" });
  };

  const fetchAudioOfType = async (type) => {
    const q = type ? query(collection(db, "audio"), where("type", "==", type)) : collection(db, "audio");
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.order ?? 0) - (a.order ?? 0));
  };

  const bulk = async (label, getAudios) => {
    if (!online) { toast("You're offline — connect to download.", { type: "error" }); return; }
    setBusy(label);
    try {
      const audios = await getAudios();
      if (audios.length === 0) { toast("Nothing to download yet."); return; }
      const result = await downloadMany(user, audios);
      const bits = [];
      if (result.done) bits.push(`Downloaded ${result.done}`);
      if (result.alreadyHad && !result.done) bits.push("Already downloaded");
      if (result.skippedForLimit) bits.push(`${result.skippedForLimit} didn't fit (limit is ${MAX_DOWNLOADS})`);
      toast(bits.join(" · ") || "Nothing new to download", { type: result.done ? "success" : "info" });
    } catch (error) {
      toast(error.message || "Couldn't download.", { type: "error" });
    } finally {
      setBusy("");
      refresh();
    }
  };

  const downloadNewestSermon = () => bulk("newest", async () => (await fetchAudioOfType("sermon")).slice(0, 1));
  const downloadSeries = (type) => bulk(`series-${type}`, () => fetchAudioOfType(type));
  const runPending = async () => {
    setBusy("pending");
    const { done } = await processPendingDownloads(user);
    setBusy("");
    toast(done ? `Downloaded ${done} queued` : "Nothing could be downloaded right now", { type: done ? "success" : "info" });
    refresh();
  };

  ////////////////////////////////////////////////
  // RENDER
  ////////////////////////////////////////////////
  if (!user) {
    return (
      <div style={page}>
        <h1 style={title}>Downloads</h1>
        <div style={empty}>
          <div style={{ fontSize: "36px" }}>🔒</div>
          <p style={emptyText}>Sign in to download audio and listen offline.</p>
          <button style={primary} onClick={() => navigate("/login")}>Sign in</button>
        </div>
      </div>
    );
  }

  const quotaPct = storage?.quota ? Math.min(100, ((storage.usage || 0) / storage.quota) * 100) : 0;

  return (
    <div style={page}>
      <h1 style={title}>Downloads</h1>
      <p style={subtitle}>Audio saved on this device for listening without a connection.</p>

      {/* STORAGE */}
      <div style={card}>
        <div style={statsGrid}>
          <Stat label="Downloads" value={`${slotsUsed} of ${MAX_DOWNLOADS}`} hint={slotsLeft ? `${slotsLeft} slot${slotsLeft === 1 ? "" : "s"} free` : "Full — remove one to add more"} />
          <Stat label="Used by downloads" value={formatBytes(totalSize)} hint="on this device" />
          {storage?.quota ? <Stat label="Device storage free" value={formatBytes(Math.max(0, storage.quota - (storage.usage || 0)))} hint={`${formatBytes(storage.usage || 0)} used by this app`} /> : <Stat label="Device storage" value="—" hint="not reported by this browser" />}
        </div>
        {storage?.quota ? (
          <div style={{ marginTop: "12px" }} aria-label="Storage used">
            <div style={barTrack}><div style={{ ...barFill, width: `${Math.max(2, quotaPct)}%` }} /></div>
          </div>
        ) : null}
      </div>

      {/* QUICK DOWNLOADS */}
      <div style={card}>
        <h2 style={h2}>Get more</h2>
        <div style={btnRow}>
          <button style={primary} onClick={downloadNewestSermon} disabled={!!busy}>{busy === "newest" ? "Downloading…" : "⬇ Download newest sermon"}</button>
          {["sermon", "homily", "sundayschool"].map((t) => (
            <button key={t} style={secondary} onClick={() => downloadSeries(t)} disabled={!!busy}>
              {busy === `series-${t}` ? "Downloading…" : `Download ${TYPE_LABEL[t]} series`}
            </button>
          ))}
        </div>
        <p style={note}>“Series” downloads newest first, up to your {MAX_DOWNLOADS}-download limit.</p>
      </div>

      {/* QUEUED FOR LATER */}
      {pending.length > 0 && (
        <div style={card}>
          <div style={rowBetween}>
            <h2 style={h2}>Queued for later ({pending.length})</h2>
            <button style={secondary} onClick={runPending} disabled={!!busy || !online}>{busy === "pending" ? "Downloading…" : online ? "Download now" : "Waiting for connection"}</button>
          </div>
          {pending.map((a) => (
            <div key={a.id} style={row}>
              <div style={rowMain}><div style={rowTitle}>{a.title}</div><div style={rowSub}>{a.speaker} · downloads automatically when online</div></div>
              <button style={ghost} onClick={() => cancelPendingDownload(user, a.id)}>Cancel</button>
            </div>
          ))}
        </div>
      )}

      {/* LIST */}
      <div style={tabsRow} role="tablist">
        {TABS.map(([v, l]) => (
          <button key={v} role="tab" aria-selected={tab === v} style={tab === v ? { ...tabBtn, ...tabOn } : tabBtn} onClick={() => setTab(v)}>{l}</button>
        ))}
        <label style={toggle}>
          <input type="checkbox" checked={onDeviceOnly} onChange={(e) => setOnDeviceOnly(e.target.checked)} /> Offline-only
        </label>
        {items?.length > 0 && <button style={dangerGhost} onClick={removeAll} disabled={!!busy}>Delete all</button>}
      </div>

      {items === null ? (
        <p style={emptyText}>Loading…</p>
      ) : visible.length === 0 ? (
        <div style={empty}>
          <div style={{ fontSize: "36px" }}>⬇</div>
          <h3 style={emptyTitle}>{tab === "all" ? "No downloads yet" : "Nothing in this category"}</h3>
          <p style={emptyText}>Tap the ⬇ button on any recording, or use “Download newest sermon” above.</p>
        </div>
      ) : (
        visible.map((d) => (
          <div key={d.audioId} style={row}>
            <div style={rowMain}>
              <div style={rowTitle}>{d.meta.title}</div>
              <div style={rowSub}>
                {d.meta.speaker} · <span style={typePill}>{TYPE_LABEL[d.meta.type] || "Audio"}</span> · {formatBytes(d.size)} · {formatDate(d.downloadedAt)}
              </div>
              <div style={availability}><span style={dot} aria-hidden="true" /> Available offline</div>
            </div>
            <div style={rowActions}>
              <button style={smallPrimary} onClick={() => play(d.meta)}>▶ Play</button>
              <button style={dangerGhost} onClick={() => remove(d)} aria-label={`Delete download ${d.meta.title}`}>Delete</button>
            </div>
          </div>
        ))
      )}

      {!onDeviceOnly && otherDevices.length > 0 && (
        <div style={{ marginTop: "18px" }}>
          <h2 style={h2}>On your other devices</h2>
          <p style={note}>These count toward your {MAX_DOWNLOADS} downloads but aren't stored on this device (so they won't play offline here).</p>
          {otherDevices.map((r) => (
            <div key={r.audioId} style={row}>
              <div style={rowMain}>
                <div style={rowTitle}>{r.title || "Download"}</div>
                <div style={rowSub}>{formatDate(r.downloadedAt)}</div>
                <div style={{ ...availability, color: "#8a7860" }}><span style={{ ...dot, background: "#c9b79c" }} aria-hidden="true" /> Not on this device</div>
              </div>
              <button style={ghost} onClick={() => releaseRemote(r)}>Free slot</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div style={stat}>
      <div style={statLabel}>{label}</div>
      <div style={statValue}>{value}</div>
      <div style={statHint}>{hint}</div>
    </div>
  );
}

const page = { padding: "32px 20px 60px", maxWidth: "760px", margin: "0 auto", background: "#fdf8f3", minHeight: "100vh", fontFamily: "'Georgia', serif" };
const title = { textAlign: "center", margin: "0 0 6px", fontSize: "28px", fontWeight: "normal", color: "#3d2200" };
const subtitle = { textAlign: "center", margin: "0 0 22px", fontSize: "14px", color: "#9b7040", fontFamily: "sans-serif" };
const card = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "16px", padding: "16px", marginBottom: "14px" };
const statsGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" };
const stat = { background: "#fdf8f3", borderRadius: "12px", padding: "12px" };
const statLabel = { fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#9b7040", fontFamily: "sans-serif" };
const statValue = { fontSize: "22px", color: "#3d2200", margin: "4px 0 2px" };
const statHint = { fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif" };
const barTrack = { height: "8px", background: "#eddfc8", borderRadius: "999px", overflow: "hidden" };
const barFill = { height: "100%", background: "linear-gradient(to right, #e08930, #c97c2e)", borderRadius: "999px" };
const h2 = { margin: "0 0 10px", fontSize: "16px", fontWeight: "600", color: "#3d2200", fontFamily: "sans-serif" };
const btnRow = { display: "flex", flexWrap: "wrap", gap: "8px" };
const note = { margin: "10px 0 0", fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif" };
const rowBetween = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "6px" };
const tabsRow = { display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", margin: "18px 0 12px" };
const tabBtn = { padding: "8px 14px", borderRadius: "999px", border: "1px solid #eddfc8", background: "#fffdf9", color: "#7a4f10", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
const tabOn = { background: "#fde8b8", borderColor: "#e5c27a", fontWeight: "600" };
const toggle = { display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontFamily: "sans-serif", color: "#5c3a1e", marginLeft: "auto" };
const row = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "14px", padding: "14px", marginBottom: "10px" };
const rowMain = { minWidth: 0, flex: "1 1 240px" };
const rowTitle = { fontSize: "15px", color: "#3d2200", marginBottom: "3px" };
const rowSub = { fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif" };
const rowActions = { display: "flex", gap: "8px" };
const typePill = { padding: "1px 8px", borderRadius: "999px", background: "#f6e4b0", color: "#7a5a10", fontSize: "11px" };
const availability = { display: "flex", alignItems: "center", gap: "6px", marginTop: "6px", fontSize: "12px", color: "#2f8a4a", fontFamily: "sans-serif", fontWeight: "600" };
const dot = { width: "8px", height: "8px", borderRadius: "50%", background: "#2f8a4a", display: "inline-block" };
const primary = { padding: "10px 16px", borderRadius: "999px", border: "none", background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", fontSize: "13px", fontFamily: "sans-serif", fontWeight: "600", cursor: "pointer" };
const smallPrimary = { ...primary, padding: "8px 14px" };
const secondary = { padding: "10px 14px", borderRadius: "999px", border: "1px solid #eddfc8", background: "#fdf8f3", color: "#7a4f10", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
const ghost = { ...secondary, padding: "8px 12px" };
const dangerGhost = { padding: "8px 12px", borderRadius: "999px", border: "1px solid #f3c8ba", background: "#fff5f2", color: "#a33622", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer" };
const empty = { textAlign: "center", padding: "36px 10px" };
const emptyTitle = { margin: "8px 0 4px", fontSize: "18px", fontWeight: "normal", color: "#3d2200" };
const emptyText = { margin: "0 0 12px", color: "#9b7040", fontFamily: "sans-serif", fontSize: "14px" };
