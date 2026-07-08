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

export default function SundaySchool() {
  const [lessons, setLessons] = useState([]);
  const [notices, setNotices] = useState([]);
  const [user, setUser] = useState(null);

  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  const [speakerFilter, setSpeakerFilter] = useState("all");

  const { playSermon } = useAudioPlayer();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    async function fetchLessons() {
      const q = query(collection(db, "audio"), where("type", "==", "sundayschool"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setLessons(data);
    }
    fetchLessons();
  }, []);

  useEffect(() => {
    async function fetchNotices() {
      const snap = await getDocs(collection(db, "pageNotices"));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setNotices(data.filter((n) => n.enabled && (n.page === "sundayschool" || n.page === "all")));
    }
    fetchNotices();
  }, []);

  const handlePlay = async (lesson) => {
    playSermon(lesson);
    if (!user) return;
    await addDoc(collection(db, "appUsage"), { sermonId: lesson.id, userId: user.uid, createdAt: serverTimestamp() });
  };

  const speakers = [...new Set(lessons.map((l) => l.speaker).filter(Boolean))];

  const filtered = lessons.filter((item) =>
    item.title?.toLowerCase().includes(search.toLowerCase()) &&
    (speakerFilter === "all" || item.speaker === speakerFilter)
  );

  const displayList = sortOrder === "desc" ? filtered : [...filtered].reverse();

  return (
    <div style={page}>
      <h1 style={pageTitle}>Sunday School</h1>

      <div style={controls}>
        <button onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")} style={pillButton}>
          {sortOrder === "desc" ? "Oldest first" : "Newest first"}
        </button>
        <input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} style={inputStyle} />
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

      {displayList.map((item) => (
        <div key={item.id} style={card}>
          <h3 style={titleStyle}>{item.title}</h3>
          <p style={speakerStyle}>{item.speaker}</p>
          <button onClick={() => handlePlay(item)} style={playButton}>
            <span style={{ fontSize: "11px" }}>▶</span> Play
          </button>
        </div>
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
const card = { background: "#fffdf9", borderRadius: "18px", padding: "22px 22px 18px", marginBottom: "16px", border: "1px solid #eddfc8", boxShadow: "0 2px 12px rgba(160,100,40,0.07)" };
const titleStyle = { marginBottom: "5px", fontSize: "17px", fontWeight: "normal", color: "#3d2200" };
const speakerStyle = { color: "#9b7040", fontSize: "13px", marginBottom: "14px", fontFamily: "sans-serif" };
const playButton = { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 18px", borderRadius: "999px", border: "none", background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)", color: "#fff8ee", cursor: "pointer", fontSize: "13px", fontFamily: "sans-serif", boxShadow: "0 3px 10px rgba(160,80,20,0.25)" };
const emptyText = { textAlign: "center", color: "#b08050", fontStyle: "italic", fontFamily: "sans-serif", padding: "30px 0" };