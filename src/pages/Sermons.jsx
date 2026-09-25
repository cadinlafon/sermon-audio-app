import { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { useAudioPlayer } from "../context/AudioPlayerContext";
import useAudioList from "../hooks/useAudioList";
import useOnlineStatus from "../hooks/useOnlineStatus";
import AudioCard from "../components/AudioCard";
import PlayAllBar from "../components/PlayAllBar";
import useAudioFilters from "../hooks/useAudioFilters";
import AudioFilterBar, { NoResults } from "../components/AudioFilterBar";
import SkeletonList from "../components/Skeleton";

export default function Sermons() {
  const [notices, setNotices] = useState([]);


  const { playSermon } = useAudioPlayer();

  const isOnline = useOnlineStatus();
  const [sermons, setSermons, loading] = useAudioList(
    async () => {
      const q = query(collection(db, "audio"), where("type", "in", ["sermon", "homily"]));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      return data;
    },
    (a) => a.type === "sermon" || a.type === "homily"
  );

  useEffect(() => {
    async function fetchNotices() {
      const snap = await getDocs(collection(db, "pageNotices"));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setNotices(data.filter((n) => n.enabled && (n.page === "sermons" || n.page === "all")));
    }
    fetchNotices();
  }, []);

  const f = useAudioFilters(sermons, "sermons");

  const saveSummaryLocally = (id, aiSummary) => {
    setSermons((items) => items.map((item) => item.id === id ? { ...item, aiSummary } : item));
  };

  const displayList = f.result;

  return (
    <div style={page}>
      <h1 style={pageTitle}>Sermons &amp; Homilies</h1>

      <AudioFilterBar f={f} showType loading={loading} />

      {notices.filter((n) => n.position === "top").map((n) => (
        <div key={n.id} style={noticeBox}>
          <strong style={noticeTitle}>{n.title}</strong>
          <p style={noticeMsg}>{n.message}</p>
        </div>
      ))}

      {loading && sermons.length === 0 && <SkeletonList />}
      {!loading && displayList.length === 0 && <NoResults f={f} offlineNothing={!isOnline && sermons.length === 0} />}

      <PlayAllBar items={displayList} filtered={f.chips.length > 0} />
      {displayList.map((sermon) => (
        <AudioCard key={sermon.id} audio={sermon} onPlay={playSermon} onSummarySaved={saveSummaryLocally} />
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
