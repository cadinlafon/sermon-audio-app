import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function AnnouncementModal() {
  const [announcement, setAnnouncement] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    async function fetchAnnouncement() {
      try {
        const snap = await getDoc(doc(db, "announcements", "current"));

        if (!snap.exists()) return;

        const data = snap.data();

        if (!data.active) return;

        const lastSeenVersion = localStorage.getItem("announcementVersion");

        if (String(data.version) !== lastSeenVersion) {
          setAnnouncement(data);
          setVisible(true);
        }
      } catch (err) {
        console.error("Error fetching announcement:", err);
      }
    }

    fetchAnnouncement();
  }, []);

  const handleClose = () => {
    if (announcement?.version) {
      localStorage.setItem(
        "announcementVersion",
        String(announcement.version)
      );
    }
    setVisible(false);
  };

  if (!visible || !announcement) return null;

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2 style={{ marginBottom: "10px" }}>
          {announcement.title}
        </h2>

        <p style={{ marginBottom: "20px" }}>
          {announcement.message}
        </p>

        {announcement.buttonText && announcement.buttonLink && (
          <a
            href={announcement.buttonLink}
            target="_blank"
            rel="noopener noreferrer"
            style={buttonStyle}
          >
            {announcement.buttonText}
          </a>
        )}

        <button onClick={handleClose} style={closeStyle}>
          Close
        </button>
      </div>
    </div>
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
  textAlign: "center",
  boxShadow: "0 10px 30px rgba(0,0,0,0.15)"
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
  display: "block",
  margin: "0 auto",
  padding: "6px 14px",
  background: "transparent",
  border: "1px solid #ccc",
  cursor: "pointer",
  borderRadius: "6px"
};
