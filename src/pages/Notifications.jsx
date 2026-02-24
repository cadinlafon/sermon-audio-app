import { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(
      collection(db, "notifications"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNotifications(data);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div style={styles.container}>
      
      {/* 🔙 Back Button */}
      <button
        onClick={() => navigate("/")}
        style={styles.backButton}
      >
        ← Back to Home
      </button>

      <h2 style={styles.heading}>Notifications</h2>

      {notifications.length === 0 && (
        <p>No notifications yet.</p>
      )}

      {notifications.map(n => (
        <div key={n.id} style={styles.card}>
          <strong>{n.title}</strong>
          <p>{n.message}</p>
        </div>
      ))}
    </div>
  );
}

const styles = {
  container: {
    padding: "40px 20px",
    maxWidth: "600px",
    margin: "auto",
    minHeight: "100vh",
  },
  backButton: {
    background: "none",
    border: "none",
    color: "#555",
    fontSize: "14px",
    cursor: "pointer",
    marginBottom: "20px",
  },
  heading: {
    marginBottom: "20px",
  },
  card: {
    background: "#fff",
    padding: "15px",
    borderRadius: "8px",
    marginBottom: "12px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  },
};
