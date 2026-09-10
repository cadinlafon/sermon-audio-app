import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { trackListenTime, trackPlay } from "../utils/listenTracker";
import { supabase } from "../supabase";

const AudioPlayerContext = createContext();

export function AudioPlayerProvider({ children }) {
  const audioRef = useRef(null);
  const currentRef = useRef(null);
  const userRef = useRef(null);
  const lastTimeRef = useRef(null);
  const pendingSecondsRef = useRef(0);
  const playedCurrentRef = useRef(null);

  const [current, setCurrent] = useState(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playError, setPlayError] = useState("");

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  useEffect(() => onAuthStateChanged(auth, (user) => {
    userRef.current = user;
  }), []);

  const flushListenTime = useCallback(() => {
    const seconds = Math.floor(pendingSecondsRef.current);
    const sermon = currentRef.current;
    const user = userRef.current;

    if (!seconds || !sermon || !user) return;

    pendingSecondsRef.current -= seconds;
    void trackListenTime({
      userId: user.uid,
      sermonId: sermon.id,
      title: sermon.title,
      speaker: sermon.speaker,
      seconds,
    });
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const onPlay = () => {
      lastTimeRef.current = audio.currentTime;
      setIsPlaying(true);

      const sermon = currentRef.current;
      const user = userRef.current;
      if (sermon && user && playedCurrentRef.current !== sermon.id) {
        playedCurrentRef.current = sermon.id;
        void trackPlay({
          userId: user.uid,
          sermonId: sermon.id,
          title: sermon.title,
          speaker: sermon.speaker,
        });
      }
    };

    const onTimeUpdate = () => {
      const previousTime = lastTimeRef.current;
      const elapsed = audio.currentTime - previousTime;
      lastTimeRef.current = audio.currentTime;

      // Ignore seeks and discontinuities; only actual adjacent playback counts.
      if (Number.isFinite(elapsed) && elapsed > 0 && elapsed <= 5) {
        pendingSecondsRef.current += elapsed;
        if (pendingSecondsRef.current >= 30) flushListenTime();
      }
    };

    const onStop = () => {
      flushListenTime();
      lastTimeRef.current = null;
      setIsPlaying(false);
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("pause", onStop);
    audio.addEventListener("ended", onStop);

    return () => {
      flushListenTime();
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("pause", onStop);
      audio.removeEventListener("ended", onStop);
    };
  }, [flushListenTime]);

  useEffect(() => {
    const flushOnHidden = () => {
      if (document.visibilityState === "hidden") flushListenTime();
    };
    document.addEventListener("visibilitychange", flushOnHidden);
    window.addEventListener("pagehide", flushListenTime);
    return () => {
      document.removeEventListener("visibilitychange", flushOnHidden);
      window.removeEventListener("pagehide", flushListenTime);
    };
  }, [flushListenTime]);

  useEffect(() => {
    if (!current || !audioUrl || !audioRef.current) return;
    const audio = audioRef.current;
    playedCurrentRef.current = null;
    lastTimeRef.current = null;
    audio.load();
    audio.play().catch(() => setIsPlaying(false));
  }, [current, audioUrl]);

  const requestDownloadUrl = async (sermon, token) => {
    // Passing the storage key directly (when we already have it) skips
    // a redundant server-side Firestore lookup — the id/collection path
    // stays as a fallback for callers that only have an id.
    const body = sermon.audioStorageKey
      ? { storageKey: sermon.audioStorageKey }
      : { audioId: sermon.id, collection: sermon.collection || "audio" };

    const { data, error } = await supabase.functions.invoke("audio-download-url", {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body,
    });
    if (error || !data?.url) {
      const body = await error?.context?.json().catch(() => null);
      const err = new Error(body?.error || error?.message || "Audio is unavailable.");
      err.status = error?.context?.status;
      throw err;
    }
    return data.url;
  };

  // Listening doesn't require an account — logged-in users still send
  // their token (so listen tracking + any future access rules work),
  // but a missing/anonymous user is not blocked from playing.
  const playSermon = async (sermon) => {
    flushListenTime();
    const user = auth.currentUser;
    setPlayError("");
    try {
      let url;
      try {
        url = await requestDownloadUrl(sermon, user ? await user.getIdToken() : null);
      } catch (err) {
        // A stale cached ID token is a common, silent cause of "audio
        // won't play" — retry once with a forced-fresh token before
        // surfacing an error to the user.
        if (err.status === 401 && user) {
          url = await requestDownloadUrl(sermon, await user.getIdToken(true));
        } else {
          throw err;
        }
      }
      setAudioUrl(url);
      setCurrent(sermon);
    } catch (error) {
      console.error("Unable to prepare private audio", error);
      setPlayError(error.message || "Audio is unavailable.");
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (audioRef.current.paused) {
      audioRef.current.play().catch(() => setIsPlaying(false));
    } else {
      audioRef.current.pause();
    }
  };

  return (
    <AudioPlayerContext.Provider value={{ current, playSermon, togglePlay, isPlaying, audioRef, playError }}>
      <audio ref={audioRef} src={audioUrl || undefined} preload="metadata" />
      {children}
    </AudioPlayerContext.Provider>
  );
}

export const useAudioPlayer = () => useContext(AudioPlayerContext);
