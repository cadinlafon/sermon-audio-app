import { useAudioPlayer } from "../context/AudioPlayerContext";

export default function Player() {
  const { current, isPlaying, togglePlay, audioRef } = useAudioPlayer();

  if (!current) return <div style={{ padding: 40 }}>No audio</div>;

  const skip = (sec) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime += sec;
  };

  return (
    <div style={container}>
      <div style={card}>
        <div style={title}>{current.title}</div>
        <div style={speaker}>{current.speaker}</div>

        <div style={controls}>
          <button onClick={() => skip(-30)}>⏪ 30</button>
          <button onClick={togglePlay}>
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button onClick={() => skip(30)}>30 ⏩</button>
        </div>
      </div>
    </div>
  );
}

const container = {
  padding: "40px",
  display: "flex",
  justifyContent: "center",
};

const card = {
  background: "#fff",
  padding: "30px",
  borderRadius: "20px",
  width: "100%",
  maxWidth: "500px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
};

const title = {
  fontSize: "22px",
  fontWeight: "600",
};

const speaker = {
  marginTop: "10px",
  color: "#666",
};

const controls = {
  marginTop: "30px",
  display: "flex",
  justifyContent: "space-around",
};