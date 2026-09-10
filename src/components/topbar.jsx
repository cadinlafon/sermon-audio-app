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
      <div style={title}>Palouse Fellowship</div>

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
            <div style={guestCircle}>
              <img src={userIcon} style={guestIcon} alt="Account" />
            </div>
          )}
        </div>

        {/* NOT LOGGED IN */}
        {showProfile && !user && (
          <div style={dropdown}>
            <p style={dropdownHeading}>Welcome back</p>

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
              LOG IN
            </button>

            <div style={orDivider}>
              <span style={orLine} />
              <span>or</span>
              <span style={orLine} />
            </div>

            <button style={googleButton} onClick={signInWithGoogle}>
              <img src={googleLogo} style={googleLogoStyle} alt="" />
              Continue with Google
            </button>

            <p
              style={signupText}
              onClick={() => navigate("/signup")}
            >
              Don't have an account? <span style={signupLink}>Sign up</span>
            </p>

            {error && <p style={errorText}>{error}</p>}
          </div>
        )}

        {/* LOGGED IN */}
        {showProfile && user && (
          <div style={dropdown}>
            <div style={userName}>
              {user.displayName || user.email}
            </div>

            <div style={divider} />

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
              <img src={userIcon} style={accountIcon} alt="" />
              Account Page
            </button>

            {isAdmin && (
              <button style={adminButton} onClick={() => navigate("/admin")}>
                Admin
              </button>
            )}

            <div style={divider} />

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
  padding: "14px 24px",
  borderBottom: "1px solid #eddfc8",
  background: "#fffdf9",
  position: "sticky",
  top: 0,
  zIndex: 1000,
  fontFamily: "sans-serif"
};

const title = {
  fontWeight: "normal",
  fontSize: "17px",
  fontFamily: "'Georgia', serif",
  color: "#3d2200",
  letterSpacing: "0.01em"
};

const rightSide = {
  position: "relative"
};

const profileCircle = {
  width: "36px",
  height: "36px",
  borderRadius: "50%",
  background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)",
  color: "#fff8ee",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "sans-serif",
  fontSize: "14px",
  fontWeight: "600",
  boxShadow: "0 3px 10px rgba(160,80,20,0.32)",
  transition: "transform 0.15s ease"
};

const guestCircle = {
  width: "36px",
  height: "36px",
  borderRadius: "50%",
  background: "#fdf1e2",
  border: "1px solid #eddfc8",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const guestIcon = {
  width: "17px",
  opacity: 0.75,
  filter: "sepia(1) saturate(2) hue-rotate(10deg) brightness(0.6)"
};

const dropdown = {
  position: "absolute",
  right: 0,
  top: "50px",
  background: "#fffdf9",
  border: "1px solid #eddfc8",
  padding: "20px",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  width: "260px",
  borderRadius: "14px",
  boxShadow: "0 12px 32px rgba(160,80,20,0.16)"
};

const dropdownHeading = {
  margin: "0 0 4px",
  fontFamily: "'Georgia', serif",
  fontSize: "16px",
  color: "#3d2200"
};

const inputStyle = {
  border: "1px solid #eddfc8",
  borderRadius: "8px",
  padding: "10px 12px",
  fontSize: "13px",
  fontFamily: "sans-serif",
  background: "#fffdf9",
  color: "#3d2200",
  outline: "none"
};

const loginButton = {
  background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)",
  color: "#fff8ee",
  border: "none",
  padding: "11px",
  cursor: "pointer",
  borderRadius: "8px",
  fontSize: "13px",
  fontWeight: "600",
  letterSpacing: "0.04em",
  fontFamily: "sans-serif",
  boxShadow: "0 4px 14px rgba(160,80,20,0.28)"
};

const googleButton = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  border: "1px solid #eddfc8",
  background: "#fffdf9",
  padding: "10px",
  cursor: "pointer",
  borderRadius: "8px",
  fontSize: "13px",
  fontFamily: "sans-serif",
  color: "#7a4f10"
};

const googleLogoStyle = {
  width: "18px"
};

const signupText = {
  fontSize: "12px",
  textAlign: "center",
  cursor: "pointer",
  fontFamily: "sans-serif",
  color: "#b08050",
  margin: "2px 0 0"
};

const signupLink = {
  color: "#c97c2e",
  fontWeight: "600"
};

const orDivider = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  textAlign: "center",
  fontSize: "11px",
  color: "#b08050",
  fontFamily: "sans-serif"
};

const orLine = {
  flex: 1,
  height: "1px",
  background: "#eddfc8"
};

const userName = {
  fontWeight: "normal",
  fontFamily: "'Georgia', serif",
  fontSize: "15px",
  color: "#3d2200"
};

const divider = {
  height: "1px",
  background: "#eddfc8",
  margin: "2px 0"
};

const accountButton = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  background: "#fdf8f3",
  border: "1px solid #eddfc8",
  padding: "10px 12px",
  cursor: "pointer",
  borderRadius: "8px",
  fontSize: "13px",
  fontFamily: "sans-serif",
  color: "#7a4f10",
  textAlign: "left"
};

const adminButton = {
  ...accountButton,
  background: "#fdf1e2",
  border: "1px solid #e0a458",
  color: "#a85e18",
  fontWeight: "600"
};

const accountIcon = {
  width: "16px",
  filter: "sepia(1) saturate(2) hue-rotate(10deg) brightness(0.6)"
};

const logoutButton = {
  background: "transparent",
  color: "#a85e18",
  border: "1px solid #e0a458",
  padding: "10px",
  cursor: "pointer",
  borderRadius: "8px",
  fontSize: "13px",
  fontWeight: "600",
  letterSpacing: "0.04em",
  fontFamily: "sans-serif"
};

const errorText = {
  color: "#b3432c",
  fontSize: "12px",
  fontFamily: "sans-serif",
  margin: "2px 0 0"
};