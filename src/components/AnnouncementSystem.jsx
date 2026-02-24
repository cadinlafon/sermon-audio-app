import { useEffect, useState } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export default function AnnouncementSystem() {
  const [notifications, setNotifications] = useState([]);
  const [popup, setPopup] = useState(null);

  useEffect(() => {
    async function fetchAnnouncements() {
      const q = query(
        collection(db, "announcements"),
        where("active", "==", true),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(q);

      const dismissed = JSON.parse(localStorage.getItem("dismissedNotifications") || "[]");

      const all = [];
      snapshot.forEach(doc => {
        all.push({ id: doc.id, ...doc.data() });
      });

      setNotifications(all);

      const firstUnread = all.find(n => !dismissed.includes(n.id));
      if (firstUnread) {
        setPopup(firstUnread);
      }
    }

    fetchAnnouncements();
  }, []);

  const dismissPopup = () => {
    const dismissed = JSON.parse(localStorage.getItem("dismissedNotifications") || "[]");
    dismissed.push(popup.id);
    localStorage.setItem("dismissedNotifications", JSON.stringify(dismissed));
    setPopup(null);
  };

  return (
    <>
      {popup && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2>{popup.title}</h2>
            <p>{popup.message}</p>

            {popup.buttonText && popup.buttonLink && (
              <a href={popup.buttonLink} target="_blank" rel="noreferrer" style={buttonStyle}>
                {popup.buttonText}
              </a>
            )}

            <button onClick={dismissPopup} style={closeStyle}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 3000,
};

const modalStyle = {
  background: "#fff",
  padding: "30px",
  width: "90%",
  maxWidth: "420px",
  borderRadius: "10px",
  textAlign: "center"
};

const buttonStyle = {
  display: "inline-block",
  padding: "10px 18px",
  background: "#000",
  color: "#fff",
  textDecoration: "none",
  marginBottom: "15px",
  borderRadius: "6px"
};

const closeStyle = {
  padding: "6px 14px",
  border: "1px solid #ccc",
  background: "transparent",
  borderRadius: "6px",
  cursor: "pointer"
};
