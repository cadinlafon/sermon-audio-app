import { useState, useEffect, useRef } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { auth, db } from "../firebase";

export default function Navbar() {
  const navigate = useNavigate();
  const profileRef = useRef(null);

  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [hasUnread, setHasUnread] = useState(false);

  // 🔐 Auth + Admin Role Check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        setUser(currentUser);

        if (currentUser) {
          const userDoc = await getDoc(
            doc(db, "users", currentUser.uid)
          );

          if (
            userDoc.exists() &&
            userDoc.data().role === "admin"
          ) {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        } else {
          setIsAdmin(false);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  // 🔔 Unread Notification Dot
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "announcements"),
      orderBy("createdAt", "desc"),
      limit(1)
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        if (snapshot.empty) {
          setHasUnread(false);
          return;
        }

        const latest =
          snapshot.docs[0].data();

        const userDoc = await getDoc(
          doc(db, "users", user.uid)
        );

        const lastSeen =
          userDoc.data()?.lastSeenNotification;

        if (
          !lastSeen ||
          latest.createdAt?.seconds >
            lastSeen.seconds
        ) {
          setHasUnread(true);
        } else {
          setHasUnread(false);
        }
      }
    );

    return () => unsubscribe();
  }, [user]);

  // 🖱 Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        profileRef.current &&
        !profileRef.current.contains(
          event.target
        )
      ) {
        setShowProfile(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );
    return () =>
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
  }, []);

  const handleLogin = async () => {
    try {
      setError("");
      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      setShowProfile(false);
      setEmail("");
      setPassword("");
    } catch {
      setError("Invalid email or password");
    }
  };

  const linkStyle = ({ isActive }) => ({
    textDecoration: "none",
    fontSize: "12px",
    textTransform: "uppercase",
    fontWeight: isActive ? "600" : "400",
    letterSpacing: "0.8px",
    color: isActive ? "#000" : "#777",
    borderBottom: isActive
      ? "2px solid black"
      : "2px solid transparent",
    paddingBottom: "6px",
  });

  return (
    <div style={navbarStyle}>
      <NavLink to="/" style={linkStyle}>
        Home
      </NavLink>
      <NavLink to="/sermons" style={linkStyle}>
        Sermons
      </NavLink>
      <NavLink to="/sundayschool" style={linkStyle}>
        Sunday School
      </NavLink>
      <NavLink to="/homilys" style={linkStyle}>
        Homilys
      </NavLink>

      {/* MORE */}
      <div style={{ position: "relative" }}>
        <div
          style={moreText}
          onClick={() =>
            setShowMore(!showMore)
          }
        >
          More
        </div>

        {showMore && (
          <div style={dropdown}>
            <NavLink
              to="/about"
              style={linkStyle}
            >
              About
            </NavLink>
            <NavLink
              to="/feedback"
              style={linkStyle}
            >
              Feedback
            </NavLink>

            {isAdmin && (
              <NavLink
                to="/admin"
                style={linkStyle}
              >
                Admin Panel
              </NavLink>
            )}
          </div>
        )}
      </div>

      {/* RIGHT SIDE */}
      <div
        ref={profileRef}
        style={rightSide}
      >
        {/* 🔔 Bell */}
        {user && (
          <div
            style={{ position: "relative", cursor: "pointer", fontSize: "18px" }}
            onClick={() =>
              navigate("/notifications")
            }
          >
            🔔
            {hasUnread && (
              <span style={redDot} />
            )}
          </div>
        )}

        {/* 👤 Profile */}
        <div
          onClick={() => {
            if (user) {
              navigate("/settings");
            } else {
              setShowProfile(
                !showProfile
              );
            }
          }}
          style={{ cursor: "pointer" }}
        >
          {user ? (
            <div style={profileCircle}>
              {user.email
                ?.charAt(0)
                .toUpperCase()}
            </div>
          ) : (
            <div>👤</div>
          )}
        </div>

        {/* Login Dropdown */}
        {showProfile && !user && (
          <div style={loginDropdown}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
            />
            <button onClick={handleLogin}>
              Login
            </button>

            <Link
              to="/signup"
              style={{
                fontSize: "12px",
              }}
            >
              Create Account
            </Link>

            {error && (
              <p style={{ color: "red" }}>
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* 🎨 Styles */

const navbarStyle = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: "30px",
  padding: "15px 0",
  borderBottom: "1px solid #eee",
  background: "#fff",
  position: "sticky",
  top: 0,
  zIndex: 1000,
};

const moreText = {
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.8px",
  color: "#777",
  cursor: "pointer",
};

const dropdown = {
  position: "absolute",
  top: "25px",
  right: 0,
  background: "#fff",
  border: "1px solid #eee",
  padding: "10px",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  minWidth: "160px",
};

const rightSide = {
  marginLeft: "20px",
  position: "relative",
  display: "flex",
  alignItems: "center",
  gap: "15px",
};

const redDot = {
  position: "absolute",
  top: 0,
  right: 0,
  width: "8px",
  height: "8px",
  background: "red",
  borderRadius: "50%",
};

const profileCircle = {
  width: "32px",
  height: "32px",
  borderRadius: "50%",
  background: "#000",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "14px",
  fontWeight: "600",
};

const loginDropdown = {
  position: "absolute",
  top: "40px",
  right: 0,
  background: "#fff",
  border: "1px solid #eee",
  padding: "15px",
  width: "220px",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};