import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { toggleSaveSermon } from "../utils/saveSermon";
import { fetchListenProgress, setListenStatus } from "../utils/listenProgress";
import { useAudioPlayer } from "../context/AudioPlayerContext";
import AiSummary from "./AiSummary";

export default function AudioCard({ audio, onPlay, onSummarySaved, onSaveChange }) {
  const { playNext, current, isPlaying, togglePlay, duration, currentTime } = useAudioPlayer();
  const [user, setUser] = useState(auth.currentUser);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [queued, setQueued] = useState(false);
  const [progress, setProgress] = useState(null);
  const [statusError, setStatusError] = useState("");

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    let isCurrent = true;
    const user = auth.currentUser;

    if (!user) {
      setIsSaved(false);
      setProgress(null);
      return undefined;
    }

    getDoc(doc(db, "saved", `${user.uid}_${audio.id}`))
      .then((snapshot) => {
        if (isCurrent) setIsSaved(snapshot.exists());
      })
      .catch((error) => {
        console.error("Unable to check saved audio", error);
      });

    fetchListenProgress(user.uid, audio.id)
      .then((data) => {
        if (isCurrent) setProgress(data);
      })
      .catch((error) => {
        console.error("Unable to check listen progress", error);
      });

    return () => { isCurrent = false; };
  }, [audio.id]);

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) {
      setSaveError("Please sign in to like audio.");
      return;
    }

    setSaveError("");
    setIsSaving(true);
    try {
      const saved = await toggleSaveSermon(user.uid, audio);
      setIsSaved(saved);
      onSaveChange?.(saved, audio.id);
    } catch (error) {
      console.error("Unable to save audio", error);
      setSaveError("We couldn't update your liked sermons. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const label = audio.type === "sundayschool" ? "Sunday School" : audio.type === "homily" ? "Homily" : "Sermon";
  const status = progress?.status || "not-started";
  const isThisTrack = current?.id === audio.id;

  const handlePlayNext = () => {
    playNext(audio);
    setQueued(true);
    setTimeout(() => setQueued(false), 1800);
  };

  const handlePlayClick = () => {
    if (isThisTrack) {
      togglePlay();
      return;
    }
    if (status === "in-progress" && progress?.position) {
      onPlay(audio, { resumeAt: progress.position });
    } else {
      onPlay(audio);
    }
  };

  const handleStatusChange = async (e) => {
    const value = e.target.value;
    e.target.value = "";
    if (!value) return;

    const user = auth.currentUser;
    if (!user) {
      setStatusError("Please sign in to update listen status.");
      return;
    }

    setStatusError("");
    setProgress((p) => ({ ...(p || {}), status: value, position: value === "not-started" ? 0 : p?.position || 0 }));
    try {
      await setListenStatus(user.uid, audio.id, value);
    } catch (error) {
      console.error("Unable to update listen status", error);
      setStatusError("We couldn't update the status. Please try again.");
    }
  };

  // While this card's track is the one actually loaded, show the live
  // position instead of the last-saved snapshot — otherwise the bar
  // would sit frozen next to a "Pause" button that implies it's moving.
  const progressPercent = isThisTrack && duration
    ? Math.min(100, (currentTime / duration) * 100)
    : progress?.duration
    ? Math.min(100, (progress.position / progress.duration) * 100)
    : 0;
  const showProgressBar = isThisTrack ? isPlaying || currentTime > 0 : status === "in-progress";

  return (
    <div style={card}>
      <button
        type="button"
        onClick={handleSave}
        style={saveButton}
        disabled={isSaving}
        aria-pressed={isSaved}
        aria-label={isSaved ? "Unlike" : "Like"}
        title={isSaved ? "Unlike" : "Like"}
      >
        {isSaved ? "❤️" : "🤍"}
      </button>
      <span style={tagStyle(audio.type)}>{label}</span>
      {status === "completed" && <span style={completedBadge}>✓ Completed</span>}
      <h3 style={titleStyle}>{audio.title}</h3>
      <p style={speakerStyle}>{audio.speaker}</p>

      {showProgressBar && (
        <div style={resumeTrack}>
          <div style={{ ...resumeFill, width: `${progressPercent}%` }} />
        </div>
      )}

      <div style={playRow}>
        <button onClick={handlePlayClick} style={playButton}>
          {isThisTrack ? (
            <>
              <span style={{ fontSize: "11px" }}>{isPlaying ? "❚❚" : "▶"}</span>
              {isPlaying ? "Pause" : "Play"}
            </>
          ) : (
            <>
              <span style={{ fontSize: "11px" }}>{status === "completed" ? "↻" : "▶"}</span>
              {status === "completed" ? "Play Again" : status === "in-progress" ? "Resume" : "Play"}
            </>
          )}
        </button>
        <button onClick={handlePlayNext} style={playNextButton}>
          {queued ? "✓ Added" : "+ Play Next"}
        </button>
        <select defaultValue="" onChange={handleStatusChange} style={statusSelect} aria-label="Change listen status">
          <option value="" disabled>Change ▾</option>
          <option value="completed">Mark Completed</option>
          <option value="not-started">Mark Not Started</option>
        </select>
      </div>
      {!user && <p style={signInHint}>🔒 Sign in to save your spot — it'll be right here to resume next time you open the app.</p>}
      {saveError && <p style={saveErrorStyle} role="alert">{saveError}</p>}
      {statusError && <p style={saveErrorStyle} role="alert">{statusError}</p>}
      <AiSummary audio={audio} onSummarySaved={onSummarySaved} />
    </div>
  );
}

const card = { position: "relative", background: "#fffdf9", borderRadius: "18px", padding: "22px 22px 18px", marginBottom: "16px", border: "1px solid #eddfc8", boxShadow: "0 2px 12px rgba(160,100,40,0.07)" };
const saveButton = { position: "absolute", top: "14px", right: "14px", width: "36px", height: "36px", borderRadius: "50%", border: "1px solid #eddfc8", background: "#fffdf9", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "17px", lineHeight: 1 };
const tagStyle = (type) => ({ display: "inline-block", fontSize: "11px", padding: "3px 10px", borderRadius: "999px", background: type === "homily" ? "#e8f0fe" : type === "sundayschool" ? "#e9f5e8" : "#f6e4b0", color: type === "homily" ? "#2a5ab5" : type === "sundayschool" ? "#39763c" : "#7a5a10", fontFamily: "sans-serif", marginBottom: "10px", letterSpacing: "0.04em" });
const titleStyle = { marginBottom: "5px", fontSize: "17px", fontWeight: "normal", color: "#3d2200" };
const speakerStyle = { color: "#9b7040", fontSize: "13px", marginBottom: "14px", fontFamily: "sans-serif" };
const playButton = { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 18px", borderRadius: "999px", border: "none", background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)", color: "#fff8ee", cursor: "pointer", fontSize: "13px", fontFamily: "sans-serif", boxShadow: "0 3px 10px rgba(160,80,20,0.25)" };
const playRow = { display: "flex", gap: "8px", flexWrap: "wrap" };
const playNextButton = { display: "inline-flex", alignItems: "center", padding: "8px 14px", borderRadius: "999px", border: "1px solid #eddfc8", background: "#fdf8f3", color: "#7a4f10", cursor: "pointer", fontSize: "13px", fontFamily: "sans-serif" };
const statusSelect = { padding: "8px 10px", borderRadius: "999px", border: "1px solid #eddfc8", background: "#fdf8f3", color: "#7a4f10", cursor: "pointer", fontSize: "13px", fontFamily: "sans-serif" };
const completedBadge = { display: "inline-block", fontSize: "11px", padding: "3px 10px", borderRadius: "999px", background: "#e3f5e6", color: "#2f8a4a", fontFamily: "sans-serif", marginLeft: "8px", marginBottom: "10px", fontWeight: "600" };
const resumeTrack = { height: "5px", borderRadius: "999px", background: "#eddfc8", overflow: "hidden", marginBottom: "14px" };
const resumeFill = { height: "100%", background: "linear-gradient(to right, #e08930, #c97c2e)" };
const saveErrorStyle = { color: "#a33622", fontSize: "13px", fontFamily: "sans-serif", margin: "10px 0 0" };
const signInHint = { color: "#9b7040", fontSize: "12px", fontFamily: "sans-serif", fontStyle: "italic", margin: "10px 0 0" };
