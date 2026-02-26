import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [preferences, setPreferences] = useState(null);
  const navigate = useNavigate();

  // 🔥 Get User Preferences
  useEffect(() => {
    const fetchPreferences = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const userDoc = await getDoc(
        doc(db, "users", user.uid)
      );

      if (userDoc.exists()) {
        setPreferences(
          userDoc.data()
            ?.notificationPreferences || {}
        );
      }
    };

    fetchPreferences();
  }, []);

  // 🔔 Listen to Notifications
  useEffect(() => {
    const q = query(
      collection(db, "announcements"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(
          (doc) => ({
            id: doc.id,
            ...doc.data(),
          })
        );

        // Filter by user preferences
        if (preferences) {
          const filtered = data.filter(
            (n) =>
              preferences[n.type] === true
          );
          setNotifications(filtered);
        } else {
          setNotifications(data);
        }
      }
    );

    return () => unsubscribe();
  }, [preferences]);

  // 👀 Mark as Read When Opened
  useEffect(() => {
    const markAsSeen = async () => {
      const user = auth.currentUser;
      if (!user) return;

      await updateDoc(
        doc(db, "users", user.uid),
        {
          lastSeenNotification:
            serverTimestamp(),
        }
      );
    };

    markAsSeen();
  }, []);

  // 🧹 Clear All (User Only)
  const clearNotifications = async () => {
    const user = auth.currentUser;
    if (!user) return;

    await updateDoc(
      doc(db, "users", user.uid),
      {
        lastSeenNotification:
          serverTimestamp(),
      }
    );

    setNotifications([]);
  };

  return (
    <div style={styles.container}>
      {/* 🔙 Back */}
      <button
        onClick={() => navigate("/")}
        style={styles.backButton}
      >
        ← Back to Home
      </button>

      <h2 style={styles.heading}>
        Notifications
      </h2>

      {/* 🧹 Clear Button */}
      {notifications.length > 0 && (
        <button
          onClick={clearNotifications}
          style={styles.clearButton}
        >
          Clear All
        </button>
      )}

      {notifications.length === 0 ? (
        <p>No notifications yet.</p>
      ) : (
        notifications.map((n) => (
          <div key={n.id} style={styles.card}>
            <strong>{n.title}</strong>

            <p style={styles.type}>
              Type: {n.type}
            </p>

            <p>{n.content}</p>

            <small>
              {n.createdAt?.toDate
                ? n.createdAt
                    .toDate()
                    .toLocaleString()
                : ""}
            </small>
          </div>
        ))
      )}
    </div>
  );
}

/* 🎨 Styles */

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
  clearButton: {
    marginBottom: "20px",
    padding: "6px 12px",
    cursor: "pointer",
  },
  card: {
    background: "#fff",
    padding: "15px",
    borderRadius: "8px",
    marginBottom: "12px",
    boxShadow:
      "0 2px 8px rgba(0,0,0,0.05)",
  },
  type: {
    fontSize: "12px",
    color: "#888",
    margin: "6px 0",
  },
};