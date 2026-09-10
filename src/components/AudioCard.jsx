import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { toggleSaveSermon } from "../utils/saveSermon";
import AiSummary from "./AiSummary";

export default function AudioCard({ audio, onPlay, onSummarySaved, onSaveChange }) {
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let isCurrent = true;
    const user = auth.currentUser;

    if (!user) {
      setIsSaved(false);
      return undefined;
    }

    getDoc(doc(db, "saved", `${user.uid}_${audio.id}`))
      .then((snapshot) => {
        if (isCurrent) setIsSaved(snapshot.exists());
      })
      .catch((error) => {
        console.error("Unable to check saved audio", error);
      });

    return () => { isCurrent = false; };
  }, [audio.id]);

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) {
      setSaveError("Please sign in to save audio.");
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
      setSaveError("We couldn't update your saved audio. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const label = audio.type === "sundayschool" ? "Sunday School" : audio.type === "homily" ? "Homily" : "Sermon";

  return (
    <div style={card}>
      <button type="button" onClick={handleSave} style={saveButton} disabled={isSaving} aria-pressed={isSaved}>
        {isSaving ? "Saving…" : isSaved ? "Saved" : "Save"}
      </button>
      <span style={tagStyle(audio.type)}>{label}</span>
      <h3 style={titleStyle}>{audio.title}</h3>
      <p style={speakerStyle}>{audio.speaker}</p>
      <button onClick={() => onPlay(audio)} style={playButton}>
        <span style={{ fontSize: "11px" }}>▶</span> Play
      </button>
      {saveError && <p style={saveErrorStyle} role="alert">{saveError}</p>}
      <AiSummary audio={audio} onSummarySaved={onSummarySaved} />
    </div>
  );
}

const card = { position: "relative", background: "#fffdf9", borderRadius: "18px", padding: "22px 22px 18px", marginBottom: "16px", border: "1px solid #eddfc8", boxShadow: "0 2px 12px rgba(160,100,40,0.07)" };
const saveButton = { position: "absolute", top: "16px", right: "16px", padding: "7px 13px", borderRadius: "999px", border: "1px solid #c8922a", background: "#fffdf9", color: "#7a4f10", cursor: "pointer", fontSize: "12px", fontFamily: "sans-serif" };
const tagStyle = (type) => ({ display: "inline-block", fontSize: "11px", padding: "3px 10px", borderRadius: "999px", background: type === "homily" ? "#e8f0fe" : type === "sundayschool" ? "#e9f5e8" : "#f6e4b0", color: type === "homily" ? "#2a5ab5" : type === "sundayschool" ? "#39763c" : "#7a5a10", fontFamily: "sans-serif", marginBottom: "10px", letterSpacing: "0.04em" });
const titleStyle = { marginBottom: "5px", fontSize: "17px", fontWeight: "normal", color: "#3d2200" };
const speakerStyle = { color: "#9b7040", fontSize: "13px", marginBottom: "14px", fontFamily: "sans-serif" };
const playButton = { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 18px", borderRadius: "999px", border: "none", background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)", color: "#fff8ee", cursor: "pointer", fontSize: "13px", fontFamily: "sans-serif", boxShadow: "0 3px 10px rgba(160,80,20,0.25)" };
const saveErrorStyle = { color: "#a33622", fontSize: "13px", fontFamily: "sans-serif", margin: "10px 0 0" };
