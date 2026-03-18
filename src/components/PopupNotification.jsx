import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  setDoc,
  serverTimestamp
} from "firebase/firestore";

export default function PopupNotification() {
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    const loadNotification = async () => {
      const q = query(
        collection(db, "notifications"),
        orderBy("createdAt", "desc"),
        limit(1)
      );

      const snap = await getDocs(q);

      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const data = docSnap.data();

        const seenKey = `seen_${docSnap.id}`;

        if (localStorage.getItem(seenKey)) return;

        setNotification({
          id: docSnap.id,
          ...data
        });

        // 🔥 TRACK "SEEN"
        if (auth.currentUser) {
          await setDoc(
            doc(db, "notifications", docSnap.id, "interactions", auth.currentUser.uid),
            {
              seen: true,
              opened: false,
              updatedAt: serverTimestamp()
            },
            { merge: true }
          );
        }
      }
    };

    loadNotification();
  }, []);

  const handleOpen = async () => {
    if (!auth.currentUser) return;

    await setDoc(
      doc(db, "notifications", notification.id, "interactions", auth.currentUser.uid),
      {
        opened: true,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    handleClose();
  };

  const handleClose = () => {
    localStorage.setItem(`seen_${notification.id}`, "true");
    setNotification(null);
  };

  if (!notification) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.popup}>
        <h3>{notification.title}</h3>
        <p>{notification.body}</p>

        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={handleOpen} style={styles.openBtn}>
            Open
          </button>

          <button onClick={handleClose} style={styles.closeBtn}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999
  },

  popup: {
    background: "white",
    padding: "25px",
    borderRadius: "12px",
    width: "320px",
    textAlign: "center",
    boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
  },

  openBtn: {
    padding: "10px 18px",
    background: "#16a34a",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer"
  },

  closeBtn: {
    padding: "10px 18px",
    background: "#e5e7eb",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer"
  }
};