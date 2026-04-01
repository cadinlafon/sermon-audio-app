import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useAudioPlayer } from "../context/AudioPlayerContext";

export default function SundaySchool() {
  const [lessons, setLessons] = useState([]);
  const [user, setUser] = useState(null);

  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  const [speakerFilter, setSpeakerFilter] = useState("all");

  const { playSermon } = useAudioPlayer();

  //////////////////////////////////////////////////
  // AUTH
  //////////////////////////////////////////////////
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  //////////////////////////////////////////////////
  // FETCH
  //////////////////////////////////////////////////
  useEffect(() => {
    async function fetchLessons() {
      const q = query(
        collection(db, "audio"),
        where("type", "==", "sundayschool"),
        orderBy("createdAt", sortOrder)
      );

      const snapshot = await getDocs(q);

      setLessons(
        snapshot.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }))
      );
    }

    fetchLessons();
  }, [sortOrder]);

  //////////////////////////////////////////////////
  // SPEAKERS
  //////////////////////////////////////////////////
  const speakers = [
    ...new Set(lessons.map((l) => l.speaker).filter(Boolean)),
  ];

  //////////////////////////////////////////////////
  // PLAY
  //////////////////////////////////////////////////
  const handlePlay = async (lesson) => {
    playSermon(lesson);

    if (!user) return;

    await addDoc(collection(db, "appUsage"), {
      sermonId: lesson.id,
      userId: user.uid,
      createdAt: serverTimestamp(),
    });
  };

  //////////////////////////////////////////////////
  // FILTER
  //////////////////////////////////////////////////
  const filtered = lessons.filter((item) => {
    const matchesSearch = item.title
      ?.toLowerCase()
      .includes(search.toLowerCase());

    const matchesSpeaker =
      speakerFilter === "all" || item.speaker === speakerFilter;

    return matchesSearch && matchesSpeaker;
  });

  //////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////
  return (
    <div style={{ padding: "30px", maxWidth: "900px", margin: "0 auto" }}>
      <h1 style={{ textAlign: "center", marginBottom: "25px" }}>
        Sunday School
      </h1>

      {/* CONTROLS */}
      <div style={controls}>
        <button
          onClick={() =>
            setSortOrder(sortOrder === "desc" ? "asc" : "desc")
          }
          style={buttonStyle}
        >
          {sortOrder === "desc" ? "Newest" : "Oldest"}
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
          <option value="all">All Speakers</option>
          {speakers.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* CARDS */}
      {filtered.map((item) => (
        <div key={item.id} style={cardStyle}>
          <div>
            <h3 style={titleStyle}>{item.title}</h3>
            <p style={speakerStyle}>{item.speaker}</p>

            <button
              onClick={() => handlePlay(item)}
              style={playButton}
            >
              ▶ Play
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

//////////////////////////////////////////////////
// STYLES (SAME AS SERMONS)
//////////////////////////////////////////////////

const controls = {
  display: "flex",
  gap: "12px",
  marginBottom: "30px",
  flexWrap: "wrap",
  justifyContent: "center",
};

const cardStyle = {
  position: "relative",
  background: "#fff",
  borderRadius: "16px",
  padding: "20px",
  marginBottom: "20px",
  boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
  border: "1px solid #f1f1f1",
};

const titleStyle = {
  marginBottom: "6px",
  fontSize: "17px",
};

const speakerStyle = {
  color: "#666",
  fontSize: "13px",
  marginBottom: "14px",
};

const playButton = {
  padding: "8px 14px",
  borderRadius: "8px",
  border: "none",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
  fontSize: "13px",
};

const buttonStyle = {
  padding: "10px 16px",
  borderRadius: "999px",
  border: "none",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
  fontSize: "13px",
};

const inputStyle = {
  padding: "10px 14px",
  borderRadius: "999px",
  border: "1px solid #ddd",
  fontSize: "13px",
};