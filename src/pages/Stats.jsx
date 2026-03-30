import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const BADGES = [
  { name: "Newbie", hours: 0 },
  { name: "Novice", hours: 4 },
  { name: "Pro", hours: 8 },
  { name: "Scholar", hours: 14 },
  { name: "Master", hours: 20 },
];

export default function Stats() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);

  //////////////////////////////////////////////////
  // AUTH
  //////////////////////////////////////////////////
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  //////////////////////////////////////////////////
  // FETCH REAL STATS
  //////////////////////////////////////////////////
  useEffect(() => {
    if (!user) return;

    async function fetchStats() {
      const ref = doc(db, "userStats", user.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        setStats({
          totalHours: 0,
          topSermons: [],
          favoriteSpeaker: "N/A",
        });
        return;
      }

      const data = snap.data();

      const totalHours = (data.totalSeconds || 0) / 3600;

      // TOP SERMONS
      const sermons = data.sermons || {};

      const topSermons = Object.entries(sermons)
        .map(([id, s]) => ({
          title: s.title,
          count: s.count || 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      // FAVORITE SPEAKER
      const speakers = data.speakers || {};

      const favoriteSpeaker =
        Object.entries(speakers).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

      setStats({
        totalHours,
        topSermons,
        favoriteSpeaker,
      });
    }

    fetchStats();
  }, [user]);

  //////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////
  if (!user) return <p style={{ textAlign: "center" }}>Login to see stats</p>;
  if (!stats) return <p style={{ textAlign: "center" }}>Loading...</p>;

  return (
    <div style={{ padding: "30px", maxWidth: "800px", margin: "0 auto" }}>
      
      <h1 style={{ textAlign: "center", marginBottom: "30px" }}>
        Your Stats
      </h1>

      {/* 🔥 BADGES */}
      <div style={{ marginBottom: "40px" }}>
        <h2>Badges</h2>

        {BADGES.map((badge, i) => {
          const achieved = stats.totalHours >= badge.hours;
          const remaining = badge.hours - stats.totalHours;

          return (
            <div key={i} style={badgeCard(achieved)}>
              <strong>{badge.name}</strong>

              {achieved ? (
                <p style={{ color: "green" }}>
                  Achieved ✔ | You listened over {badge.hours} hours!
                </p>
              ) : (
                <p>
                  Listen {remaining.toFixed(1)} more hours to achieve
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* TOTAL */}
      <div style={card}>
        <h2>{stats.totalHours.toFixed(2)}</h2>
        <p>Hours Listened</p>
      </div>

      {/* FAVORITE SPEAKER */}
      <div style={{ marginTop: "30px" }}>
        <h2>Favorite Speaker</h2>
        <div style={card}>{stats.favoriteSpeaker}</div>
      </div>

      {/* TOP SERMONS */}
      <div style={{ marginTop: "30px" }}>
        <h2>Top 3 Sermons</h2>

        {stats.topSermons.map((s, i) => (
          <div key={i} style={listItem}>
            <span>{i + 1}. {s.title}</span>
            <span>{s.count} plays</span>
          </div>
        ))}
      </div>
    </div>
  );
}

//////////////////////////////////////////////////
// STYLES
//////////////////////////////////////////////////

const card = {
  background: "#fff",
  padding: "20px",
  borderRadius: "12px",
  boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
  marginTop: "10px",
};

const listItem = {
  display: "flex",
  justifyContent: "space-between",
  padding: "10px",
  borderBottom: "1px solid #eee",
};

const badgeCard = (achieved) => ({
  padding: "12px",
  marginTop: "10px",
  borderRadius: "10px",
  background: achieved ? "#ecfdf5" : "#f3f4f6",
});