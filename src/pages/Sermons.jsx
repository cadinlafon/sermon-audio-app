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

export default function Sermons() {
  const [sermons, setSermons] = useState([]);
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
      const q = query(
        collection(db, "audio"),
        where("type", "in", ["sermon", "homily"])
      );

      const snapshot = await getDocs(q);

      const data = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }));

      // Oldest → newest base order
      data.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      setSermons(data);
    }

    fetchAudio();
  }, []);

  const speakers = [
    ...new Set(sermons.map((s) => s.speaker).filter(Boolean)),
  ];

  const handlePlay = async (sermon) => {
    playSermon(sermon);

    if (!user) return;

    await addDoc(collection(db, "appUsage"), {
      sermonId: sermon.id,
      userId: user.uid,
      createdAt: serverTimestamp(),
    });
  };

  const filtered = sermons.filter((sermon) => {
    const matchesSearch = sermon.title
      ?.toLowerCase()
      .includes(search.toLowerCase());

    const matchesSpeaker =
      speakerFilter === "all" || sermon.speaker === speakerFilter;

    const matchesType =
      typeFilter === "all" || sermon.type === typeFilter;

    return matchesSearch && matchesSpeaker && matchesType;
  });

  // NEWEST FIRST by default
  const displayList =
    sortOrder === "desc"
      ? [...filtered].reverse()
      : filtered;

  return (
    <div style={page}>
      <h1 style={pageTitle}>Sermons &amp; Homilies</h1>

      <div style={controls}>
        <button
          onClick={() =>
            setSortOrder(sortOrder === "desc" ? "asc" : "desc")
          }
          style={pillButton}
        >
          {sortOrder === "desc"
            ? "Newest first"
            : "Oldest first"}
        </button>

        <input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={inputStyle}
        />

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={inputStyle}
        >
          <option value="all">All types</option>
          <option value="sermon">Sermons</option>
          <option value="homily">Homilies</option>
        </select>

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

      {displayList.length === 0 && (
        <p style={emptyText}>
          Nothing found — try adjusting your filters.
        </p>
      )}

      {displayList.map((sermon) => (
        <div key={sermon.id} style={card}>
          <span style={tagStyle(sermon.type)}>
            {sermon.type === "homily"
              ? "Homily"
              : "Sermon"}
          </span>

          <h3 style={titleStyle}>{sermon.title}</h3>

          <p style={speakerStyle}>{sermon.speaker}</p>

          <button
            onClick={() => handlePlay(sermon)}
            style={playButton}
          >
            <span style={{ fontSize: "11px" }}>▶</span>
            Play
          </button>
        </div>
      ))}
    </div>
  );
}

const page = {
  padding: "32px 20px 60px",
  maxWidth: "860px",
  margin: "0 auto",
  background: "#fdf8f3",
  minHeight: "100vh",
  fontFamily: "'Georgia', serif",
};

const pageTitle = {
  textAlign: "center",
  marginBottom: "28px",
  fontSize: "28px",
  fontWeight: "normal",
  color: "#3d2200",
};

const controls = {
  display: "flex",
  gap: "10px",
  marginBottom: "28px",
  flexWrap: "wrap",
  justifyContent: "center",
};

const pillButton = {
  padding: "9px 18px",
  borderRadius: "999px",
  border: "1px solid #c8922a",
  background: "transparent",
  color: "#7a4f10",
  cursor: "pointer",
  fontSize: "13px",
  fontFamily: "sans-serif",
};

const inputStyle = {
  padding: "9px 16px",
  borderRadius: "999px",
  border: "1px solid #eddfc8",
  fontSize: "13px",
  fontFamily: "sans-serif",
  background: "#fffdf9",
  color: "#3d2200",
  outline: "none",
};

const card = {
  position: "relative",
  background: "#fffdf9",
  borderRadius: "18px",
  padding: "22px 22px 18px",
  marginBottom: "16px",
  border: "1px solid #eddfc8",
  boxShadow: "0 2px 12px rgba(160,100,40,0.07)",
};

const tagStyle = (type) => ({
  display: "inline-block",
  fontSize: "11px",
  padding: "3px 10px",
  borderRadius: "999px",
  background:
    type === "homily" ? "#e8f0fe" : "#f6e4b0",
  color:
    type === "homily" ? "#2a5ab5" : "#7a5a10",
  fontFamily: "sans-serif",
  marginBottom: "10px",
  letterSpacing: "0.04em",
});

const titleStyle = {
  marginBottom: "5px",
  fontSize: "17px",
  fontWeight: "normal",
  color: "#3d2200",
};

const speakerStyle = {
  color: "#9b7040",
  fontSize: "13px",
  marginBottom: "14px",
  fontFamily: "sans-serif",
};

const playButton = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "8px 18px",
  borderRadius: "999px",
  border: "none",
  background:
    "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)",
  color: "#fff8ee",
  cursor: "pointer",
  fontSize: "13px",
  fontFamily: "sans-serif",
  boxShadow: "0 3px 10px rgba(160,80,20,0.25)",
};

const emptyText = {
  textAlign: "center",
  color: "#b08050",
  fontStyle: "italic",
  fontFamily: "sans-serif",
  padding: "30px 0",
};