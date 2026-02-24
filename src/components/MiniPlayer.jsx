import { useContext } from "react";
import { AudioContext } from "../context/AudioContext";

function MiniPlayer() {
  const { currentSermon, isPlaying, togglePlay, rewind10 } =
    useContext(AudioContext);

  if (!currentSermon) return null;

  return (
    <div className="mini-player">
      <div className="mini-info">
        <strong>{currentSermon.title}</strong>
      </div>

      <div className="mini-controls">
        <button onClick={rewind10}>⏪ 10s</button>
        <button onClick={togglePlay}>
          {isPlaying ? "Pause" : "Play"}
        </button>
      </div>
    </div>
  );
}

export default MiniPlayer;
