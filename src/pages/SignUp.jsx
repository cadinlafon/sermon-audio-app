import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import {
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { auth, db, googleProvider } from "../firebase";
import googleLogo from "../assets/auth/google-logo.png";
import { logEvent } from "../utils/logEvent";
import { getTrafficData } from "../utils/trafficSource";

const REFERRAL_OPTIONS = [
  "Church Email",
  "QR Code / Printed Ad",
  "Facebook",
  "Instagram",
  "YouTube",
  "Google Search",
  "ChatGPT",
  "Claude",
  "Gemini",
  "TikTok",
  "Reddit",
  "Church Website",
  "Friend or Family Member",
  "Pastor / Church Staff",
  "Church Bulletin",
  "Flyer / Poster",
  "Word of Mouth",
  "Other",
];

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [referralSource, setReferralSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  //////////////////////////////////////////////////
  // EMAIL SIGNUP
  //////////////////////////////////////////////////
  const handleSignUp = async () => {
    if (!fullName || !email || !password || !referralSource) {
      setError("Please fill out all fields.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      const user = userCredential.user;

      // Attribute this signup to whichever referral source
      // first brought this visitor to the app.
      const traffic = getTrafficData();

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        fullName,
        email: user.email,
        role: "user",
        loginMethod: "email",
        emailVerified: true,

        // User-provided answer
        howDidYouFindUs: referralSource,

        // Automatic traffic attribution
        referral: {
          source: traffic.firstTrafficSource,
          medium: traffic.firstTrafficMedium,
          campaign: traffic.firstTrafficCampaign,
          platform: traffic.firstPlatform,
        },

        createdAt: serverTimestamp(),
      });

      await logEvent("account_created", {
        userId: user.uid,
        email: user.email,
        referralSource,
      });

      setEmail("");
      setPassword("");
      setFullName("");
      setReferralSource("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  //////////////////////////////////////////////////
  // GOOGLE SIGNUP
  //////////////////////////////////////////////////
  const signUpWithGoogle = async () => {
    if (!referralSource) {
      setError("Please select how you found this app first.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        const traffic = getTrafficData();

        await setDoc(userRef, {
          uid: user.uid,
          fullName: user.displayName,
          email: user.email,
          role: "user",
          loginMethod: "google",
          emailVerified: true,

          // User-provided answer
          howDidYouFindUs: referralSource,

          // Automatic traffic attribution
          referral: {
            source: traffic.firstTrafficSource,
            medium: traffic.firstTrafficMedium,
            campaign: traffic.firstTrafficCampaign,
            platform: traffic.firstPlatform,
          },

          createdAt: serverTimestamp(),
        });

        await logEvent("account_created_google", {
          userId: user.uid,
          email: user.email,
          referralSource,
        });
      }
    } catch (err) {
      setError("Google sign-up failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  //////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////
  return (
    <div style={page}>
      {/* HEADER BAND */}
      <div style={heroBand}>
        <p style={eyebrow}>Palouse Fellowship</p>
        <h1 style={heroTitle}>Create Account</h1>
        <p style={heroSub}>
          Save sermons, track your listens, and more.
        </p>
      </div>

      <div style={contentArea}>
        <div style={card}>

          {/* GOOGLE */}
          <button
            onClick={signUpWithGoogle}
            style={googleButton}
            disabled={loading}
          >
            <img
              src={googleLogo}
              style={{ width: "18px", flexShrink: 0 }}
              alt="Google"
            />
            Continue with Google
          </button>

          <div style={dividerRow}>
            <div style={dividerLine} />
            <span style={dividerText}>or</span>
            <div style={dividerLine} />
          </div>

          {/* EMAIL FORM */}
          <div style={fieldGroup}>
            <label style={fieldLabel}>Full Name</label>
            <input
              type="text"
              placeholder="Your name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={fieldGroup}>
            <label style={fieldLabel}>Email</label>
            <input
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={fieldGroup}>
            <label style={fieldLabel}>Password</label>
            <input
              type="password"
              placeholder="Choose a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* HOW DID YOU FIND US */}
          <div style={fieldGroup}>
            <label style={fieldLabel}>
              How did you find this app?
            </label>

            <select
              value={referralSource}
              onChange={(e) => setReferralSource(e.target.value)}
              style={selectStyle}
              disabled={loading}
            >
              <option value="">
                Select an option...
              </option>

              {REFERRAL_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          {error && <p style={errorText}>{error}</p>}

          <button
            onClick={handleSignUp}
            disabled={loading}
            style={
              loading
                ? { ...primaryButton, opacity: 0.7 }
                : primaryButton
            }
          >
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </div>

        <p style={footerNote}>
          Already have an account?{" "}
          <a href="/login" style={footerLink}>
            Sign in
          </a>
        </p>
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
  padding: "40px 24px 36px",
  textAlign: "center",
};

const eyebrow = {
  margin: "0 0 6px",
  fontSize: "12px",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "rgba(255,235,190,0.65)",
  fontFamily: "sans-serif",
};

const heroTitle = {
  margin: "0 0 8px",
  fontSize: "28px",
  fontWeight: "normal",
  color: "#fff8ee",
};

const heroSub = {
  margin: 0,
  fontSize: "15px",
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
  display: "flex",
  flexDirection: "column",
  gap: "14px",
  marginBottom: "20px",
};

const googleButton = {
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

const dividerRow = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
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
};

const selectStyle = {
  ...inputStyle,
  cursor: "pointer",
  appearance: "auto",
};

const errorText = {
  fontSize: "13px",
  color: "#a32d2d",
  fontFamily: "sans-serif",
  margin: 0,
};

const primaryButton = {
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

const footerNote = {
  textAlign: "center",
  fontSize: "14px",
  color: "#9b7040",
  fontFamily: "sans-serif",
};

const footerLink = {
  color: "#c97c2e",
  textDecoration: "none",
  fontWeight: "bold",
};