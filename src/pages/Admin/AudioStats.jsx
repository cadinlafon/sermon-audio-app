import { useEffect, useMemo, useState } from "react";
import { db } from "../../firebase";
import { collection, getDocs } from "firebase/firestore";

const TYPE_LABEL = { sundayschool: "Sunday School", homily: "Homily", sermon: "Sermon" };

export default function AudioStats() {
  const [audioList, setAudioList] = useState([]);
  const [usageByAudio, setUsageByAudio] = useState({});
  const [likesByAudio, setLikesByAudio] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("listens");

  useEffect(() => {
    async function load() {
      try {
        const [audioSnap, usageSnap, savedSnap] = await Promise.all([
          getDocs(collection(db, "audio")),
          getDocs(collection(db, "appUsage")),
          getDocs(collection(db, "saved")),
        ]);

        setAudioList(audioSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        const usage = {};
        usageSnap.docs.forEach((d) => {
          const row = d.data();
          const id = row.sermonId;
          if (!id) return;
          if (!usage[id]) usage[id] = { total: 0, guest: 0, user: 0 };
          usage[id].total++;
          if (row.userId) usage[id].user++;
          else usage[id].guest++;
        });
        setUsageByAudio(usage);

        const likes = {};
        savedSnap.docs.forEach((d) => {
          const id = d.data().sermonId;
          if (!id) return;
          likes[id] = (likes[id] || 0) + 1;
        });
        setLikesByAudio(likes);
      } catch (err) {
        console.error("Unable to load audio stats:", err);
      }
      setLoading(false);
    }
    load();
  }, []);

  const rows = useMemo(() => {
    return audioList.map((audio) => {
      const usage = usageByAudio[audio.id] || { total: 0, guest: 0, user: 0 };
      return {
        ...audio,
        listens: usage.total,
        guestListens: usage.guest,
        userListens: usage.user,
        likes: likesByAudio[audio.id] || 0,
        hasSummary: !!audio.aiSummary,
      };
    });
  }, [audioList, usageByAudio, likesByAudio]);

  const totals = useMemo(() => {
    const totalListens = rows.reduce((sum, r) => sum + r.listens, 0);
    const guestListens = rows.reduce((sum, r) => sum + r.guestListens, 0);
    const userListens = rows.reduce((sum, r) => sum + r.userListens, 0);
    const totalLikes = rows.reduce((sum, r) => sum + r.likes, 0);
    return {
      totalListens,
      guestListens,
      userListens,
      totalLikes,
      guestPct: totalListens ? Math.round((guestListens / totalListens) * 100) : 0,
      userPct: totalListens ? Math.round((userListens / totalListens) * 100) : 0,
    };
  }, [rows]);

  const topListened = useMemo(
    () => [...rows].sort((a, b) => b.listens - a.listens).slice(0, 10).filter((r) => r.listens > 0),
    [rows]
  );
  const maxTopListens = Math.max(...topListened.map((r) => r.listens), 1);

  const filtered = rows
    .filter((r) => typeFilter === "all" || r.type === typeFilter)
    .filter((r) => (r.title || "").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "listens") return b.listens - a.listens;
      if (sortBy === "likes") return b.likes - a.likes;
      return (a.title || "").localeCompare(b.title || "");
    });

  if (loading) return <div style={loadingWrap}>Loading audio stats…</div>;

  return (
    <div style={page}>
      <div style={pageHeader}>
        <h1 style={pageTitle}>Audio Stats</h1>
        <p style={pageSubtitle}>Listens, likes, and who's actually listening — per recording.</p>
      </div>

      <div style={grid}>
        <StatCard icon="🎧" label="Total Listens" value={totals.totalListens} color="#7c3aed" />
        <StatCard icon="❤️" label="Total Likes" value={totals.totalLikes} color="#db2777" />
        <StatCard icon="👤" label="Listens by Users" value={`${totals.userListens} (${totals.userPct}%)`} color="#16a34a" />
        <StatCard icon="👻" label="Listens by Guests" value={`${totals.guestListens} (${totals.guestPct}%)`} color="#c97c2e" />
      </div>

      {topListened.length > 0 && (
        <div style={chartCard}>
          <h2 style={chartTitle}>Most Listened</h2>
          <div style={barList}>
            {topListened.map((r) => (
              <div key={r.id} style={barRow}>
                <span style={barLabel} title={r.title}>{r.title}</span>
                <div style={barTrack}>
                  <div style={{ ...barFill, width: `${(r.listens / maxTopListens) * 100}%` }} />
                </div>
                <span style={barCount}>{r.listens}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={toolbar}>
        <input
          placeholder="Search by title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={searchInput}
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={select}>
          <option value="all">All types</option>
          <option value="sermon">Sermons</option>
          <option value="homily">Homilies</option>
          <option value="sundayschool">Sunday School</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={select}>
          <option value="listens">Sort by Listens</option>
          <option value="likes">Sort by Likes</option>
          <option value="title">Sort by Title</option>
        </select>
      </div>

      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              {["Title", "Type", "Listens", "Guests", "Users", "Likes", "AI Summary"].map((h) => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} style={tr}>
                <td style={{ ...td, ...tdTitle }}>{r.title || "Untitled"}</td>
                <td style={td}>{TYPE_LABEL[r.type] || r.type || "—"}</td>
                <td style={td}>{r.listens}</td>
                <td style={td}>{r.guestListens}</td>
                <td style={td}>{r.userListens}</td>
                <td style={td}>❤️ {r.likes}</td>
                <td style={td}>{r.hasSummary ? "✓" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p style={emptyText}>Nothing matches your search.</p>}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div style={statCard}>
      <div style={{ ...iconWrap, background: color + "18", color }}>{icon}</div>
      <div style={statLabel}>{label}</div>
      <div style={statValue}>{value}</div>
    </div>
  );
}

const page = { maxWidth: "1100px" };
const pageHeader = { marginBottom: "24px" };
const pageTitle = { fontSize: "26px", fontWeight: "normal", color: "#3d2200", margin: "0 0 4px", fontFamily: "'Georgia', serif" };
const pageSubtitle = { fontSize: "14px", color: "#9b7040", fontFamily: "sans-serif", margin: 0 };
const loadingWrap = { padding: "40px", fontFamily: "sans-serif", color: "#9b7040" };

const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "24px" };
const statCard = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "14px", padding: "18px", boxShadow: "0 2px 10px rgba(160,100,40,0.06)" };
const iconWrap = { width: "36px", height: "36px", borderRadius: "9px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", marginBottom: "10px" };
const statLabel = { fontSize: "11px", fontFamily: "sans-serif", color: "#9b7040", marginBottom: "4px", letterSpacing: "0.04em" };
const statValue = { fontSize: "22px", fontWeight: "bold", color: "#3d2200", fontFamily: "sans-serif" };

const chartCard = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "16px", padding: "22px 24px", boxShadow: "0 2px 12px rgba(160,100,40,0.07)", marginBottom: "24px" };
const chartTitle = { fontSize: "16px", fontWeight: "normal", color: "#5c3a1e", fontFamily: "'Georgia', serif", margin: "0 0 16px" };
const barList = { display: "flex", flexDirection: "column", gap: "10px" };
const barRow = { display: "flex", alignItems: "center", gap: "10px" };
const barLabel = { width: "180px", flexShrink: 0, fontSize: "12px", color: "#3d2200", fontFamily: "sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const barTrack = { flex: 1, height: "10px", borderRadius: "999px", background: "#eddfc8", overflow: "hidden" };
const barFill = { height: "100%", background: "linear-gradient(to right, #e08930, #c97c2e)" };
const barCount = { width: "32px", textAlign: "right", flexShrink: 0, fontSize: "12px", fontFamily: "sans-serif", color: "#7a4f10", fontWeight: "600" };

const toolbar = { display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" };
const searchInput = { flex: 1, minWidth: "180px", padding: "9px 14px", borderRadius: "10px", border: "1px solid #eddfc8", background: "#fffdf9", fontSize: "13px", fontFamily: "sans-serif", color: "#3d2200", outline: "none" };
const select = { padding: "9px 14px", borderRadius: "10px", border: "1px solid #eddfc8", background: "#fffdf9", fontSize: "13px", fontFamily: "sans-serif", color: "#3d2200" };

const tableWrap = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "16px", padding: "8px", boxShadow: "0 2px 12px rgba(160,100,40,0.07)", overflowX: "auto" };
const table = { width: "100%", borderCollapse: "collapse", minWidth: "620px" };
const th = { textAlign: "left", padding: "10px 14px", fontSize: "11px", letterSpacing: "0.05em", textTransform: "uppercase", color: "#9b7040", fontFamily: "sans-serif", borderBottom: "1px solid #eddfc8" };
const tr = { borderBottom: "1px solid #f0e4d0" };
const td = { padding: "10px 14px", fontSize: "13px", color: "#5c3a1e", fontFamily: "sans-serif" };
const tdTitle = { color: "#3d2200", fontWeight: "600", maxWidth: "260px" };
const emptyText = { textAlign: "center", color: "#b08050", fontStyle: "italic", fontFamily: "sans-serif", padding: "24px 0" };
