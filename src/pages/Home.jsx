import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function Home() {
  const navigate = useNavigate();

  const [latestSermon, setLatestSermon] = useState(null);
  const [continueListening, setContinueListening] = useState(null);
  const [notices, setNotices] = useState([]);

  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoaded, setAuthLoaded] = useState(false);

  //////////////////////////////////////////////////
  // AUTH
  //////////////////////////////////////////////////
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);

      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));

        if (snap.exists() && snap.data().role === "admin") {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }

      setAuthLoaded(true);
    });

    return () => unsubscribe();
  }, []);

  //////////////////////////////////////////////////
  // LOAD DATA
  //////////////////////////////////////////////////
  useEffect(() => {
    if (!authLoaded) return;

    async function fetchData() {
      try {
        // 🔥 Latest sermon
        const sermonQ = query(
          collection(db, "audio"),
          orderBy("createdAt", "desc"),
          limit(1)
        );

        const sermonSnap = await getDocs(sermonQ);

        if (!sermonSnap.empty) {
          const docItem = sermonSnap.docs[0];
          setLatestSermon({
            id: docItem.id,
            ...docItem.data(),
          });
        }

        // 🔥 Notices
        const noticeQ = query(
          collection(db, "notices"),
          orderBy("createdAt", "desc")
        );

        const noticeSnap = await getDocs(noticeQ);
        const now = new Date();

        const filtered = noticeSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((n) => {
            const notExpired =
              !n.expiresAt ||
              new Date(n.expiresAt.seconds * 1000) > now;

            const visibleTo = n.audience || "all";

            const passesVisibility =
              visibleTo === "all" ||
              (visibleTo === "users" && user) ||
              (visibleTo === "admins" && isAdmin) ||
              (visibleTo === "guests" && !user);

            return n.active !== false && notExpired && passesVisibility;
          });

        // 🔥 pinned first
        filtered.sort((a, b) => (b.pinned === true) - (a.pinned === true));

        setNotices(filtered);
      } catch (error) {
        console.error("Error loading home data:", error);
      }
    }

    fetchData();

    const saved = localStorage.getItem("continueListening");
    if (saved) {
      setContinueListening(JSON.parse(saved));
    }
  }, [authLoaded, user, isAdmin]);

  //////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////
  return (
    <>
      {/* HERO */}
      <div
        style={{
          width: "100%",
          height: "30vh",
          backgroundImage: `url("/hero.jpg")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      <div style={{ padding: "40px", maxWidth: "800px", margin: "0 auto" }}>

        {/* 🔥 NOTICES */}
        {notices.length > 0 && (
          <div style={card}>
            <h2 style={{ marginBottom: "15px" }}>Notices</h2>

            {notices.map((n) => (
              <div key={n.id} style={noticeItem}>
                <h4 style={{ marginBottom: "5px" }}>{n.title}</h4>

                {/* ✅ FIX IS RIGHT HERE */}
                <p
                  style={{
                    color: "#555",
                    fontSize: "14px",
                    whiteSpace: "pre-line",
                  }}
                >
                  {n.details}
                </p>

                {n.buttonEnabled && (
                  <button
                    style={noticeButton}
                    onClick={() => {
                      if (n.buttonType === "url") {
                        window.open(n.buttonValue, "_blank");
                      } else if (n.buttonType === "page") {
                        navigate(n.buttonValue);
                      }
                    }}
                  >
                    {n.buttonText || "Learn More"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 🔥 LATEST SERMON */}
        <div style={card}>
          <h2 style={{ marginBottom: "10px" }}>Latest Audio</h2>

          {latestSermon ? (
            <>
              <h3 style={{ marginBottom: "10px" }}>
                {latestSermon.title}
              </h3>

              <p style={{ color: "#666", marginBottom: "15px" }}>
                {latestSermon.speaker}
              </p>

              <button
                onClick={() => {
                  localStorage.setItem(
                    "continueListening",
                    JSON.stringify(latestSermon)
                  );
                  navigate("/sermons");
                }}
                style={playButton}
              >
                Play
              </button>
            </>
          ) : (
            <p style={{ color: "#777" }}>No sermons uploaded yet</p>
          )}
        </div>

        {/* NAV */}
        <div style={navButtons}>
          <button onClick={() => navigate("/sermons")} style={buttonStyle}>
            Sermons
          </button>

          <button onClick={() => navigate("/sundayschool")} style={buttonStyle}>
            Sunday School
          </button>

          <button onClick={() => navigate("/homilies")} style={buttonStyle}>
            Homilies
          </button>
        </div>

      </div>
    </>
  );
}

//////////////////////////////////////////////////
// STYLES
//////////////////////////////////////////////////

const card = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  padding: "25px",
  marginBottom: "40px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  textAlign: "center",
};

const noticeItem = {
  background: "#fffbea",
  border: "1px solid #facc15",
  padding: "12px",
  borderRadius: "8px",
  marginBottom: "10px",
  textAlign: "left",
};

const noticeButton = {
  marginTop: "10px",
  padding: "8px 14px",
  borderRadius: "6px",
  border: "none",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
  fontSize: "13px",
};

const playButton = {
  padding: "10px 20px",
  borderRadius: "999px",
  border: "none",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
};

const navButtons = {
  display: "flex",
  flexDirection: "column",
  gap: "15px",
  marginBottom: "50px",
};

const buttonStyle = {
  padding: "15px",
  fontSize: "16px",
  borderRadius: "8px",
  border: "none",
  backgroundColor: "#2c3e50",
  color: "white",
  cursor: "pointer",
};