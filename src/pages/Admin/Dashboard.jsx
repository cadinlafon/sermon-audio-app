import { useEffect, useState } from "react";
import { db } from "../../firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore";

export default function Dashboard() {
  const [totalUsers, setTotalUsers] = useState(0);
  const [newUsersToday, setNewUsersToday] = useState(0);
  const [totalAudio, setTotalAudio] = useState(0);
  const [latestUpload, setLatestUpload] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // 🔹 USERS
        const usersSnapshot = await getDocs(collection(db, "users"));
        const users = usersSnapshot.docs.map((doc) => doc.data());

        setTotalUsers(users.length);

        // Calculate new users today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const newToday = users.filter((user) => {
          if (!user.createdAt) return false;
          const created = user.createdAt.toDate();
          return created >= today;
        });

        setNewUsersToday(newToday.length);

        // 🔹 AUDIO
        const audioSnapshot = await getDocs(collection(db, "audio"));
        setTotalAudio(audioSnapshot.size);

        // 🔹 Latest Upload
        const latestQuery = query(
          collection(db, "audio"),
          orderBy("createdAt", "desc"),
          limit(1)
        );

        const latestSnapshot = await getDocs(latestQuery);

        if (!latestSnapshot.empty) {
          setLatestUpload(latestSnapshot.docs[0].data());
        }
      } catch (error) {
        console.error("Dashboard error:", error);
      }
    };

    fetchStats();
  }, []);

  return (
    <div>
      <h1 style={{ marginBottom: "30px" }}>Admin Dashboard</h1>

      <div style={gridStyle}>
        <StatBox title="Total Users" value={totalUsers} />
        <StatBox title="New Users Today" value={newUsersToday} />
        <StatBox title="Total Audio Files" value={totalAudio} />
        <StatBox
          title="Latest Upload"
          value={latestUpload ? latestUpload.title : "None"}
        />
      </div>
    </div>
  );
}

function StatBox({ title, value }) {
  return (
    <div style={boxStyle}>
      <h3 style={{ marginBottom: "10px" }}>{title}</h3>
      <p style={{ fontSize: "22px", fontWeight: "bold" }}>{value}</p>
    </div>
  );
}

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "20px",
};

const boxStyle = {
  padding: "20px",
  borderRadius: "10px",
  backgroundColor: "#f3f4f6",
  boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
};