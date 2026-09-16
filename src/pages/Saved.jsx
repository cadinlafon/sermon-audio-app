import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  getDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useAudioPlayer } from "../context/AudioPlayerContext";
import AudioCard from "../components/AudioCard";

export default function Saved() {
  const [user, setUser] = useState(null);
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(true);

  const { playSermon } = useAudioPlayer();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    async function fetchSaved() {
      try {
        const q = query(
          collection(db, "saved"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        const savedAudio = await Promise.all(snap.docs.map(async (savedDoc) => {
          const savedItem = savedDoc.data();
          // Older saves contained only the title and speaker. Fill them from
          // the source document so every saved card has the full feature set.
          const audioDoc = savedItem.sermonId ? await getDoc(doc(db, "audio", savedItem.sermonId)) : null;
          return {
            ...savedItem,
            ...(audioDoc?.exists() ? audioDoc.data() : {}),
            id: savedItem.sermonId || savedDoc.id,
            savedDocId: savedDoc.id,
          };
        }));
        setSaved(savedAudio);
      } catch (err) {
        console.error("Error fetching saved:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchSaved();
  }, [user]);

  //////////////////////////////////////////////////
  // NOT LOGGED IN
  //////////////////////////////////////////////////
  if (!user && !loading) {
    return (
      <div style={page}>
        <div style={emptyCard}>
          <span style={emptyIcon}>🔒</span>
          <h2 style={emptyTitle}>Sign in to see your liked sermons</h2>
          <p style={emptyBody}>
            Create a free account to like sermons and pick up right where you left off.
          </p>
        </div>
      </div>
    );
  }

  const saveSummaryLocally = (id, aiSummary) => {
    setSaved((items) => items.map((item) => item.id === id ? { ...item, aiSummary } : item));
  };

  //////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////
  return (
    <div style={page}>
      <h1 style={pageTitle}>Liked Sermons</h1>
      <p style={pageSubtitle}>Sermons you've liked for later.</p>

      {loading && (
        <p style={loadingText}>Loading…</p>
      )}

      {!loading && saved.length === 0 && (
        <div style={emptyCard}>
          <span style={emptyIcon}>🤍</span>
          <h2 style={emptyTitle}>Nothing liked yet</h2>
          <p style={emptyBody}>
            Tap the heart icon on any sermon to like it and find it here for easy access.
          </p>
        </div>
      )}

      {saved.map((item) => (
        <AudioCard
          key={item.savedDocId || item.id}
          audio={item}
          onPlay={playSermon}
          onSummarySaved={saveSummaryLocally}
          onSaveChange={(isSaved, id) => !isSaved && setSaved((items) => items.filter((savedItem) => savedItem.id !== id))}
        />
      ))}
    </div>
  );
}

//////////////////////////////////////////////////
// STYLES
//////////////////////////////////////////////////

const page = {
  padding: "32px 20px 60px",
  maxWidth: "680px",
  margin: "0 auto",
  background: "#fdf8f3",
  minHeight: "100vh",
  fontFamily: "'Georgia', serif",
};

const pageTitle = {
  textAlign: "center",
  fontSize: "28px",
  fontWeight: "normal",
  color: "#3d2200",
  marginBottom: "6px",
};

const pageSubtitle = {
  textAlign: "center",
  color: "#9b7040",
  fontFamily: "sans-serif",
  fontSize: "15px",
  marginBottom: "32px",
};

const loadingText = {
  textAlign: "center",
  color: "#b08050",
  fontStyle: "italic",
  fontFamily: "sans-serif",
  padding: "30px 0",
};

const emptyCard = {
  background: "#fffdf9",
  borderRadius: "20px",
  padding: "48px 32px",
  textAlign: "center",
  border: "1px solid #eddfc8",
  boxShadow: "0 2px 14px rgba(160,100,40,0.07)",
  maxWidth: "480px",
  margin: "0 auto",
};

const emptyIcon = {
  fontSize: "36px",
  display: "block",
  marginBottom: "14px",
};

const emptyTitle = {
  fontSize: "20px",
  fontWeight: "normal",
  color: "#3d2200",
  marginBottom: "10px",
};

const emptyBody = {
  fontSize: "15px",
  color: "#9b7040",
  lineHeight: 1.7,
  fontFamily: "sans-serif",
  margin: 0,
};
