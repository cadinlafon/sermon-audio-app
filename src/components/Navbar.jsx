import { useState, useEffect, useRef } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "firebase/auth";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const profileRef = useRef(null);

  const [user, setUser] = useState(null);
  const [showMore, setShowMore] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // Hide navbar in admin
  if (location.pathname.startsWith("/admin")) {
    return null;
  }

  // Listen for auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfile(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogin = async () => {
    try {
      setError("");
      await signInWithEmailAndPassword(auth, email, password);
      setShowProfile(false);
      setEmail("");
      setPassword("");
    } catch (err) {
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
    <div
      style={{
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
      }}
    >
      <NavLink to="/" style={linkStyle}>Home</NavLink>
      <NavLink to="/sermons" style={linkStyle}>Sermons</NavLink>
      <NavLink to="/sundayschool" style={linkStyle}>Sunday School</NavLink>
      <NavLink to="/homilys" style={linkStyle}>Homilys</NavLink>

      {/* More Dropdown */}
      <div
        style={{
          position: "relative",
          fontSize: "12px",
          cursor: "pointer",
          color: "#777"
        }}
        onClick={() => setShowMore(!showMore)}
      >
        More
        {showMore && (
          <div
            style={{
              position: "absolute",
              top: "25px",
              right: 0,
              background: "#fff",
              border: "1px solid #eee",
              padding: "10px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              minWidth: "140px",
            }}
          >
            <NavLink to="/about">About</NavLink>
            <NavLink to="/feedback">Feedback</NavLink>
          </div>
        )}
      </div>

      {/* Right Side */}
      <div
        ref={profileRef}
        style={{
          marginLeft: "20px",
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: "15px"
        }}
      >
        {/* 🔔 Notification Bell (only if logged in) */}
        {user && (
          <div
            style={{ cursor: "pointer", fontSize: "18px" }}
            onClick={() => navigate("/notifications")}
          >
            🔔
          </div>
        )}

        {/* Profile Icon */}
        <div
          onClick={() => {
            if (user) {
              navigate("/settings");
            } else {
              setShowProfile(!showProfile);
            }
          }}
          style={{ cursor: "pointer" }}
        >
          {user ? (
            <div
              style={{
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
              }}
            >
              {user.email?.charAt(0)}
            </div>
          ) : (
            <div style={{ fontSize: "18px" }}>👤</div>
          )}
        </div>

        {/* Login Dropdown (only if NOT logged in) */}
        {showProfile && !user && (
          <div
            style={{
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
            }}
          >
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button onClick={handleLogin}>Login</button>

            <Link to="/signup" style={{ fontSize: "12px" }}>
              Create Account
            </Link>

            {error && <p style={{ color: "red" }}>{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
