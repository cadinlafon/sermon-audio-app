import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";

export default function Analytics() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    verifiedUsers: 0,
    dailyNewUsers: 0,
    uploadCount: 0,
    notificationsSent: 0,
    mostLiked: null,
    mostActiveDay: null,
  });

  useEffect(() => {
    const fetchAnalytics = async () => {
      const usersSnap = await getDocs(collection(db, "users"));
      const audioSnap = await getDocs(collection(db, "audio"));
      const announcementSnap = await getDocs(collection(db, "announcements"));

      const now = new Date();
      const today = now.toDateString();

      let verified = 0;
      let todayUsers = 0;

      usersSnap.docs.forEach((doc) => {
        const data = doc.data();

        if (data.emailVerified) verified++;

        if (data.createdAt?.toDate) {
          const created = data.createdAt.toDate();
          if (created.toDateString() === today) {
            todayUsers++;
          }
        }
      });

      // 🔥 Most Liked Sermon
      let topSermon = null;
      audioSnap.docs.forEach((doc) => {
        const data = doc.data();
        if (!topSermon || (data.likes || 0) > (topSermon.likes || 0)) {
          topSermon = {
            title: data.title,
            likes: data.likes || 0,
          };
        }
      });

      // 🔥 Most Active Day (based on uploads)
      const uploadDays = {};
      audioSnap.docs.forEach((doc) => {
        const data = doc.data();
        if (data.createdAt?.toDate) {
          const day = data.createdAt.toDate().toDateString();
          uploadDays[day] = (uploadDays[day] || 0) + 1;
        }
      });

      const mostActive = Object.keys(uploadDays).reduce(
        (a, b) => (uploadDays[a] > uploadDays[b] ? a : b),
        null
      );

      setStats({
        totalUsers: usersSnap.size,
        verifiedUsers: verified,
        dailyNewUsers: todayUsers,
        uploadCount: audioSnap.size,
        notificationsSent: announcementSnap.size,
        mostLiked: topSermon,
        mostActiveDay: mostActive,
      });
    };

    fetchAnalytics();
  }, []);

  return (
    <div>
      <h2 style={{ marginBottom: "25px" }}>Advanced Analytics</h2>

      <div style={grid}>
        <Stat title="Total Users" value={stats.totalUsers} />
        <Stat title="Verified Users" value={stats.verifiedUsers} />
        <Stat title="New Users Today" value={stats.dailyNewUsers} />
        <Stat title="Uploads" value={stats.uploadCount} />
        <Stat title="Notifications Sent" value={stats.notificationsSent} />
        <Stat
          title="Most Active Upload Day"
          value={stats.mostActiveDay || "N/A"}
        />
      </div>

      <div style={card}>
        <h3>Most Liked Sermon</h3>
        {stats.mostLiked ? (
          <>
            <p><strong>{stats.mostLiked.title}</strong></p>
            <p>{stats.mostLiked.likes} Likes</p>
          </>
        ) : (
          <p>No data yet.</p>
        )}
      </div>

      <div style={card}>
        <h3>Storage Usage</h3>
        <p>Coming Soon (requires Firebase Storage tracking)</p>
      </div>
    </div>
  );
}

function Stat({ title, value }) {
  return (
    <div style={card}>
      <h4 style={{ fontSize: "13px", color: "#666" }}>{title}</h4>
      <div style={{ fontSize: "26px", fontWeight: "bold" }}>{value}</div>
    </div>
  );
}

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "20px",
  marginBottom: "40px",
};

const card = {
  background: "white",
  padding: "20px",
  borderRadius: "12px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  marginBottom: "25px",
};