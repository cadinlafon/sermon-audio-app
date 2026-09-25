import { createPortal } from "react-dom";
import { useAudioPlayer } from "../context/AudioPlayerContext";

import back30 from "../assets/Player/back30.png";
import forward30 from "../assets/Player/forward30.png";

// Rendered via a portal into the floating Document Picture-in-Picture
// window (see useDocumentPiP) — a portal keeps this inside the main
// React tree, so useAudioPlayer() still works normally even though
// the DOM it's attached to lives in a separate browser window.
export default function DesktopMiniPlayerContent({ pipWindow }) {
  const { current, isPlaying, togglePlay, audioRef, duration, currentTime, settings } = useAudioPlayer();

  if (!pipWindow) return null;

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

  const jumpBack = () => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = Math.max(0, audio.currentTime - settings.skipBack);
  };

  const jumpForward = () => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = Math.min(duration || Infinity, audio.currentTime + settings.skipForward);
  };

  return createPortal(
    <div style={wrap}>
      <div style={progressTrack}>
        <div style={{ ...progressFill, width: `${progressPercent}%` }} />
      </div>

      <div style={textBlock}>
        <div style={title}>{current?.title || "No audio playing"}</div>
        <div style={speaker}>{current?.speaker || ""}</div>
      </div>

      <div style={controls}>
        <button onClick={jumpBack} style={iconBtn} disabled={!current}>
          <img src={back30} style={iconImg} alt="Back 30s" />
        </button>
        <button onClick={togglePlay} style={playBtn} disabled={!current}>
          <span style={playGlyph} aria-label={isPlaying ? "Pause" : "Play"}>{isPlaying ? "\u23F8\uFE0E" : "\u25B6\uFE0E"}</span>
        </button>
        <button onClick={jumpForward} style={iconBtn} disabled={!current}>
          <img src={forward30} style={iconImg} alt="Forward 30s" />
        </button>
      </div>
    </div>,
    pipWindow.document.body
  );
}

const wrap = {
  fontFamily: "'Georgia', serif",
  background: "#fffdf9",
  height: "100vh",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  padding: "12px 16px",
  gap: "8px",
};

const progressTrack = { height: "3px", borderRadius: "999px", background: "#eddfc8", overflow: "hidden" };
const progressFill = { height: "100%", background: "linear-gradient(to right, #e08930, #c97c2e)" };

const textBlock = { flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center" };
const title = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#3d2200",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
const speaker = { fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif", marginTop: "2px" };

const controls = { display: "flex", alignItems: "center", justifyContent: "center", gap: "18px" };

const iconBtn = { background: "none", border: "none", cursor: "pointer", padding: "4px", display: "flex" };
const iconImg = { width: "20px", filter: "sepia(1) saturate(2) hue-rotate(10deg) brightness(0.6)" };

const playBtn = {
  background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)",
  border: "none",
  borderRadius: "50%",
  width: "40px",
  height: "40px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};
const playGlyph = { color: "#fff", fontSize: "24px", lineHeight: 1 };
