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
import AudioCard from "../components/AudioCard";
import PlayAllBar from "../components/PlayAllBar";
import useAudioFilters from "../hooks/useAudioFilters";
import AudioFilterBar, { NoResults } from "../components/AudioFilterBar";
import SkeletonList from "../components/Skeleton";

export default function Homilies() {
  const [notices, setNotices] = useState([]);


  const { playSermon } = useAudioPlayer();

  ////////////////////////////////////////////////
  // FETCH AUDIO
  ////////////////////////////////////////////////
  const [homilies, setHomilies, loading] = useAudioList(
    async () => {
      const q = query(
        collection(db, "audio"),
        where("type", "==", "homily")
      );

      const snapshot = await getDocs(q);

      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      data.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      return data;
    },
    (a) => a.type === "homily"
  );

  ////////////////////////////////////////////////
  // FETCH NOTICES
  ////////////////////////////////////////////////
  useEffect(() => {
    async function fetchNotices() {
      const snap = await getDocs(collection(db, "pageNotices"));

      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      const filtered = data.filter(
        (n) =>
          n.enabled &&
          (n.page === "homilies" || n.page === "all")
      );

      setNotices(filtered);
    }

    fetchNotices();
  }, []);

  const saveSummaryLocally = (id, aiSummary) => {
    setHomilies((items) => items.map((item) => item.id === id ? { ...item, aiSummary } : item));
  };

  ////////////////////////////////////////////////
  // FILTER
  ////////////////////////////////////////////////
  // Homilies have always listed in fetched order (oldest first).
  const f = useAudioFilters(homilies, "homilies", { defaultSort: "oldest" });
  const displayList = f.result;

  ////////////////////////////////////////////////
  // UI
  ////////////////////////////////////////////////
  return (
    <div style={page}>
      <h1 style={pageTitle}>Homilies</h1>

      <AudioFilterBar f={f} loading={loading} />

      {/* 🔥 NOTICES (TOP) */}
      {notices
        .filter((n) => n.position === "top")
        .map((n) => (
          <div key={n.id} style={noticeBox}>
            <strong>{n.title}</strong>
            <p>{n.message}</p>
          </div>
        ))}

      {/* LIST */}
      {loading && homilies.length === 0 && <SkeletonList />}
      {!loading && displayList.length === 0 && <NoResults f={f} />}
      <PlayAllBar items={displayList} filtered={f.chips.length > 0} />
      {displayList.map((item) => (
        <AudioCard key={item.id} audio={item} onPlay={playSermon} onSummarySaved={saveSummaryLocally} />
      ))}

      {/* 🔥 NOTICES (BOTTOM) */}
      {notices
        .filter((n) => n.position === "bottom")
        .map((n) => (
          <div key={n.id} style={noticeBox}>
            <strong>{n.title}</strong>
            <p>{n.message}</p>
          </div>
        ))}
    </div>
  );
}

/* STYLES */

const noticeBox = {
  background: "#fff3cd",
  border: "1px solid #ffeeba",
  padding: "15px",
  borderRadius: "10px",
  marginBottom: "15px",
};

const page = {
  padding: "32px 20px 60px",
  maxWidth: "860px",
  margin: "0 auto",
  background: "#fdf8f3",
  minHeight: "100vh",
};

const pageTitle = {
  textAlign: "center",
  marginBottom: "28px",
};

const controls = {
  display: "flex",
  gap: "10px",
  marginBottom: "20px",
  flexWrap: "wrap",
  justifyContent: "center",
};

const pillButton = {
  padding: "9px 18px",
};

const inputStyle = {
  padding: "9px 16px",
};
