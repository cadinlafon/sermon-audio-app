import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy
} from "firebase/firestore";
import { db } from "../../firebase";
export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
const [type, setType] = useState("sermon");
  useEffect(() => {
    const q = query(
      collection(db, "announcements"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setNotifications(list);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div style={{ padding: "40px" }}>
      <h2>Notifications</h2>

      {notifications.length === 0 ? (
        <p>No notifications yet.</p>
      ) : (
        notifications.map((n) => (
          <div key={n.id} style={card}>
            <h4>{n.title}</h4>
            <select
  value={type}
  onChange={(e) => setType(e.target.value)}
  style={input}
>
  <option value="sermon">Sermon</option>
  <option value="announcement">Announcement</option>
  <option value="homily">Homily</option>
</select>
            <p>{n.message}</p>
            <small>
              {n.createdAt?.toDate
                ? n.createdAt.toDate().toLocaleString()
                : ""}
            </small>
          </div>
        ))
      )}
    </div>
  );
}

const card = {
  background: "#fff",
  padding: "15px",
  borderRadius: "10px",
  marginBottom: "15px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
};