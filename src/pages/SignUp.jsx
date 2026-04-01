import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithPopup
} from "firebase/auth";

import {
  doc,
  setDoc,
  serverTimestamp,
  addDoc,
  collection,
  getDoc
} from "firebase/firestore";

import { auth, db, googleProvider } from "../firebase";
import googleLogo from "../assets/auth/google-logo.png";

export default function SignUp() {

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  //////////////////////////////////////////////////
  // EMAIL SIGNUP
  //////////////////////////////////////////////////
  const handleSignUp = async () => {
    if (!fullName || !email || !password) {
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

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        fullName,
        email: user.email,
        role: "user",
        loginMethod: "email",
        emailVerified: true,
        createdAt: serverTimestamp()
      });

      await addDoc(collection(db, "logs"), {
        type: "account_created",
        userId: user.uid,
        email: user.email,
        timestamp: serverTimestamp()
      });

      setEmail("");
      setPassword("");
      setFullName("");

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
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          fullName: user.displayName,
          email: user.email,
          role: "user",
          loginMethod: "google",
          emailVerified: true,
          createdAt: serverTimestamp()
        });

        await addDoc(collection(db, "logs"), {
          type: "account_created_google",
          userId: user.uid,
          email: user.email,
          timestamp: serverTimestamp()
        });
      }

    } catch (err) {
      setError("Google signup failed");
    }
  };

  //////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////
  return (
    <div style={container}>

      <div style={card}>
        <h2 style={{ marginBottom: "15px" }}>Create Account</h2>

        <input
          type="text"
          placeholder="Full Name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          style={input}
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={input}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={input}
        />

        <button
          onClick={handleSignUp}
          disabled={loading}
          style={primaryButton}
        >
          {loading ? "Creating..." : "Sign Up"}
        </button>

        <div style={divider}>or</div>

        <button
          onClick={signUpWithGoogle}
          style={googleButton}
        >
          <img src={googleLogo} style={{ width: "20px" }} />
          Continue with Google
        </button>

        {error && (
          <p style={{ color: "red", fontSize: "12px", marginTop: "10px" }}>
            {error}
          </p>
        )}
      </div>

    </div>
  );
}

//////////////////////////////////////////////////
// STYLES (MATCH NAVBAR DROPDOWN)
//////////////////////////////////////////////////

const container = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "60px 20px"
};

const card = {
  width: "100%",
  maxWidth: "380px",
  background: "#fff",
  border: "1px solid #ddd",
  borderRadius: "10px",
  padding: "25px",
  boxShadow: "0 10px 22px rgba(0,0,0,0.08)",
  display: "flex",
  flexDirection: "column",
  gap: "10px"
};

const input = {
  border: "1px solid #ddd",
  borderRadius: "8px",
  padding: "10px",
  fontSize: "13px",
  background: "#fafafa"
};

const primaryButton = {
  background: "#111",
  color: "#fff",
  border: "none",
  padding: "10px",
  fontWeight: "600",
  cursor: "pointer",
  borderRadius: "6px",
  marginTop: "5px"
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
  fontWeight: "600",
  borderRadius: "6px"
};

const divider = {
  textAlign: "center",
  fontSize: "12px",
  color: "#777",
  margin: "10px 0"
};