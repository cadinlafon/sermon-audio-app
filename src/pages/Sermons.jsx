import { useEffect, useState, useRef } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  setDoc,
  doc,
  getDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { logEvent } from "../utils/logEvent";
import { trackListenTime } from "../utils/listenTracker";
import { toggleSaveSermon } from "../utils/saveSermon";

export default function Sermons() {
  const [sermons, setSermons] = useState([]);
  const [user, setUser] = useState(null);
  const [progressMap, setProgressMap] = useState({});
  const [savedMap, setSavedMap] = useState({});
  const audioRefs = useRef({});

  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  const [speakerFilter, setSpeakerFilter] = useState("all");

  //////////////////////////////////////////////////
  // AUTH
  //////////////////////////////////////////////////
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  //////////////////////////////////////////////////
  // LOAD SAVED
  //////////////////////////////////////////////////
  useEffect(() => {
    if (!user) return;

    async function loadSaved() {
      const q = query(
        collection(db, "saved"),
        where("userId", "==", user.uid)
      );

      const snap = await getDocs(q);
      const map = {};

      snap.docs.forEach((d) => {
        map[d.data().sermonId] = true;
      });

      setSavedMap(map);
    }

    loadSaved();
  }, [user]);

  //////////////////////////////////////////////////
  // FETCH
  //////////////////////////////////////////////////
  useEffect(() => {
    async function fetchSermons() {
      const q = query(
        collection(db, "audio"),
        where("type", "==", "sermon"),
        orderBy("createdAt", sortOrder)
      );

      const snapshot = await getDocs(q);

      setSermons(
        snapshot.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }))
      );
    }

    fetchSermons();
  }, [sortOrder]);

  //////////////////////////////////////////////////
  // SPEAKERS
  //////////////////////////////////////////////////
  const speakers = [
    ...new Set(sermons.map((s) => s.speaker).filter(Boolean)),
  ];

  //////////////////////////////////////////////////
  // LOAD PROGRESS
  //////////////////////////////////////////////////
  useEffect(() => {
    if (!user) return;

    async function loadProgress() {
      const progress = {};

      for (const sermon of sermons) {
        const snap = await getDoc(
          doc(db, "listeningProgress", `${user.uid}_${sermon.id}`)
        );

        if (snap.exists()) {
          progress[sermon.id] = snap.data().time;
        }
      }

      setProgressMap(progress);
    }

    loadProgress();
  }, [user, sermons]);

  //////////////////////////////////////////////////
  // SAVE PROGRESS
  //////////////////////////////////////////////////
  const saveProgress = async (sermonId, time) => {
    if (!user) return;

    await setDoc(
      doc(db, "listeningProgress", `${user.uid}_${sermonId}`),
      {
        userId: user.uid,
        sermonId,
        time,
        updatedAt: serverTimestamp(),
      }
    );
  };

  //////////////////////////////////////////////////
  // PLAY
  //////////////////////////////////////////////////
  const handlePlay = async (sermon) => {
    const cleanData = {
      userId: user?.uid || null,
      sermonId: sermon.id,
      title: sermon.title || "Untitled",
      speaker: sermon.speaker || "Unknown",
    };

    await trackListenTime(cleanData);

    await addDoc(collection(db, "appUsage"), {
      ...cleanData,
      createdAt: serverTimestamp(),
    });

    await logEvent("sermon_play", cleanData);
  };

  //////////////////////////////////////////////////
  // FILTER
  //////////////////////////////////////////////////
  const filtered = sermons.filter((sermon) => {
    const matchesSearch = sermon.title
      ?.toLowerCase()
      .includes(search.toLowerCase());

    const matchesSpeaker =
      speakerFilter === "all" || sermon.speaker === speakerFilter;

    return matchesSearch && matchesSpeaker;
  });

  //////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////
  return (
    <div style={{ padding: "30px", maxWidth: "900px", margin: "0 auto" }}>
      
      <h1 style={{ textAlign: "center", marginBottom: "25px" }}>
        Sermons
      </h1>

      {/* 🔥 CONTROLS BAR */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "30px",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <button
          onClick={() =>
            setSortOrder(sortOrder === "desc" ? "asc" : "desc")
          }
          style={buttonStyle}
        >
          {sortOrder === "desc" ? "Newest" : "Oldest"}
        </button>

        <input
          placeholder="Search sermons..."
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

      {/* 🔥 CARDS */}
      {filtered.map((sermon) => (
        <div key={sermon.id} style={cardStyle}>
          
          <div style={{ paddingRight: "30px" }}>
            <h3 style={{ marginBottom: "6px", fontSize: "18px" }}>
              {sermon.title}
            </h3>

            <p style={{ color: "#666", fontSize: "14px", marginBottom: "12px" }}>
              {sermon.speaker}
            </p>

            <audio
              ref={(el) => (audioRefs.current[sermon.id] = el)}
              controls
              style={{ width: "100%" }}
              onLoadedMetadata={() => {
                const savedTime = progressMap[sermon.id];
                if (savedTime && audioRefs.current[sermon.id]) {
                  audioRefs.current[sermon.id].currentTime = savedTime;
                }
              }}
              onPlay={() => handlePlay(sermon)}
              onTimeUpdate={(e) => {
  const currentTime = e.target.currentTime;

  if (Math.floor(currentTime) % 10 === 0) {
    saveProgress(sermon.id, currentTime);

    trackListenTime({
      userId: user?.uid,
      sermonId: sermon.id,
      title: sermon.title,
      speaker: sermon.speaker,
      seconds: 10,
    });
  }
}}
            >
              <source src={sermon.audioURL} type="audio/mpeg" />
            </audio>
          </div>

          {/* ⭐ SAVE BUTTON */}
          {user && (
            <button
              onClick={async () => {
                const result = await toggleSaveSermon(user.uid, sermon);
                setSavedMap((prev) => ({
                  ...prev,
                  [sermon.id]: result,
                }));
              }}
              style={{
                position: "absolute",
                top: "15px",
                right: "15px",
                fontSize: "22px",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: savedMap[sermon.id] ? "gold" : "#ccc",
              }}
            >
              ★
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

//////////////////////////////////////////////////
// 🎨 STYLES
//////////////////////////////////////////////////

const cardStyle = {
  position: "relative",
  background: "#fff",
  borderRadius: "16px",
  padding: "20px",
  marginBottom: "20px",
  boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
  border: "1px solid #f1f1f1",
  transition: "transform 0.2s ease, box-shadow 0.2s ease",
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