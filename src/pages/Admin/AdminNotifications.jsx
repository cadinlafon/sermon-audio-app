import { useState, useEffect } from "react";
import { db } from "../../firebase";
import {
  collection,
  getDocs,
  addDoc,
  query,
  orderBy
} from "firebase/firestore";
import { httpsCallable, getFunctions } from "firebase/functions";

export default function AdminNotifications() {
  const [mode, setMode] = useState("push");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState("all");
  const [users, setUsers] = useState([]);
  const [history, setHistory] = useState([]);

  const functions = getFunctions();
  const sendPush = httpsCallable(functions, "sendPushNotification");

  // 🔥 Load users
  useEffect(() => {
    const loadUsers = async () => {
      const snap = await getDocs(collection(db, "users"));
      const list = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      list.sort((a, b) =>
        (a.name || "").localeCompare(b.name || "")
      );

      setUsers(list);
    };

    loadUsers();
  }, []);

  // 🔥 Load notification history
  useEffect(() => {
    const loadHistory = async () => {
      const q = query(
        collection(db, "notifications"),
        orderBy("createdAt", "desc")
      );

      const snap = await getDocs(q);

      const list = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setHistory(list);
    };

    loadHistory();
  }, []);

  // 🔥 Send notification
  const handleSend = async () => {
    if (!title || !body) {
      alert("Fill all fields");
      return;
    }

    try {
      if (mode === "push") {
        await sendPush({
          title,
          body,
          targetUserId: target
        });
      } else {
        // Popup only (still saves to Firestore)
        await addDoc(collection(db, "notifications"), {
          title,
          body,
          targetUserId: target,
          createdAt: new Date()
        });
      }

      alert("✅ Sent!");

      setTitle("");
      setBody("");
    } catch (err) {
      console.error(err);
      alert("❌ Error");
    }
  };

  // 🔥 Load analytics
  const loadStats = async (notificationId) => {
    const snap = await getDocs(
      collection(db, "notifications", notificationId, "interactions")
    );

    let seen = 0;
    let opened = 0;

    snap.forEach(doc => {
      const d = doc.data();
      if (d.seen) seen++;
      if (d.opened) opened++;
    });

    alert(`👀 Seen: ${seen} | 🔥 Opened: ${opened}`);
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        <h2 style={styles.title}>Admin Notifications</h2>

        {/* Toggle */}
        <div style={styles.toggleWrap}>
          <button
            style={{
              ...styles.toggleBtn,
              background: mode === "push" ? "#2563eb" : "#e5e7eb",
              color: mode === "push" ? "white" : "black"
            }}
            onClick={() => setMode("push")}
          >
            Push
          </button>

          <button
            style={{
              ...styles.toggleBtn,
              background: mode === "popup" ? "#2563eb" : "#e5e7eb",
              color: mode === "popup" ? "white" : "black"
            }}
            onClick={() => setMode("popup")}
          >
            Popup
          </button>
        </div>

        {/* Inputs */}
        <input
          style={styles.input}
          placeholder="Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />

        <textarea
          style={styles.textarea}
          placeholder="Message"
          value={body}
          onChange={e => setBody(e.target.value)}
        />

        {/* Target */}
        <select
          style={styles.select}
          value={target}
          onChange={e => setTarget(e.target.value)}
        >
          <option value="all">All Users</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>
              {u.name || u.email || u.id}
            </option>
          ))}
        </select>

        {/* Send */}
        <button style={styles.sendBtn} onClick={handleSend}>
          Send Notification
        </button>

        {/* HISTORY */}
        <div style={{ marginTop: 30 }}>
          <h3>History</h3>

          {history.map(n => (
            <div key={n.id} style={styles.historyItem}>
              <strong>{n.title}</strong>
              <p>{n.body}</p>

              <button
                style={styles.statsBtn}
                onClick={() => loadStats(n.id)}
              >
                View Analytics
              </button>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

const styles = {
  page: {
    display: "flex",
    justifyContent: "center",
    padding: "40px"
  },

  card: {
    width: "100%",
    maxWidth: "650px",
    background: "white",
    padding: "30px",
    borderRadius: "12px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
    display: "flex",
    flexDirection: "column",
    gap: "16px"
  },

  title: {
    fontSize: "24px",
    fontWeight: "700",
    textAlign: "center"
  },

  toggleWrap: {
    display: "flex",
    gap: "10px",
    justifyContent: "center"
  },

  toggleBtn: {
    padding: "10px 20px",
    border: "none",
    borderRadius: "8px",
    fontWeight: "600",
    cursor: "pointer"
  },

  input: {
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #ccc"
  },

  textarea: {
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #ccc",
    minHeight: "100px",
    resize: "none"
  },

  select: {
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #ccc"
  },

  sendBtn: {
    padding: "14px",
    background: "#16a34a",
    color: "white",
    border: "none",
    borderRadius: "10px",
    fontWeight: "700",
    cursor: "pointer"
  },

  historyItem: {
    border: "1px solid #ddd",
    padding: "12px",
    borderRadius: "10px",
    marginBottom: "10px"
  },

  statsBtn: {
    marginTop: "8px",
    padding: "8px 14px",
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer"
  }
};