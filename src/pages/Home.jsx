import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import NoticeInputForm from "../components/NoticeInputForm";
import { db, auth } from "../firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { logEvent } from "../utils/logEvent";

export default function Home() {
  const navigate = useNavigate();

  const [latestSermon, setLatestSermon] = useState(null);
  const [continueListening, setContinueListening] = useState(null);
  const [notices, setNotices] = useState([]);

  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoaded, setAuthLoaded] = useState(false);

  const loggedViewsRef = useRef(new Set());

  //////////////////////////////////////////////////
  // NOTICE VIEW TRACKING
  //////////////////////////////////////////////////
  useEffect(() => {
    for (const n of notices) {
      if (loggedViewsRef.current.has(n.id)) continue;
      loggedViewsRef.current.add(n.id);
      logEvent("notice_view", { noticeId: n.id, noticeTitle: n.title });
    }
  }, [notices]);

  //////////////////////////////////////////////////
  // AUTH
  //////////////////////////////////////////////////
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);

      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));

        if (snap.exists() && snap.data().role === "admin") {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }

      setAuthLoaded(true);
    });

    return () => unsubscribe();
  }, []);

  //////////////////////////////////////////////////
  // LOAD DATA
  //////////////////////////////////////////////////
  useEffect(() => {
    if (!authLoaded) return;

    async function fetchData() {
      try {
        // Latest sermon (type === "sermon" only — homilies/Sunday School excluded)
        const sermonQ = query(
          collection(db, "audio"),
          orderBy("createdAt", "desc"),
          limit(15)
        );

        const sermonSnap = await getDocs(sermonQ);
        const latest = sermonSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .find((a) => a.type === "sermon");

        if (latest) {
          setLatestSermon(latest);
        }

        // Notices
        const noticeQ = query(
          collection(db, "notices"),
          orderBy("createdAt", "desc")
        );

        const noticeSnap = await getDocs(noticeQ);
        const now = new Date();

        const filtered = noticeSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((n) => {
            const notExpired =
              !n.expiresAt ||
              new Date(n.expiresAt.seconds * 1000) > now;

            const visibleTo = n.audience || "all";

            const passesVisibility =
              visibleTo === "all" ||
              (visibleTo === "users" && user) ||
              (visibleTo === "admins" && isAdmin) ||
              (visibleTo === "guests" && !user);

            return n.active !== false && notExpired && passesVisibility;
          });

        // Pinned first
        filtered.sort((a, b) => (b.pinned === true) - (a.pinned === true));

        setNotices(filtered);
      } catch (error) {
        console.error("Error loading home data:", error);
      }
    }

    fetchData();

    const saved = localStorage.getItem("continueListening");
    if (saved) {
      setContinueListening(JSON.parse(saved));
    }
  }, [authLoaded, user, isAdmin]);

  //////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////
  return (
    <div style={pageWrapper}>

      {/* HERO */}
      <div style={heroWrapper}>
        <div style={heroImage} />
        
      </div>

      <div style={contentArea}>

        {/* NOTICES */}
        {notices.length > 0 && (
          <div style={card}>
            <div style={cardHeader}>
              <span style={cardIcon}>📌</span>
              <h2 style={cardTitle}>Notices</h2>
            </div>

            {notices.map((n) => (
              <div key={n.id} style={noticeItem}>
                {n.pinned && <span style={pinnedBadge}>Pinned</span>}
                <h4 style={noticeTitle}>{n.title}</h4>
                <p style={noticeBody}>{n.details}</p>

                {n.buttonEnabled && (
                  <button
                    style={noticeButton}
                    onClick={() => {
                      logEvent("notice_click", { noticeId: n.id, noticeTitle: n.title });
                      if (n.buttonType === "url") {
                        window.open(n.buttonValue, "_blank");
                      } else if (n.buttonType === "page") {
                        navigate(n.buttonValue);
                      }
                    }}
                  >
                    {n.buttonText || "Learn More"} →
                  </button>
                )}

                {n.inputEnabled && <NoticeInputForm notice={n} user={user} />}
              </div>
            ))}
          </div>
        )}

        {/* LATEST AUDIO */}
        <div style={card}>
          <div style={cardHeader}>
            <span style={cardIcon}>🎙️</span>
            <h2 style={cardTitle}>Latest Sermon</h2>
          </div>

          {latestSermon ? (
            <div style={sermonBlock}>
              <h3 style={sermonTitle}>{latestSermon.title}</h3>
              <p style={sermonSpeaker}>{latestSermon.speaker}</p>
              <button
                onClick={() => {
                  localStorage.setItem(
                    "continueListening",
                    JSON.stringify(latestSermon)
                  );
                  navigate("/sermons");
                }}
                style={playButton}
              >
                <span style={playIcon}>▶</span> Play
              </button>
            </div>
          ) : (
            <p style={emptyText}>No sermons uploaded yet — check back soon.</p>
          )}
        </div>

        {/* NAV */}
        <div style={navButtons}>
          <button onClick={() => navigate("/sermons")} style={navButton}>
            <span style={navButtonIcon}>🎧</span>
            <span>Sermons</span>
            <span style={navArrow}>→</span>
          </button>

          <button onClick={() => navigate("/sundayschool")} style={navButton}>
            <span style={navButtonIcon}>📖</span>
            <span>Sunday School</span>
            <span style={navArrow}>→</span>
          </button>
        </div>

        <div style={footerLink}>
          <a href="/audio-app" style={footerAnchor}>Audio app info</a>
        </div>

      </div>
    </div>
  );
}

//////////////////////////////////////////////////
// STYLES
//////////////////////////////////////////////////

const pageWrapper = {
  background: "#fdf8f3",
  minHeight: "100vh",
  fontFamily: "'Georgia', serif",
};

const heroWrapper = {
  position: "relative",
  width: "100%",
  height: "34vh",
  minHeight: "200px",
  overflow: "hidden",
};

const heroImage = {
  position: "absolute",
  inset: 0,
  backgroundImage: `url("/hero.jpg")`,
  backgroundSize: "cover",
  backgroundPosition: "center",
};

const heroOverlay = {
  position: "absolute",
  inset: 0,
  background: "linear-gradient(to top, rgba(60,35,10,0.72) 0%, rgba(60,35,10,0.18) 60%, transparent 100%)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-end",
  padding: "28px 32px",
};

const heroEyebrow = {
  margin: "0 0 4px",
  fontSize: "13px",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "rgba(255,235,200,0.8)",
  fontFamily: "'Georgia', serif",
};

const heroTitle = {
  margin: 0,
  fontSize: "clamp(22px, 5vw, 34px)",
  fontWeight: "normal",
  color: "#fff8ee",
  fontFamily: "'Georgia', serif",
  lineHeight: 1.2,
};

const contentArea = {
  padding: "32px 20px 60px",
  maxWidth: "680px",
  margin: "0 auto",
};

const card = {
  backgroundColor: "#fffdf9",
  borderRadius: "18px",
  padding: "24px 24px 20px",
  marginBottom: "24px",
  border: "1px solid #eddfc8",
  boxShadow: "0 2px 16px rgba(160,100,40,0.07)",
};

const cardHeader = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  marginBottom: "18px",
  borderBottom: "1px solid #eddfc8",
  paddingBottom: "14px",
};

const cardIcon = {
  fontSize: "20px",
  lineHeight: 1,
};

const cardTitle = {
  margin: 0,
  fontSize: "17px",
  fontWeight: "normal",
  color: "#5c3a1e",
  fontFamily: "'Georgia', serif",
  letterSpacing: "0.01em",
};

const noticeItem = {
  background: "#fffbee",
  border: "1px solid #f0d898",
  padding: "14px 16px",
  borderRadius: "12px",
  marginBottom: "10px",
};

const pinnedBadge = {
  display: "inline-block",
  fontSize: "11px",
  fontFamily: "sans-serif",
  background: "#f6e4b0",
  color: "#7a5a10",
  borderRadius: "99px",
  padding: "2px 8px",
  marginBottom: "6px",
  letterSpacing: "0.04em",
};

const noticeTitle = {
  margin: "0 0 5px",
  fontSize: "15px",
  fontWeight: "bold",
  color: "#3d2600",
  fontFamily: "'Georgia', serif",
};

const noticeBody = {
  margin: "0 0 4px",
  fontSize: "14px",
  color: "#6b4c20",
  lineHeight: 1.6,
  whiteSpace: "pre-line",
  fontFamily: "sans-serif",
};

const noticeButton = {
  marginTop: "10px",
  padding: "7px 14px",
  borderRadius: "8px",
  border: "1px solid #c8922a",
  background: "transparent",
  color: "#8a5f10",
  cursor: "pointer",
  fontSize: "13px",
  fontFamily: "sans-serif",
};

const sermonBlock = {
  textAlign: "center",
  padding: "10px 0 6px",
};

const sermonTitle = {
  margin: "0 0 6px",
  fontSize: "20px",
  fontWeight: "normal",
  color: "#3d2200",
  fontFamily: "'Georgia', serif",
  lineHeight: 1.3,
};

const sermonSpeaker = {
  margin: "0 0 20px",
  fontSize: "14px",
  color: "#9b7040",
  fontFamily: "sans-serif",
  letterSpacing: "0.04em",
};

const playButton = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "12px 28px",
  borderRadius: "999px",
  border: "none",
  background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)",
  color: "#fff8ee",
  cursor: "pointer",
  fontSize: "15px",
  fontFamily: "sans-serif",
  letterSpacing: "0.03em",
  boxShadow: "0 4px 14px rgba(160,80,20,0.3)",
};

const playIcon = {
  fontSize: "12px",
};

const emptyText = {
  color: "#b08050",
  fontSize: "14px",
  fontFamily: "sans-serif",
  textAlign: "center",
  padding: "12px 0",
  fontStyle: "italic",
};

const navButtons = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  marginBottom: "8px",
};

const navButton = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  width: "100%",
  padding: "18px 20px",
  fontSize: "16px",
  borderRadius: "14px",
  border: "1px solid #eddfc8",
  backgroundColor: "#fffdf9",
  color: "#3d2200",
  cursor: "pointer",
  fontFamily: "'Georgia', serif",
  boxShadow: "0 1px 6px rgba(160,100,40,0.06)",
  textAlign: "left",
};

const navButtonIcon = {
  fontSize: "20px",
  lineHeight: 1,
};

const navArrow = {
  marginLeft: "auto",
  color: "#c08040",
  fontSize: "18px",
};

const footerLink = {
  textAlign: "center",
  marginTop: "20px",
};

const footerAnchor = {
  fontSize: "11px",
  color: "#b08050",
  opacity: 0.7,
  textDecoration: "none",
  fontFamily: "sans-serif",
};