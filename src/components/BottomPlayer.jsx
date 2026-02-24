import { useAudio } from "../context/AudioContext";

export default function BottomPlayer() {
  const {
    currentAudio,
    isPlaying,
    playPause,
    seekBackward,
    currentTime,
    duration,
    seekTo,
  } = useAudio();

  if (!currentAudio) return null;

  const progressPercent = duration
    ? (currentTime / duration) * 100
    : 0;

  const formatTime = (time) => {
    if (!time) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60)
      .toString()
      .padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "95%",
        maxWidth: "500px",
        background: "white",
        borderRadius: "20px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
        padding: "16px",
        fontFamily: "system-ui",
        zIndex: 1000,
      }}
    >
      {/* Title + Speaker */}
      <div style={{ marginBottom: "10px" }}>
        <div style={{ fontWeight: "600", fontSize: "15px" }}>
          {currentAudio.title}
        </div>
        <div style={{ fontSize: "13px", color: "#666" }}>
          {currentAudio.speaker || "Unknown Speaker"}
        </div>
      </div>

      {/* Progress Bar */}
      <div
        style={{
          width: "100%",
          height: "6px",
          background: "#eee",
          borderRadius: "10px",
          cursor: "pointer",
          marginBottom: "6px",
          position: "relative",
        }}
        onClick={(e) => {
          const rect = e.target.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const newTime = (clickX / rect.width) * duration;
          seekTo(newTime);
        }}
      >
        <div
          style={{
            width: `${progressPercent}%`,
            height: "100%",
            background: "#111",
            borderRadius: "10px",
          }}
        />
      </div>

      {/* Time */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "12px",
          color: "#777",
          marginBottom: "10px",
        }}
      >
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "10px",
        }}
      >
        <button onClick={seekBackward} style={buttonStyle}>
          ⏪ 10s
        </button>

        <button onClick={playPause} style={buttonStyle}>
          {isPlaying ? "Pause" : "Play"}
        </button>
      </div>
    </div>
  );
}

const buttonStyle = {
  padding: "8px 14px",
  borderRadius: "12px",
  border: "none",
  background: "#111",
  color: "white",
  cursor: "pointer",
};
