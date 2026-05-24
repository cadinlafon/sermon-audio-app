import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "firebase/auth";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "firebase/firestore";

import { auth, db, googleProvider } from "../firebase";
import { logEvent } from "../utils/logEvent";

import googleLogo from "../assets/auth/google-logo.png";
import userIcon from "../assets/auth/user-icon.png";

export default function TopBar() {
  const navigate = useNavigate();
  const profileRef = useRef(null);

  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [showProfile, setShowProfile] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  //////////////////////////////////////////////////
  // AUTH
  //////////////////////////////////////////////////
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));

        if (userDoc.exists() && userDoc.data().role === "admin") {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    });

    return () => unsubscribe();
  }, []);

  //////////////////////////////////////////////////
  // GOOGLE LOGIN
  //////////////////////////////////////////////////
  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const gUser = result.user;

      const userRef = doc(db, "users", gUser.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        await setDoc(userRef, {
          uid: gUser.uid,
          fullName: gUser.displayName,
          email: gUser.email,
          role: "user",
          emailVerified: true,
          createdAt: serverTimestamp()
        });
      }

      logEvent("google_login", { uid: gUser.uid });
      setShowProfile(false);
    } catch {
      setError("Google sign in failed");
    }
  };

  //////////////////////////////////////////////////
  // EMAIL LOGIN
  //////////////////////////////////////////////////
  const handleLogin = async () => {
    try {
      setError("");

      const result = await signInWithEmailAndPassword(auth, email, password);

      logEvent("user_login", { uid: result.user.uid });

      setShowProfile(false);
      setEmail("");
      setPassword("");
    } catch {
      setError("Invalid email or password");
    }
  };

  //////////////////////////////////////////////////
  // LOGOUT
  //////////////////////////////////////////////////
  const handleLogout = async () => {
    await signOut(auth);
    logEvent("logout", { uid: user.uid });
    setShowProfile(false);
  };

  //////////////////////////////////////////////////
  // CLOSE DROPDOWN
  //////////////////////////////////////////////////
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

  //////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////
  return (
    <div style={topBar}>
      <div style={title}>Palouse Fellowship Audio App</div>

      <div ref={profileRef} style={rightSide}>
        <div
          style={{ cursor: "pointer" }}
          onClick={() => setShowProfile(!showProfile)}
        >
          {user ? (
            <div style={profileCircle}>
              {user.email?.charAt(0).toUpperCase()}
            </div>
          ) : (
            "👤"
          )}
        </div>

        {/* NOT LOGGED IN */}
        {showProfile && !user && (
          <div style={dropdown}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />

            <button style={loginButton} onClick={handleLogin}>
              LOGIN
            </button>

            <div style={orDivider}>or</div>

            <button style={googleButton} onClick={signInWithGoogle}>
              <img src={googleLogo} style={googleLogoStyle} />
              Continue with Google
            </button>

            <p
              style={signupText}
              onClick={() => navigate("/signup")}
            >
              Don't have an account?
            </p>

            {error && <p style={{ color: "red", fontSize: "12px" }}>{error}</p>}
          </div>
        )}

        {/* LOGGED IN */}
        {showProfile && user && (
          <div style={dropdown}>
            <div style={userName}>
              {user.displayName || user.email}
            </div>

            <hr />

            <button style={accountButton} onClick={() => navigate("/your-listens")}>
              Your Listens
            </button>

            <button style={accountButton} onClick={() => navigate("/saved")}>
              Saved
            </button>

            <button style={accountButton} onClick={() => navigate("/stats")}>
              Stats
            </button>

            <button style={accountButton} onClick={() => navigate("/suggest")}>
              Suggest Feature
            </button>

            <button style={accountButton} onClick={() => navigate("/settings")}>
              <img src={userIcon} style={accountIcon} />
              Account Page
            </button>

            {isAdmin && (
              <button style={accountButton} onClick={() => navigate("/admin")}>
                Admin
              </button>
            )}

            <button style={logoutButton} onClick={handleLogout}>
              LOG OUT
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

//////////////////////////////////////////////////
// STYLES
//////////////////////////////////////////////////

const topBar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "14px 20px",
  borderBottom: "1px solid #eee",
  background: "#fff",
  position: "sticky",
  top: 0,
  zIndex: 1000
};

const title = {
  fontWeight: "600",
  fontSize: "16px"
};

const rightSide = {
  position: "relative"
};

const profileCircle = {
  width: "34px",
  height: "34px",
  borderRadius: "50%",
  background: "#111",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const dropdown = {
  position: "absolute",
  right: 0,
  top: "50px",
  background: "#fff",
  border: "1px solid #ddd",
  padding: "18px",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  width: "240px",
  boxShadow: "0 10px 22px rgba(0,0,0,0.12)"
};

const inputStyle = {
  border: "1px solid #ddd",
  borderRadius: "8px",
  padding: "10px",
  fontSize: "13px"
};

const loginButton = {
  background: "#111",
  color: "#fff",
  border: "none",
  padding: "10px",
  cursor: "pointer",
  borderRadius: "6px"
};

const googleButton = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  border: "1px solid #ddd",
  background: "#fff",
  padding: "10px",
  cursor: "pointer",
  borderRadius: "6px"
};

const googleLogoStyle = {
  width: "20px"
};

const signupText = {
  fontSize: "12px",
  textAlign: "center",
  cursor: "pointer"
};

const orDivider = {
  textAlign: "center",
  fontSize: "12px",
  color: "#777"
};

const userName = {
  fontWeight: "600"
};

const accountButton = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  background: "#f7f7f7",
  border: "1px solid #ddd",
  padding: "10px",
  cursor: "pointer",
  borderRadius: "6px"
};

const accountIcon = {
  width: "18px"
};

const logoutButton = {
  background: "#111",
  color: "#fff",
  border: "none",
  padding: "10px",
  cursor: "pointer",
  borderRadius: "6px"
};