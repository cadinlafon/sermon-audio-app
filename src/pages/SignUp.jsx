import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";import { auth, db } from "../firebase";

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
const [fullName, setFullName] = useState("");
  const handleSignUp = async () => {
if (!fullName || !email || !password) {     
   alert("Please enter full name, email, and password.");
      return;
    }

    try {
      setLoading(true);

      // 🔐 Create Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      const user = userCredential.user;

      // 📩 Send verification email
      await sendEmailVerification(user);

      // 🔥 Create Firestore user document
     await setDoc(doc(db, "users", user.uid), {
  uid: user.uid,
  fullName: fullName,
  email: user.email,
  role: "user",
  emailVerified: false,
  createdAt: serverTimestamp(),
  notificationPreferences: {
    sermons: true,
    sundaySchool: true,
    homilys: true,
    announcements: true,
  },
});
      alert(
        "Account created! Please check your email to verify your account before logging in."
      );

      // Clear fields
      setEmail("");
      setPassword("");
setFullName("");

    } catch (error) {
      if (error.code === "auth/invalid-email") {
        alert("Invalid email format.");
      } else if (error.code === "auth/email-already-in-use") {
        alert("Email already in use.");
      } else if (error.code === "auth/weak-password") {
        alert("Password should be at least 6 characters.");
      } else {
        alert(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "40px", maxWidth: "400px", margin: "0 auto" }}>
      <h2>Create Account</h2>
<input
  type="text"
  placeholder="Full Name"
  value={fullName}
  onChange={(e) => setFullName(e.target.value)}
  style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
/>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
      />

      <button
        onClick={handleSignUp}
        disabled={loading}
        style={{
          width: "100%",
          padding: "10px",
          background: "#111",
          color: "white",
          border: "none",
          cursor: "pointer",
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? "Creating..." : "Sign Up"}
      </button>
    </div>
  );
}