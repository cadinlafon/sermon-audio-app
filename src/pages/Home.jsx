import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import NoticeItem from "../components/NoticeItem";
import { db, auth } from "../firebase";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { logEvent } from "../utils/logEvent";
import { useAudioPlayer } from "../context/AudioPlayerContext";

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

export default function Home() {
  const navigate = useNavigate();

  const [notices, setNotices] = useState([]);
  const [inProgress, setInProgress] = useState([]);

  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [homeDataLoading, setHomeDataLoading] = useState(true);

  const { playSermon } = useAudioPlayer();

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
      setHomeDataLoading(true);
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
      setHomeDataLoading(true);
      try {
        const noticePromise = getDocs(
          query(collection(db, "notices"), orderBy("createdAt", "desc"))
        );
        const progressPromise = user
          ? getDocs(query(collection(db, "listenProgress"), where("userId", "==", user.uid)))
          : Promise.resolve(null);
        const [noticeSnap, progressSnap] = await Promise.all([noticePromise, progressPromise]);
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

        let resolvedProgress = [];

        // Continue Listening — last 3 recordings this listener actually
        // started but hasn't finished. A single where("userId","==") is
        // the only filter applied server-side (status + ordering happen
        // client-side below) so this never needs a composite Firestore
        // index — same pattern useGoalData.js already relies on.
        if (progressSnap) {
          const recent = progressSnap.docs
            .map((d) => d.data())
            .filter((p) => p.status === "in-progress" && p.audioId)
            .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0))
            .slice(0, 3);

          const resolved = await Promise.all(
            recent.map(async (p) => {
              const audioSnap = await getDoc(doc(db, "audio", p.audioId));
              if (!audioSnap.exists()) return null;
              return { progress: p, audio: { id: audioSnap.id, ...audioSnap.data() } };
            })
          );

          resolvedProgress = resolved.filter(Boolean);
        }

        setNotices(filtered);
        setInProgress(resolvedProgress);
      } catch (error) {
        console.error("Error loading home data:", error);
      } finally {
        setHomeDataLoading(false);
      }
    }

    fetchData();
  }, [authLoaded, user, isAdmin]);

  //////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////
  const showContinueLoading = !authLoaded || (homeDataLoading && !!user);
  const showNoticesLoading = !authLoaded || homeDataLoading;

  return (
    <div style={pageWrapper}>

      {/* HERO */}
      <div style={heroWrapper}>
        <div style={heroImage} />
        
      </div>
      <div style={contentArea}>

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

        {/* CONTINUE LISTENING */}
        {showContinueLoading ? (
          <div style={card} role="status" aria-label="Loading Continue Listening" aria-busy="true">
            <div style={cardHeader}>
              <span style={cardIcon}>⏯️</span>
              <h2 style={cardTitle}>Continue Listening</h2>
            </div>
            {[0, 1, 2].map((row) => (
              <div key={row} style={loadingContinueItem}>
                <div style={continueInfo}>
                  <div style={{ ...skeletonLine, width: "62%" }} />
                  <div style={{ ...skeletonLine, width: "38%", height: "10px", marginTop: "8px" }} />
                  <div style={{ ...skeletonLine, width: "100%", height: "5px", marginTop: "12px" }} />
                </div>
                <div style={skeletonResumeButton} />
              </div>
            ))}
          </div>
        ) : inProgress.length > 0 && (
          <div style={card}>
            <div style={cardHeader}>
              <span style={cardIcon}>⏯️</span>
              <h2 style={cardTitle}>Continue Listening</h2>
            </div>

            {inProgress.map(({ progress, audio }, index) => {
              const pct = progress.duration
                ? Math.min(100, Math.round((progress.position / progress.duration) * 100))
                : 0;
              const isLast = index === inProgress.length - 1;

              return (
                <div key={audio.id} style={isLast ? { ...continueItem, borderBottom: "none", paddingBottom: 0 } : continueItem}>
                  <div style={continueInfo}>
                    <h4 style={continueTitle}>{audio.title}</h4>
                    <p style={continueSpeaker}>{audio.speaker}</p>

                    <div style={progressTrack}>
                      <div style={{ ...progressFill, width: `${pct}%` }} />
                    </div>
                    <p style={progressLabel}>
                      {formatTime(progress.position)} of {formatTime(progress.duration)}
                    </p>
                  </div>

                  <button
                    style={resumeButton}
                    onClick={() => {
                      logEvent("continue_listening_resume", { audioId: audio.id });
                      playSermon(audio, { resumeAt: progress.position });
                    }}
                  >
                    <span style={playIcon}>▶</span> Resume
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* NOTICES */}
        {showNoticesLoading ? (
          <div style={card} role="status" aria-label="Loading notices" aria-busy="true">
            <div style={cardHeader}>
              <span style={cardIcon}>📌</span>
              <h2 style={cardTitle}>Notices</h2>
            </div>
            {[0, 1].map((row) => (
              <div key={row} style={skeletonNotice}>
                <div style={{ ...skeletonLine, width: "48%" }} />
                <div style={{ ...skeletonLine, width: "92%", marginTop: "12px" }} />
                <div style={{ ...skeletonLine, width: "74%", marginTop: "7px" }} />
              </div>
            ))}
          </div>
        ) : notices.length > 0 && (
          <div style={card}>
            <div style={cardHeader}>
              <span style={cardIcon}>📌</span>
              <h2 style={cardTitle}>Notices</h2>
            </div>

            {notices.map((n) => (
              <NoticeItem key={n.id} notice={n} user={user} />
            ))}
          </div>
        )}
      </div>
      <div style={footerLink}>
          <a href="/audio-app" style={footerAnchor}>Audio app info</a>
        </div>
    </div>
  );
}

//////////////////////////////////////////////////
// STYLES
//////////////////////////////////////////////////

const pageWrapper = {
  background: "var(--color-fdf8f3)",
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
  color: "var(--color-fff8ee)",
  fontFamily: "'Georgia', serif",
  lineHeight: 1.2,
};

const contentArea = {
  padding: "32px 20px 60px",
  maxWidth: "680px",
  margin: "0 auto",
};

const card = {
  backgroundColor: "var(--color-fffdf9)",
  borderRadius: "18px",
  padding: "24px 24px 20px",
  marginBottom: "24px",
  border: "1px solid var(--color-eddfc8)",
  boxShadow: "0 2px 16px rgba(160,100,40,0.07)",
};

const skeletonLine = {
  height: "12px",
  borderRadius: "999px",
  background: "var(--color-eddfc8)",
};

const loadingContinueItem = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  padding: "12px 0",
  borderBottom: "1px solid var(--color-f0e4d0)",
  minHeight: "68px",
};

const skeletonResumeButton = {
  width: "82px",
  height: "34px",
  flexShrink: 0,
  borderRadius: "999px",
  background: "var(--color-eddfc8)",
};

const skeletonNotice = {
  background: "var(--color-fffbee)",
  border: "1px solid var(--color-f0d898)",
  padding: "14px 16px",
  borderRadius: "12px",
  marginBottom: "10px",
};

const cardHeader = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  marginBottom: "18px",
  borderBottom: "1px solid var(--color-eddfc8)",
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
  color: "var(--color-5c3a1e)",
  fontFamily: "'Georgia', serif",
  letterSpacing: "0.01em",
};

const continueItem = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  padding: "12px 0",
  borderBottom: "1px solid var(--color-f0e4d0)",
};

const continueInfo = {
  flex: 1,
  minWidth: 0,
};

const continueTitle = {
  margin: "0 0 2px",
  fontSize: "15px",
  fontWeight: "normal",
  color: "var(--color-3d2200)",
  fontFamily: "'Georgia', serif",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const continueSpeaker = {
  margin: "0 0 8px",
  fontSize: "12px",
  color: "var(--color-9b7040)",
  fontFamily: "sans-serif",
};

const progressTrack = {
  height: "5px",
  borderRadius: "999px",
  background: "var(--color-eddfc8)",
  overflow: "hidden",
  marginBottom: "5px",
};

const progressFill = {
  height: "100%",
  background: "linear-gradient(to right, var(--color-e08930), var(--color-c97c2e))",
};

const progressLabel = {
  margin: 0,
  fontSize: "11px",
  color: "var(--color-b08050)",
  fontFamily: "sans-serif",
};

const resumeButton = {
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "9px 16px",
  borderRadius: "999px",
  border: "none",
  background: "linear-gradient(135deg, var(--color-c97c2e) 0%, var(--color-a85e18) 100%)",
  color: "var(--color-fff8ee)",
  cursor: "pointer",
  fontSize: "13px",
  fontFamily: "sans-serif",
  boxShadow: "0 3px 10px rgba(160,80,20,0.25)",
};






const sermonBlock = {
  textAlign: "center",
  padding: "10px 0 6px",
};

const sermonTitle = {
  margin: "0 0 6px",
  fontSize: "20px",
  fontWeight: "normal",
  color: "var(--color-3d2200)",
  fontFamily: "'Georgia', serif",
  lineHeight: 1.3,
};

const sermonSpeaker = {
  margin: "0 0 20px",
  fontSize: "14px",
  color: "var(--color-9b7040)",
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
  background: "linear-gradient(135deg, var(--color-c97c2e) 0%, var(--color-a85e18) 100%)",
  color: "var(--color-fff8ee)",
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
  color: "var(--color-b08050)",
  fontSize: "14px",
  fontFamily: "sans-serif",
  textAlign: "center",
  padding: "12px 0",
  fontStyle: "italic",
};

const navButtons = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "12px",
  marginBottom: "16px",
};

const navButton = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  minWidth: 0,
  boxSizing: "border-box",
  padding: "18px 14px",
  fontSize: "15px",
  borderRadius: "14px",
  border: "1px solid var(--color-eddfc8)",
  backgroundColor: "var(--color-fffdf9)",
  color: "var(--color-3d2200)",
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
  color: "var(--color-c08040)",
  fontSize: "18px",
};

const footerLink = {
  textAlign: "center",
  marginTop: "20px",
};

const footerAnchor = {
  fontSize: "11px",
  color: "var(--color-b08050)",
  opacity: 0.7,
  textDecoration: "none",
  fontFamily: "sans-serif",
};