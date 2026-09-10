import { useState } from "react";
import { db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function NoticeInputForm({ notice, user }) {
  const storageKey = `noticeSubmitted:${notice.id}`;
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Please enter a value.");
      return;
    }
    if (submitting || submitted) return;

    setError("");
    setSubmitting(true);
    try {
      await addDoc(collection(db, "noticeSubmissions"), {
        noticeId: notice.id,
        value: trimmed,
        createdAt: serverTimestamp(),
        userId: user?.uid || null,
        userEmail: user?.email || null,
      });
      setSubmitted(true);
      try {
        localStorage.setItem(storageKey, "1");
      } catch {
        // ignore storage errors (private browsing, etc.)
      }
    } catch (err) {
      console.error("Error submitting notice input:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div style={successBox}>
        <span>✓</span> Submitted!
      </div>
    );
  }

  return (
    <div style={wrap}>
      {notice.inputMessage && <p style={message}>{notice.inputMessage}</p>}
      <div style={row}>
        <input
          value={value}
          onChange={(e) => { setValue(e.target.value); if (error) setError(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          placeholder={notice.inputPlaceholder || "Enter value"}
          style={input}
          disabled={submitting}
        />
        <button style={submitBtn} onClick={handleSubmit} disabled={submitting}>
          {submitting ? "…" : (notice.inputButtonText || "Submit")}
        </button>
      </div>
      {error && <p style={errorText}>{error}</p>}
    </div>
  );
}

const wrap = { marginTop: "12px" };
const message = { margin: "0 0 8px", fontSize: "13px", color: "#6b4c20", lineHeight: 1.6, fontFamily: "sans-serif" };
const row = { display: "flex", gap: "8px", flexWrap: "wrap" };
const input = { flex: "1 1 180px", padding: "9px 12px", borderRadius: "8px", border: "1px solid #eddfc8", background: "#fffdf9", fontSize: "14px", fontFamily: "sans-serif", color: "#3d2200", outline: "none", minWidth: 0 };
const submitBtn = { padding: "9px 16px", borderRadius: "8px", border: "none", background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer", whiteSpace: "nowrap" };
const errorText = { margin: "6px 0 0", fontSize: "12px", color: "#b91c1c", fontFamily: "sans-serif" };
const successBox = { marginTop: "12px", display: "flex", alignItems: "center", gap: "6px", padding: "10px 14px", borderRadius: "8px", background: "#dcfce7", color: "#166534", fontSize: "13px", fontFamily: "sans-serif" };
