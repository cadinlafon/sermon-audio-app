import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAudioPlayer } from "../context/AudioPlayerContext";

// Target of every "Copy Link" / "Share" button on an audio card —
// loads the sermon by id and hands off to the shared player, then
// lands on /player. Public, same as playback itself.
export default function ListenDeepLink() {
  const { audioId } = useParams();
  const navigate = useNavigate();
  const { playSermon } = useAudioPlayer();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const snap = await getDoc(doc(db, "audio", audioId));
        if (!snap.exists()) {
          if (!cancelled) setError("This sermon couldn't be found — it may have been removed.");
          return;
        }
        const sermon = { id: snap.id, ...snap.data() };
        await playSermon(sermon);
        if (!cancelled) navigate("/player", { replace: true });
      } catch (err) {
        console.error("Unable to load shared sermon", err);
        if (!cancelled) setError("Something went wrong loading this sermon.");
      }
    }

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioId]);

  if (error) {
    return (
      <div style={page}>
        <div style={card}>
          <span style={icon}>🔗</span>
          <h1 style={title}>Link Unavailable</h1>
          <p style={body}>{error}</p>
          <button style={btn} onClick={() => navigate("/sermons")}>Browse Sermons</button>
        </div>
      </div>
    );
  }

  return (
    <div style={page}>
      <p style={loadingText}>Loading sermon…</p>
    </div>
  );
}

const page = {
  minHeight: "100vh",
  background: "#fdf8f3",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "40px 20px",
  fontFamily: "'Georgia', serif",
};

const card = {
  background: "#fffdf9",
  borderRadius: "20px",
  padding: "48px 36px",
  maxWidth: "440px",
  width: "100%",
  textAlign: "center",
  border: "1px solid #eddfc8",
  boxShadow: "0 4px 20px rgba(160,100,40,0.08)",
};

const icon = { fontSize: "36px", display: "block", marginBottom: "14px" };
const title = { fontSize: "22px", fontWeight: "normal", color: "#3d2200", marginBottom: "10px" };
const body = { fontSize: "14px", color: "#9b7040", lineHeight: 1.7, fontFamily: "sans-serif", margin: "0 0 20px" };
const btn = {
  padding: "12px 22px",
  borderRadius: "10px",
  border: "none",
  background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)",
  color: "#fff8ee",
  fontSize: "14px",
  fontFamily: "sans-serif",
  cursor: "pointer",
};
const loadingText = { color: "#9b7040", fontFamily: "sans-serif", fontStyle: "italic" };
