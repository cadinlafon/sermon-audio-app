import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useAudioPlayer } from "../context/AudioPlayerContext";

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
        setSaved(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
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
          <h2 style={emptyTitle}>Sign in to see your saved sermons</h2>
          <p style={emptyBody}>
            Create a free account to save sermons and pick up right where you left off.
          </p>
        </div>
      </div>
    );
  }

  //////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////
  return (
    <div style={page}>
      <h1 style={pageTitle}>Saved Sermons</h1>
      <p style={pageSubtitle}>Sermons you've bookmarked for later.</p>

      {loading && (
        <p style={loadingText}>Loading…</p>
      )}

      {!loading && saved.length === 0 && (
        <div style={emptyCard}>
          <span style={emptyIcon}>🔖</span>
          <h2 style={emptyTitle}>Nothing saved yet</h2>
          <p style={emptyBody}>
            Tap the bookmark icon on any sermon to save it here for easy access.
          </p>
        </div>
      )}

      {saved.map((item) => (
        <div key={item.id} style={card}>
          <h3 style={titleStyle}>{item.title}</h3>
          <p style={speakerStyle}>{item.speaker}</p>
          <button onClick={() => playSermon(item)} style={playButton}>
            <span style={{ fontSize: "11px" }}>▶</span> Play
          </button>
        </div>
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

const card = {
  background: "#fffdf9",
  borderRadius: "18px",
  padding: "22px 22px 18px",
  marginBottom: "16px",
  border: "1px solid #eddfc8",
  boxShadow: "0 2px 12px rgba(160,100,40,0.07)",
};

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
  background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)",
  color: "#fff8ee",
  cursor: "pointer",
  fontSize: "13px",
  fontFamily: "sans-serif",
  boxShadow: "0 3px 10px rgba(160,80,20,0.25)",
};