import { useEffect, useState } from "react";
import { useAudioPlayer } from "../context/AudioPlayerContext";

export default function MiniPlayer() {
  const { current, isPlaying, togglePlay, audioRef } = useAudioPlayer();

  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  //////////////////////////////////////////////////
  // SYNC AUDIO
  //////////////////////////////////////////////////
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const update = () => {
      setProgress(audio.currentTime);
      setDuration(audio.duration || 0);
    };

    audio.addEventListener("timeupdate", update);
    audio.addEventListener("loadedmetadata", update);

    return () => {
      audio.removeEventListener("timeupdate", update);
      audio.removeEventListener("loadedmetadata", update);
    };
  }, [audioRef, current]);

  //////////////////////////////////////////////////
  // SEEK
  //////////////////////////////////////////////////
  const handleSeek = (e) => {
    const audio = audioRef.current;
    const value = Number(e.target.value);

    audio.currentTime = value;
    setProgress(value);
  };

  //////////////////////////////////////////////////
  // JUMP
  //////////////////////////////////////////////////
  const jump = (sec) => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = Math.max(
      0,
      Math.min(audio.duration, audio.currentTime + sec)
    );
  };

  //////////////////////////////////////////////////
  // FORMAT TIME
  //////////////////////////////////////////////////
  const format = (time) => {
    if (!time) return "0:00";
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (!current) return null;

  //////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////
  return (
    <div style={container}>
      <audio ref={audioRef} src={current.audioURL} />

      {/* TITLE + SPEAKER */}
      <div style={info}>
        <div style={title}>{current.title}</div>
        <div style={speaker}>{current.speaker}</div>
      </div>

      {/* CONTROLS */}
      <div style={controls}>
        <button onClick={() => jump(-30)} style={iconBtn}>⏪</button>

        <button onClick={togglePlay} style={playBtn}>
          {isPlaying ? "❚❚" : "▶"}
        </button>

        <button onClick={() => jump(30)} style={iconBtn}>⏩</button>
      </div>

      {/* SEEK BAR */}
      <div style={seekWrapper}>
        <span style={time}>{format(progress)}</span>

        <input
          type="range"
          min="0"
          max={duration || 0}
          value={progress}
          onChange={handleSeek}
          style={seek}
        />

        <span style={time}>{format(duration)}</span>
      </div>
    </div>
  );
}

//////////////////////////////////////////////////
// 🎨 STYLES
//////////////////////////////////////////////////

const container = {
  position: "fixed",
  bottom: "0",
  left: "0",
  width: "100%",
  background: "#f3f3f3",
  borderTop: "1px solid #ddd",
  padding: "12px 14px",
  boxShadow: "0 -2px 10px rgba(0,0,0,0.05)",
  zIndex: 999,
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const info = {
  textAlign: "center",
};

const title = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#222",
};

const speaker = {
  fontSize: "12px",
  color: "#666",
};

const controls = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: "16px",
};

const iconBtn = {
  border: "none",
  background: "none",
  fontSize: "18px",
  cursor: "pointer",
};

const playBtn = {
  border: "none",
  background: "#111",
  color: "#fff",
  borderRadius: "50%",
  width: "42px",
  height: "42px",
  cursor: "pointer",
  fontSize: "16px",
};

const seekWrapper = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  width: "100%",
};

const seek = {
  flex: 1,
  appearance: "none",
  height: "4px",
  borderRadius: "4px",
  background: "#ddd",
  outline: "none",
};

const time = {
  fontSize: "11px",
  color: "#666",
  minWidth: "35px",
  textAlign: "center",
};