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
import { useNavigate } from "react-router-dom";

export default function YourListens() {
  const [user, setUser] = useState(null);
  const [listens, setListens] = useState([]);
  const [loading, setLoading] = useState(true);

  const { playSermon } = useAudioPlayer();
  const navigate = useNavigate();

  //////////////////////////////////////////////////
  // AUTH
  //////////////////////////////////////////////////
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setLoading(false);
    });
    return () => unsub();
  }, []);

  //////////////////////////////////////////////////
  // FETCH + GROUP LISTENS
  //////////////////////////////////////////////////
  useEffect(() => {
    if (!user) return;

    async function fetchListens() {
      try {
        const q = query(
          collection(db, "listens"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(q);

        const map = {};
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (!map[data.sermonId]) {
            map[data.sermonId] = { ...data, count: 1 };
          } else {
            map[data.sermonId].count += 1;
          }
        });

        setListens(Object.values(map));
      } catch (err) {
        console.error("Fetch listens error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchListens();
  }, [user]);

  //////////////////////////////////////////////////
  // FORMAT DATE
  //////////////////////////////////////////////////
  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    return timestamp.toDate().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  //////////////////////////////////////////////////
  // NOT LOGGED IN
  //////////////////////////////////////////////////
  if (!user && !loading) {
    return (
      <div style={page}>
        <div style={emptyCard}>
          <span style={emptyIcon}>🔒</span>
          <h2 style={emptyTitle}>Sign in to see your listen history</h2>
          <p style={emptyBody}>
            Create a free account to track what you've listened to and pick up where you left off.
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
      <h1 style={pageTitle}>Your Listens</h1>
      <p style={pageSubtitle}>Everything you've played, grouped by sermon.</p>

      {loading && <p style={loadingText}>Loading…</p>}

      {!loading && listens.length === 0 && (
        <div style={emptyCard}>
          <span style={emptyIcon}>🎧</span>
          <h2 style={emptyTitle}>Nothing here yet</h2>
          <p style={emptyBody}>
            Start listening to sermons and they'll show up here.
          </p>
          <button onClick={() => navigate("/sermons")} style={browseButton}>
            Browse Sermons →
          </button>
        </div>
      )}

      {listens.map((item) => (
        <div key={item.sermonId} style={card}>
          <div style={cardTop}>
            <div style={cardInfo}>
              <h3 style={titleStyle}>{item.title}</h3>
              <p style={speakerStyle}>{item.speaker}</p>

              <div style={metaRow}>
                <span style={metaBadge}>
                  {item.count} {item.count === 1 ? "play" : "plays"}
                </span>
                {item.createdAt && (
                  <span style={metaDate}>Last: {formatDate(item.createdAt)}</span>
                )}
              </div>
            </div>

            <button
              style={playButton}
              onClick={() => playSermon(item)}
            >
              <span style={{ fontSize: "11px" }}>▶</span>
            </button>
          </div>
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
  marginBottom: "20px",
};

const browseButton = {
  display: "inline-block",
  padding: "11px 24px",
  borderRadius: "999px",
  border: "none",
  background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)",
  color: "#fff8ee",
  cursor: "pointer",
  fontSize: "14px",
  fontFamily: "sans-serif",
  boxShadow: "0 3px 12px rgba(160,80,20,0.28)",
};

const card = {
  background: "#fffdf9",
  borderRadius: "18px",
  padding: "20px 22px",
  marginBottom: "14px",
  border: "1px solid #eddfc8",
  boxShadow: "0 2px 12px rgba(160,100,40,0.07)",
};

const cardTop = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
};

const cardInfo = {
  flex: 1,
  minWidth: 0,
};

const titleStyle = {
  marginBottom: "4px",
  fontSize: "17px",
  fontWeight: "normal",
  color: "#3d2200",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const speakerStyle = {
  color: "#9b7040",
  fontSize: "13px",
  marginBottom: "10px",
  fontFamily: "sans-serif",
};

const metaRow = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
};

const metaBadge = {
  display: "inline-block",
  fontSize: "11px",
  padding: "2px 9px",
  borderRadius: "999px",
  background: "#f6e4b0",
  color: "#7a5a10",
  fontFamily: "sans-serif",
  letterSpacing: "0.03em",
};

const metaDate = {
  fontSize: "12px",
  color: "#b08050",
  fontFamily: "sans-serif",
};

const playButton = {
  width: "44px",
  height: "44px",
  borderRadius: "50%",
  border: "none",
  background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)",
  color: "#fff8ee",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  boxShadow: "0 3px 10px rgba(160,80,20,0.28)",
  fontSize: "14px",
};