import { useRef, useState } from "react";

function AudioPlayerBar() {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioSrc =
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

  const STORAGE_KEY = "sample-sermon-progress";

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      localStorage.setItem(
        STORAGE_KEY,
        audioRef.current.currentTime
      );
      console.log("Saved on pause:", audioRef.current.currentTime);
    } else {
      audioRef.current.play();
    }

    setIsPlaying(!isPlaying);
  };

  return (
    <>
      <audio
        ref={audioRef}
        src={audioSrc}
        onLoadedMetadata={() => {
          const savedTime = localStorage.getItem(STORAGE_KEY);
          console.log("Loaded saved time:", savedTime);
          if (savedTime && audioRef.current) {
            audioRef.current.currentTime = parseFloat(savedTime);
          }
        }}
        onTimeUpdate={() => {
          if (audioRef.current) {
            localStorage.setItem(
              STORAGE_KEY,
              audioRef.current.currentTime
            );
          }
        }}
      />

      <div className="audio-bar">
        <div className="audio-info">
          <p className="audio-title">Sample Sermon</p>
        </div>

        <div className="audio-controls">
          <button onClick={togglePlay}>
            {isPlaying ? "⏸" : "▶️"}
          </button>
        </div>
      </div>
    </>
  );
}

export default AudioPlayerBar;