import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  onAuthStateChanged,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { logEvent } from "../utils/logEvent";
import googleLogo from "../assets/auth/google-logo.png";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  // If already logged in, don't leave the user sitting on /login.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate("/", { replace: true });
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  //////////////////////////////////////////////////
  // EMAIL LOGIN
  //////////////////////////////////////////////////
  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const result = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      await logEvent("user_login", {
        uid: result.user.uid,
      });

      setEmail("");
      setPassword("");

      navigate("/", { replace: true });
    } catch (err) {
      console.error("Login failed:", err);

      if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/user-not-found"
      ) {
        setError("Invalid email or password.");
      } else if (err.code === "auth/too-many-requests") {
        setError(
          "Too many failed attempts. Please wait a moment and try again."
        );
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else {
        setError("Unable to sign in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  //////////////////////////////////////////////////
  // GOOGLE LOGIN
  //////////////////////////////////////////////////
  const signInWithGoogle = async () => {
    try {
      setGoogleLoading(true);
      setError("");

      const result = await signInWithPopup(auth, googleProvider);

      await logEvent("google_login", {
        uid: result.user.uid,
      });

      navigate("/", { replace: true });
    } catch (err) {
      console.error("Google login failed:", err);

      if (err.code === "auth/popup-closed-by-user") {
        setError("Google sign-in was cancelled.");
      } else {
        setError("Google sign-in failed. Please try again.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  //////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////
  return (
    <div style={page}>
      {/* HEADER */}
      <div style={heroBand}>
        <p style={eyebrow}>Palouse Fellowship</p>

        <h1 style={heroTitle}>Welcome Back</h1>

        <p style={heroSub}>
          Sign in to access your sermons, saved recordings, and more.
        </p>
      </div>

      {/* CONTENT */}
      <div style={contentArea}>
        <div style={card}>
          {/* GOOGLE */}
          <button
            onClick={signInWithGoogle}
            disabled={googleLoading || loading}
            style={
              googleLoading
                ? { ...googleButton, opacity: 0.65 }
                : googleButton
            }
          >
            <img
              src={googleLogo}
              style={googleLogoStyle}
              alt="Google"
            />

            {googleLoading
              ? "Signing in…"
              : "Continue with Google"}
          </button>

          {/* DIVIDER */}
          <div style={dividerRow}>
            <div style={dividerLine} />
            <span style={dividerText}>or</span>
            <div style={dividerLine} />
          </div>

          {/* EMAIL LOGIN */}
          <form onSubmit={handleLogin}>
            <div style={formGroup}>
              {/* EMAIL */}
              <div style={fieldGroup}>
                <label style={fieldLabel}>Email</label>

                <input
                  type="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputStyle}
                  autoComplete="email"
                  disabled={loading || googleLoading}
                />
              </div>

              {/* PASSWORD */}
              <div style={fieldGroup}>
                <label style={fieldLabel}>Password</label>

                <input
                  type="password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={inputStyle}
                  autoComplete="current-password"
                  disabled={loading || googleLoading}
                />
              </div>

              {/* ERROR */}
              {error && (
                <div style={errorBox}>
                  {error}
                </div>
              )}

              {/* LOGIN */}
              <button
                type="submit"
                disabled={loading || googleLoading}
                style={
                  loading
                    ? { ...primaryButton, opacity: 0.7 }
                    : primaryButton
                }
              >
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </div>
          </form>

          {/* SIGN UP */}
          <div style={signupSection}>
            <span>Don't have an account?</span>

            <button
              type="button"
              onClick={() => navigate("/signup")}
              style={signupButton}
            >
              Create an account
            </button>
          </div>
        </div>

        {/* BACK TO APP */}
        <button
          onClick={() => navigate("/")}
          style={backButton}
        >
          ← Back to App
        </button>
      </div>
    </div>
  );
}

//////////////////////////////////////////////////
// STYLES
//////////////////////////////////////////////////

const page = {
  background: "#fdf8f3",
  minHeight: "100vh",
  fontFamily: "'Georgia', serif",
};

const heroBand = {
  background:
    "linear-gradient(135deg, #6b3a10 0%, #3d2200 100%)",
  padding: "48px 24px 42px",
  textAlign: "center",
};

const eyebrow = {
  margin: "0 0 7px",
  fontSize: "12px",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "rgba(255,235,190,0.65)",
  fontFamily: "sans-serif",
};

const heroTitle = {
  margin: "0 0 8px",
  fontSize: "30px",
  fontWeight: "normal",
  color: "#fff8ee",
};

const heroSub = {
  margin: 0,
  fontSize: "15px",
  lineHeight: 1.5,
  color: "rgba(255,235,190,0.75)",
  fontFamily: "sans-serif",
};

const contentArea = {
  padding: "32px 20px 60px",
  maxWidth: "440px",
  margin: "0 auto",
};

const card = {
  background: "#fffdf9",
  borderRadius: "20px",
  padding: "28px 24px",
  border: "1px solid #eddfc8",
  boxShadow: "0 4px 20px rgba(160,100,40,0.08)",
  marginBottom: "18px",
};

const googleButton = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #eddfc8",
  background: "#fdf8f3",
  color: "#3d2200",
  cursor: "pointer",
  fontSize: "14px",
  fontFamily: "sans-serif",
};

const googleLogoStyle = {
  width: "18px",
  height: "18px",
  flexShrink: 0,
};

const dividerRow = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  margin: "18px 0",
};

const dividerLine = {
  flex: 1,
  height: "1px",
  background: "#eddfc8",
};

const dividerText = {
  fontSize: "12px",
  color: "#b08050",
  fontFamily: "sans-serif",
};

const formGroup = {
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};

const fieldGroup = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const fieldLabel = {
  fontSize: "11px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#b08050",
  fontFamily: "sans-serif",
};

const inputStyle = {
  padding: "12px 14px",
  borderRadius: "10px",
  border: "1px solid #eddfc8",
  fontSize: "14px",
  fontFamily: "sans-serif",
  background: "#fdf8f3",
  color: "#3d2200",
  outline: "none",
  boxSizing: "border-box",
  width: "100%",
};

const errorBox = {
  padding: "10px 12px",
  borderRadius: "9px",
  background: "#fbeaea",
  border: "1px solid #efcaca",
  color: "#a32d2d",
  fontSize: "13px",
  fontFamily: "sans-serif",
  lineHeight: 1.4,
};

const primaryButton = {
  width: "100%",
  padding: "13px",
  borderRadius: "12px",
  border: "none",
  background:
    "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)",
  color: "#fff8ee",
  cursor: "pointer",
  fontSize: "15px",
  fontFamily: "sans-serif",
  boxShadow: "0 4px 14px rgba(160,80,20,0.28)",
  letterSpacing: "0.02em",
};

const signupSection = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "5px",
  marginTop: "22px",
  fontSize: "13px",
  color: "#9b7040",
  fontFamily: "sans-serif",
};

const signupButton = {
  border: "none",
  background: "transparent",
  color: "#c97c2e",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "13px",
  fontFamily: "sans-serif",
  padding: 0,
};

const backButton = {
  display: "block",
  margin: "0 auto",
  border: "none",
  background: "transparent",
  color: "#9b7040",
  cursor: "pointer",
  fontSize: "13px",
  fontFamily: "sans-serif",
};