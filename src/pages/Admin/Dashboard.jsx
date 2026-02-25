import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [sermonCount, setSermonCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);

  const navigate = useNavigate();

  useEffect(() => {
    async function fetchData() {
      try {
        // Get Sermons
        const sermonSnapshot = await getDocs(collection(db, "audio"));
        setSermonCount(sermonSnapshot.size);

        let likesSum = 0;
        sermonSnapshot.forEach((doc) => {
          likesSum += doc.data().likes || 0;
        });
        setTotalLikes(likesSum);

        // Get Users
        const userSnapshot = await getDocs(collection(db, "users"));
        setUserCount(userSnapshot.size);

      } catch (error) {
        console.error("Dashboard error:", error);
      }
    }

    fetchData();
  }, []);

  const cardStyle = {
    background: "#fff",
    padding: "25px",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    minWidth: "200px",
    textAlign: "center",
  };

  return (
    <div>
      <h2 style={{ marginBottom: "30px" }}>Admin Dashboard</h2>

      {/* Stats Section */}
      <div
        style={{
          display: "flex",
          gap: "20px",
          flexWrap: "wrap",
          marginBottom: "40px",
        }}
      >
        <div style={cardStyle}>
          <h3>{sermonCount}</h3>
          <p>Total Sermons</p>
        </div>

        <div style={cardStyle}>
          <h3>{userCount}</h3>
          <p>Total Users</p>
        </div>

        <div style={cardStyle}>
          <h3>{totalLikes}</h3>
          <p>Total Likes</p>
        </div>
      </div>

      {/* Quick Actions */}
      <h3 style={{ marginBottom: "15px" }}>Quick Actions</h3>

      <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
        <button onClick={() => navigate("/admin/upload")}>
          Upload Audio
        </button>

        <button onClick={() => navigate("/admin/users")}>
          View Users
        </button>

        <button onClick={() => navigate("/admin/notifications")}>
          Send Notification
        </button>

        <button onClick={() => navigate("/admin/analytics")}>
          View Analytics
        </button>
      </div>

      {/* Upload Notice */}
      <div
        style={{
          marginTop: "40px",
          padding: "20px",
          background: "#fff3cd",
          borderRadius: "8px",
          color: "#856404",
        }}
      >
        ⚠ Upload feature requires Firebase Blaze plan for full storage functionality.
      </div>
    </div>
  );
}