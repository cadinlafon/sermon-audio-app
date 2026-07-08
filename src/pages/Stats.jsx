import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const BADGES = [
  { name: "Newbie",  icon: "🌱", hours: 0  },
  { name: "Novice",  icon: "📖", hours: 4  },
  { name: "Pro",     icon: "🎙️", hours: 8  },
  { name: "Scholar", icon: "🏛️", hours: 14 },
  { name: "Master",  icon: "⭐", hours: 20 },
];

export default function Stats() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  //////////////////////////////////////////////////
  // AUTH
  //////////////////////////////////////////////////
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoaded(true);
    });
    return () => unsubscribe();
  }, []);

  //////////////////////////////////////////////////
  // FETCH STATS
  //////////////////////////////////////////////////
  useEffect(() => {
    if (!user) return;

    async function fetchStats() {
      const ref = doc(db, "userStats", user.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        setStats({ totalHours: 0, topSermons: [], favoriteSpeaker: "N/A" });
        return;
      }

      const data = snap.data();
      const totalHours = (data.totalSeconds || 0) / 3600;

      const sermons = data.sermons || {};
      const topSermons = Object.entries(sermons)
        .map(([id, s]) => ({ title: s.title, count: s.count || 0 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      const speakers = data.speakers || {};
      const favoriteSpeaker =
        Object.entries(speakers).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

      setStats({ totalHours, topSermons, favoriteSpeaker });
    }

    fetchStats();
  }, [user]);

  //////////////////////////////////////////////////
  // CURRENT BADGE
  //////////////////////////////////////////////////
  const currentBadge = stats
    ? [...BADGES].reverse().find((b) => stats.totalHours >= b.hours) || BADGES[0]
    : null;

  const nextBadge = stats
    ? BADGES.find((b) => stats.totalHours < b.hours)
    : null;

  //////////////////////////////////////////////////
  // NOT LOGGED IN
  //////////////////////////////////////////////////
  if (authLoaded && !user) {
    return (
      <div style={page}>
        <div style={emptyCard}>
          <span style={emptyIcon}>🔒</span>
          <h2 style={emptyTitle}>Sign in to see your stats</h2>
          <p style={emptyBody}>
            Your listening stats, badges, and top sermons are saved to your account.
          </p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={page}>
        <p style={loadingText}>Loading your stats…</p>
      </div>
    );
  }

  //////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////
  return (
    <div style={page}>
      <h1 style={pageTitle}>Your Stats</h1>
      <p style={pageSubtitle}>Your listening journey at a glance.</p>

      {/* CURRENT BADGE */}
      {currentBadge && (
        <div style={currentBadgeCard}>
          <span style={badgeBigIcon}>{currentBadge.icon}</span>
          <div>
            <p style={badgeLabel}>Current badge</p>
            <h2 style={badgeName}>{currentBadge.name}</h2>
            {nextBadge ? (
              <p style={badgeHint}>
                {(nextBadge.hours - stats.totalHours).toFixed(1)} more hours until{" "}
                <strong>{nextBadge.name}</strong>
              </p>
            ) : (
              <p style={badgeHint}>You've reached the highest badge! 🎉</p>
            )}
          </div>
        </div>
      )}

      {/* STAT TILES */}
      <div style={tileRow}>
        <div style={tile}>
          <span style={tileNumber}>{stats.totalHours.toFixed(1)}</span>
          <span style={tileLabel}>Hours listened</span>
        </div>
        <div style={tile}>
          <span style={tileNumber}>{stats.topSermons.reduce((a, s) => a + s.count, 0) || "—"}</span>
          <span style={tileLabel}>Total plays</span>
        </div>
      </div>

      {/* FAVORITE SPEAKER */}
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardIcon}>🎙️</span>
          <h2 style={cardTitle}>Favorite speaker</h2>
        </div>
        <p style={speakerName}>{stats.favoriteSpeaker}</p>
      </div>

      {/* TOP SERMONS */}
      {stats.topSermons.length > 0 && (
        <div style={card}>
          <div style={cardHeader}>
            <span style={cardIcon}>🏆</span>
            <h2 style={cardTitle}>Most played</h2>
          </div>
          {stats.topSermons.map((s, i) => (
            <div key={i} style={sermonRow}>
              <div style={rankBadge}>{i + 1}</div>
              <span style={sermonTitle}>{s.title}</span>
              <span style={sermonCount}>{s.count} {s.count === 1 ? "play" : "plays"}</span>
            </div>
          ))}
        </div>
      )}

      {/* ALL BADGES */}
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardIcon}>🎖️</span>
          <h2 style={cardTitle}>Badges</h2>
        </div>

        {BADGES.map((badge, i) => {
          const achieved = stats.totalHours >= badge.hours;
          const remaining = badge.hours - stats.totalHours;
          return (
            <div key={i} style={badgeRow(achieved)}>
              <span style={badgeRowIcon}>{badge.icon}</span>
              <div style={{ flex: 1 }}>
                <p style={badgeRowName(achieved)}>{badge.name}</p>
                <p style={badgeRowHint}>
                  {achieved
                    ? `Achieved — ${badge.hours}+ hours`
                    : `${remaining.toFixed(1)} hours to go`}
                </p>
              </div>
              {achieved && <span style={checkmark}>✓</span>}
            </div>
          );
        })}
      </div>
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

const currentBadgeCard = {
  background: "linear-gradient(135deg, #6b3a10 0%, #3d2200 100%)",
  borderRadius: "20px",
  padding: "28px 28px",
  marginBottom: "20px",
  display: "flex",
  alignItems: "center",
  gap: "20px",
};

const badgeBigIcon = {
  fontSize: "44px",
  lineHeight: 1,
  flexShrink: 0,
};

const badgeLabel = {
  margin: "0 0 4px",
  fontSize: "11px",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "rgba(255,235,190,0.65)",
  fontFamily: "sans-serif",
};

const badgeName = {
  margin: "0 0 6px",
  fontSize: "26px",
  fontWeight: "normal",
  color: "#fff8ee",
};

const badgeHint = {
  margin: 0,
  fontSize: "13px",
  color: "rgba(255,235,190,0.75)",
  fontFamily: "sans-serif",
};

const tileRow = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "14px",
  marginBottom: "20px",
};

const tile = {
  background: "#fffdf9",
  borderRadius: "18px",
  padding: "22px 20px",
  border: "1px solid #eddfc8",
  boxShadow: "0 2px 12px rgba(160,100,40,0.07)",
  textAlign: "center",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const tileNumber = {
  fontSize: "32px",
  fontWeight: "normal",
  color: "#3d2200",
  lineHeight: 1,
};

const tileLabel = {
  fontSize: "12px",
  color: "#b08050",
  fontFamily: "sans-serif",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const card = {
  background: "#fffdf9",
  borderRadius: "18px",
  padding: "22px 24px 18px",
  marginBottom: "16px",
  border: "1px solid #eddfc8",
  boxShadow: "0 2px 12px rgba(160,100,40,0.07)",
};

const cardHeader = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  marginBottom: "16px",
  paddingBottom: "12px",
  borderBottom: "1px solid #eddfc8",
};

const cardIcon = { fontSize: "18px" };

const cardTitle = {
  margin: 0,
  fontSize: "17px",
  fontWeight: "normal",
  color: "#5c3a1e",
};

const speakerName = {
  fontSize: "20px",
  color: "#3d2200",
  margin: 0,
};

const sermonRow = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "10px 0",
  borderBottom: "1px solid #f0e4d0",
};

const rankBadge = {
  width: "24px",
  height: "24px",
  borderRadius: "50%",
  background: "#f6e4b0",
  color: "#7a5a10",
  fontSize: "12px",
  fontFamily: "sans-serif",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  fontWeight: "bold",
};

const sermonTitle = {
  flex: 1,
  fontSize: "14px",
  color: "#3d2200",
  fontFamily: "sans-serif",
};

const sermonCount = {
  fontSize: "12px",
  color: "#b08050",
  fontFamily: "sans-serif",
  flexShrink: 0,
};

const badgeRow = (achieved) => ({
  display: "flex",
  alignItems: "center",
  gap: "14px",
  padding: "12px 14px",
  borderRadius: "12px",
  marginBottom: "8px",
  background: achieved ? "#fffbee" : "#fdf8f3",
  border: achieved ? "1px solid #f0d898" : "1px solid #f0e4d0",
});

const badgeRowIcon = { fontSize: "20px", flexShrink: 0 };

const badgeRowName = (achieved) => ({
  margin: "0 0 2px",
  fontSize: "14px",
  fontWeight: achieved ? "bold" : "normal",
  color: achieved ? "#3d2600" : "#7a5530",
  fontFamily: "sans-serif",
});

const badgeRowHint = {
  margin: 0,
  fontSize: "12px",
  color: "#b08050",
  fontFamily: "sans-serif",
};

const checkmark = {
  width: "22px",
  height: "22px",
  borderRadius: "50%",
  background: "#f6e4b0",
  color: "#7a5a10",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "12px",
  flexShrink: 0,
};