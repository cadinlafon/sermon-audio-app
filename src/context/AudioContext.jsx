import { createContext, useContext, useRef, useState, useEffect } from "react";

const AudioContext = createContext();

export function AudioProvider({ children }) {
  const audioRef = useRef(new Audio());
  const [currentAudio, setCurrentAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const setMeta = () => setDuration(audio.duration);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", setMeta);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", setMeta);
    };
  }, []);

  const playAudio = (url, title, speaker) => {
    const audio = audioRef.current;

    if (audio.src !== url) {
      audio.src = url;
      setCurrentAudio({ url, title, speaker });
    }

    audio.play();
    setIsPlaying(true);
  };

  const playPause = () => {
    const audio = audioRef.current;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  const seekBackward = () => {
    audioRef.current.currentTime -= 10;
  };

  const seekTo = (time) => {
    audioRef.current.currentTime = time;
  };

  return (
    <AudioContext.Provider
      value={{
        currentAudio,
        isPlaying,
        playAudio,
        playPause,
        seekBackward,
        currentTime,
        duration,
        seekTo,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  return useContext(AudioContext);
}
