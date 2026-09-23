import { useNavigate } from "react-router-dom";
import { useAudioPlayer } from "../context/AudioPlayerContext";

import back30 from "../assets/Player/back30.png";

export default function MiniPlayer() {
  const { current, isPlaying, togglePlay, audioRef, duration, currentTime } = useAudioPlayer();
  const navigate = useNavigate();

  const hasAudio = !!current;
  const progressPercent = hasAudio && duration ? (currentTime / duration) * 100 : 0;

  const jumpBack = (e) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, audio.currentTime - 30);
  };

  const handlePlay = (e) => {
    e.stopPropagation();
    togglePlay();
  };

  return (
    <div
      style={hasAudio ? container : { ...container, ...containerEmpty }}
      onClick={() => hasAudio && navigate("/player")}
    >
      {hasAudio && (
        <div style={progressTrack}>
          <div style={{ ...progressFill, width: `${progressPercent}%` }} />
        </div>
      )}

      <div style={row}>
        <div style={textContainer}>
          {hasAudio ? (
            <>
              <div style={title}>{current.title}</div>
              <div style={speaker}>{current.speaker}</div>
            </>
          ) : (
            <div style={emptyTitle}>No audio playing</div>
          )}
        </div>

        {hasAudio && (
          <div style={controls}>
            <button onClick={jumpBack} style={iconBtn} title="Back 30s">
              <img src={back30} style={iconImg} alt="Back 30 seconds" />
            </button>

            <button onClick={handlePlay} style={playBtn}>
              <span style={playGlyph} aria-label={isPlaying ? "Pause" : "Play"}>
                {isPlaying ? "\u23F8\uFE0E" : "\u25B6\uFE0E"}
              </span>
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

const container = {
  width: "100%",
  background: "#fffdf9",
  boxSizing: "border-box",
  cursor: "pointer",
  overflow: "hidden",
  position: "relative",
};

const containerEmpty = {
  cursor: "default",
  opacity: 0.6,
};

const progressTrack = {
  height: "3px",
  width: "100%",
  background: "#eddfc8",
};

const progressFill = {
  height: "100%",
  background: "linear-gradient(to right, #e08930, #c97c2e)",
  transition: "width 0.2s linear",
};

const row = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 16px",
  gap: "12px",
};

const textContainer = {
  flex: 1,
  overflow: "hidden",
  minWidth: 0,
};

const title = {
  fontSize: "14px",
  fontWeight: "600",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  color: "#3d2200",
  fontFamily: "'Georgia', serif",
  lineHeight: 1.3,
};

const speaker = {
  fontSize: "11px",
  color: "#9b7040",
  fontFamily: "sans-serif",
  marginTop: "2px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const emptyTitle = {
  fontSize: "13px",
  color: "#b08050",
  fontFamily: "sans-serif",
  fontStyle: "italic",
};

const controls = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexShrink: 0,
};

const iconBtn = {
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "4px",
  display: "flex",
  alignItems: "center",
};

const iconImg = {
  width: "20px",
  opacity: 0.7,
  filter: "sepia(1) saturate(2) hue-rotate(10deg) brightness(0.6)",
};

const playBtn = {
  background: "linear-gradient(135deg, #e08930 0%, #c97c2e 100%)",
  border: "none",
  borderRadius: "50%",
  width: "36px",
  height: "36px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: "0 2px 10px rgba(200,100,20,0.35)",
  flexShrink: 0,
};

const playGlyph = {
  color: "#fff",
  fontSize: "22px",
  lineHeight: 1,
};
