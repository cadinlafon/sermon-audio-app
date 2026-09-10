import { useNavigate } from "react-router-dom";
import { useAudioPlayer } from "../context/AudioPlayerContext";

import back30 from "../assets/Player/back30.png";
import pauseIcon from "../assets/Player/pause.png";
import playIcon from "../assets/Player/play.png";

export default function MiniPlayer() {
  const { current, isPlaying, togglePlay, audioRef } = useAudioPlayer();
  const navigate = useNavigate();

  if (!current) return null;

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
    <div style={container} onClick={() => navigate("/player")}>
      {/* warm left accent bar */}
      <div style={accentBar} />

      <div style={textContainer}>
        <div style={nowPlayingLabel}>Now Playing</div>
        <div style={title}>{current.title}</div>
        <div style={speaker}>{current.speaker}</div>
      </div>

      <div style={controls}>
        <button onClick={jumpBack} style={iconBtn} title="Back 30s">
          <img src={back30} style={iconImg} alt="Back 30 seconds" />
        </button>

        <button onClick={handlePlay} style={playBtn}>
          <img
            src={isPlaying ? pauseIcon : playIcon}
            style={playIconStyle}
            alt={isPlaying ? "Pause" : "Play"}
          />
        </button>
      </div>
    </div>
  );
}

//////////////////////////////////////////////////
// STYLES
//////////////////////////////////////////////////

const container = {
  position: "fixed",
  bottom: "70px",
  left: "10px",
  right: "10px",
  background: "linear-gradient(135deg, #4a2200 0%, #3d2000 100%)",
  color: "#fff8ee",
  borderRadius: "18px",
  padding: "12px 16px 12px 0",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  zIndex: 999,
  boxShadow: "0 6px 24px rgba(80,35,0,0.35)",
  cursor: "pointer",
  overflow: "hidden",
};

const accentBar = {
  width: "4px",
  alignSelf: "stretch",
  background: "linear-gradient(to bottom, #e08930, #c97c2e)",
  borderRadius: "0 3px 3px 0",
  marginRight: "14px",
  flexShrink: 0,
};

const textContainer = {
  flex: 1,
  overflow: "hidden",
  minWidth: 0,
};

const nowPlayingLabel = {
  fontSize: "9px",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "rgba(255,220,150,0.65)",
  marginBottom: "2px",
  fontFamily: "sans-serif",
};

const title = {
  fontSize: "14px",
  fontWeight: "600",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  color: "#fff8ee",
  fontFamily: "'Georgia', serif",
  lineHeight: 1.3,
};

const speaker = {
  fontSize: "11px",
  color: "rgba(255,210,140,0.75)",
  fontFamily: "sans-serif",
  marginTop: "2px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const controls = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexShrink: 0,
  marginLeft: "12px",
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
  width: "22px",
  opacity: 0.85,
  filter: "brightness(0) invert(1)",
};

const playBtn = {
  background: "linear-gradient(135deg, #e08930 0%, #c97c2e 100%)",
  border: "none",
  borderRadius: "50%",
  width: "40px",
  height: "40px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: "0 2px 10px rgba(200,100,20,0.45)",
  flexShrink: 0,
};

const playIconStyle = {
  width: "17px",
  filter: "brightness(0) invert(1)",
};
