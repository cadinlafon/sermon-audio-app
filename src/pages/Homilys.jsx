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

export default function Homilies() {
  const [homilies, setHomilies] = useState([]);
  const [notices, setNotices] = useState([]);
  const [user, setUser] = useState(null);

  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  const [speakerFilter, setSpeakerFilter] = useState("all");

  const { playSermon } = useAudioPlayer();

  ////////////////////////////////////////////////
  // AUTH
  ////////////////////////////////////////////////
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  ////////////////////////////////////////////////
  // FETCH AUDIO
  ////////////////////////////////////////////////
  useEffect(() => {
    async function fetchHomilies() {
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
      setHomilies(data);
    }

    fetchHomilies();
  }, []);

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

  ////////////////////////////////////////////////
  // PLAY
  ////////////////////////////////////////////////
  const handlePlay = async (item) => {
    playSermon(item);

    if (!user) return;

    await addDoc(collection(db, "appUsage"), {
      sermonId: item.id,
      userId: user.uid,
      createdAt: serverTimestamp(),
    });
  };

  ////////////////////////////////////////////////
  // FILTER
  ////////////////////////////////////////////////
  const speakers = [
    ...new Set(homilies.map((h) => h.speaker).filter(Boolean)),
  ];

  const filtered = homilies.filter((item) => {
    return (
      item.title?.toLowerCase().includes(search.toLowerCase()) &&
      (speakerFilter === "all" || item.speaker === speakerFilter)
    );
  });

  const displayList =
    sortOrder === "desc" ? filtered : [...filtered].reverse();

  ////////////////////////////////////////////////
  // UI
  ////////////////////////////////////////////////
  return (
    <div style={page}>
      <h1 style={pageTitle}>Homilies</h1>

      {/* CONTROLS */}
      <div style={controls}>
        <button
          onClick={() =>
            setSortOrder(sortOrder === "desc" ? "asc" : "desc")
          }
          style={pillButton}
        >
          {sortOrder === "desc" ? "Oldest first" : "Newest first"}
        </button>

        <input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={inputStyle}
        />

        <select
          value={speakerFilter}
          onChange={(e) => setSpeakerFilter(e.target.value)}
          style={inputStyle}
        >
          <option value="all">All speakers</option>
          {speakers.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

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
      {displayList.map((item) => (
        <div key={item.id} style={card}>
          <h3 style={titleStyle}>{item.title}</h3>
          <p style={speakerStyle}>{item.speaker}</p>

          <button
            onClick={() => handlePlay(item)}
            style={playButton}
          >
            ▶ Play
          </button>
        </div>
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

const card = {
  background: "#fff",
  borderRadius: "18px",
  padding: "20px",
  marginBottom: "12px",
};

const titleStyle = {
  fontSize: "16px",
};

const speakerStyle = {
  fontSize: "13px",
  color: "#777",
};

const playButton = {
  marginTop: "10px",
  padding: "8px 16px",
};