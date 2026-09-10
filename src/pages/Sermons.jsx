import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useAudioPlayer } from "../context/AudioPlayerContext";
import AudioCard from "../components/AudioCard";

export default function Sermons() {
  const [sermons, setSermons] = useState([]);
  const [notices, setNotices] = useState([]);
  const [user, setUser] = useState(null);

  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  const [speakerFilter, setSpeakerFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const { playSermon } = useAudioPlayer();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    async function fetchAudio() {
      const q = query(collection(db, "audio"), where("type", "in", ["sermon", "homily"]));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setSermons(data);
    }
    fetchAudio();
  }, []);

  useEffect(() => {
    async function fetchNotices() {
      const snap = await getDocs(collection(db, "pageNotices"));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setNotices(data.filter((n) => n.enabled && (n.page === "sermons" || n.page === "all")));
    }
    fetchNotices();
  }, []);

  const speakers = [...new Set(sermons.map((s) => s.speaker).filter(Boolean))];

  const handlePlay = async (sermon) => {
    playSermon(sermon);
    if (!user) return;
    await addDoc(collection(db, "appUsage"), { sermonId: sermon.id, userId: user.uid, createdAt: serverTimestamp() });
  };

  const saveSummaryLocally = (id, aiSummary) => {
    setSermons((items) => items.map((item) => item.id === id ? { ...item, aiSummary } : item));
  };

  const filtered = sermons.filter((sermon) =>
    sermon.title?.toLowerCase().includes(search.toLowerCase()) &&
    (speakerFilter === "all" || sermon.speaker === speakerFilter) &&
    (typeFilter === "all" || sermon.type === typeFilter)
  );

  const displayList = sortOrder === "desc" ? [...filtered].reverse() : filtered;

  return (
    <div style={page}>
      <h1 style={pageTitle}>Sermons &amp; Homilies</h1>

      <div style={controls}>
        <button onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")} style={pillButton}>
          {sortOrder === "desc" ? "Newest first" : "Oldest first"}
        </button>
        <input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} style={inputStyle} />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={inputStyle}>
          <option value="all">All types</option>
          <option value="sermon">Sermons</option>
          <option value="homily">Homilies</option>
        </select>
        <select value={speakerFilter} onChange={(e) => setSpeakerFilter(e.target.value)} style={inputStyle}>
          <option value="all">All speakers</option>
          {speakers.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {notices.filter((n) => n.position === "top").map((n) => (
        <div key={n.id} style={noticeBox}>
          <strong style={noticeTitle}>{n.title}</strong>
          <p style={noticeMsg}>{n.message}</p>
        </div>
      ))}

      {displayList.length === 0 && <p style={emptyText}>Nothing found — try adjusting your filters.</p>}

      {displayList.map((sermon) => (
        <AudioCard key={sermon.id} audio={sermon} onPlay={handlePlay} onSummarySaved={saveSummaryLocally} />
      ))}

      {notices.filter((n) => n.position === "bottom").map((n) => (
        <div key={n.id} style={noticeBox}>
          <strong style={noticeTitle}>{n.title}</strong>
          <p style={noticeMsg}>{n.message}</p>
        </div>
      ))}
    </div>
  );
}

const page = { padding: "32px 20px 60px", maxWidth: "860px", margin: "0 auto", background: "#fdf8f3", minHeight: "100vh", fontFamily: "'Georgia', serif" };
const pageTitle = { textAlign: "center", marginBottom: "28px", fontSize: "28px", fontWeight: "normal", color: "#3d2200" };
const controls = { display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap", justifyContent: "center" };
const pillButton = { padding: "9px 18px", borderRadius: "999px", border: "1px solid #c8922a", background: "transparent", color: "#7a4f10", cursor: "pointer", fontSize: "13px", fontFamily: "sans-serif" };
const inputStyle = { padding: "9px 16px", borderRadius: "999px", border: "1px solid #eddfc8", fontSize: "13px", fontFamily: "sans-serif", background: "#fffdf9", color: "#3d2200", outline: "none" };
const noticeBox = { background: "#fffbee", border: "1px solid #f0d898", borderRadius: "14px", padding: "14px 18px", marginBottom: "14px" };
const noticeTitle = { fontSize: "15px", color: "#3d2200", fontFamily: "'Georgia', serif" };
const noticeMsg = { fontSize: "13px", color: "#7a5530", fontFamily: "sans-serif", lineHeight: 1.6, margin: "4px 0 0" };
const emptyText = { textAlign: "center", color: "#b08050", fontStyle: "italic", fontFamily: "sans-serif", padding: "30px 0" };
