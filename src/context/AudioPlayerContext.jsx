import { createContext, useContext, useRef, useState } from "react";

const AudioPlayerContext = createContext();

export function AudioPlayerProvider({ children }) {
  const audioRef = useRef(null);

  const [current, setCurrent] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const playSermon = (sermon) => {
    setCurrent(sermon);

    setTimeout(() => {
      audioRef.current?.play();
      setIsPlaying(true);
    }, 100);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (audioRef.current.paused) {
      audioRef.current.play();
      setIsPlaying(true);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  return (
    <AudioPlayerContext.Provider
      value={{
        current,
        playSermon,
        togglePlay,
        isPlaying,
        audioRef,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
}

export const useAudioPlayer = () => useContext(AudioPlayerContext);