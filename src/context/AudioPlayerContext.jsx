import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { trackListenTime, trackPlay } from "../utils/listenTracker";
import { saveListenProgress } from "../utils/listenProgress";
import { supabase } from "../supabase";

const AudioPlayerContext = createContext();

const SUMMARIZABLE_TYPES = new Set(["sermon", "homily", "sundayschool"]);

export function AudioPlayerProvider({ children }) {
  const audioRef = useRef(null);
  const currentRef = useRef(null);
  const userRef = useRef(null);
  const lastTimeRef = useRef(null);
  const pendingSecondsRef = useRef(0);
  const playedCurrentRef = useRef(null);
  const pendingResumeRef = useRef(null);
  const autoSummarizedRef = useRef(new Set());

  const [current, setCurrent] = useState(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playError, setPlayError] = useState("");

  // Shared progress so any consumer (mini player, desktop mini player,
  // the full player page) can show a scrubber without each attaching
  // its own timeupdate/loadedmetadata listeners.
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // "Play Next" queue — a plain array of sermon objects. Newest
  // "Play Next" goes to the front, ahead of whatever was queued
  // before it (same convention as Spotify/Apple Music).
  const [queue, setQueue] = useState([]);

  // Sleep timer: null (off), "duration" (counting down to a pause),
  // or "endOfTrack" (pause when the current track ends instead of
  // advancing the queue).
  const [sleepTimerMode, setSleepTimerMode] = useState(null);
  const [sleepTimerEndsAt, setSleepTimerEndsAt] = useState(null);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState(0);

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

  // Powers the "Completed" / "Resume" / "Not Started" state shown on
  // audio cards. `completed` forces status to "completed" regardless
  // of the reported duration — used on the "ended" event, since a
  // slightly-off duration shouldn't stop a fully-played track from
  // reading as complete.
  const saveProgressNow = useCallback((completed = false) => {
    const audio = audioRef.current;
    const sermon = currentRef.current;
    const user = userRef.current;
    if (!audio || !sermon || !user) return;
    const duration = audio.duration || 0;
    const position = completed ? duration : audio.currentTime;
    void saveListenProgress(user.uid, sermon.id, { position, duration });
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
        if (pendingSecondsRef.current >= 30) {
          flushListenTime();
          saveProgressNow();
        }
      }
    };

    const onStop = (event) => {
      flushListenTime();
      saveProgressNow(event?.type === "ended");
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
  }, [flushListenTime, saveProgressNow]);

  // Shared progress/duration — separate from the tracking listeners
  // above so this stays simple regardless of how that logic evolves.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration || 0);

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
    };
  }, []);

  useEffect(() => {
    const flushOnHidden = () => {
      if (document.visibilityState === "hidden") {
        flushListenTime();
        saveProgressNow();
      }
    };
    const flushOnPageHide = () => {
      flushListenTime();
      saveProgressNow();
    };
    document.addEventListener("visibilitychange", flushOnHidden);
    window.addEventListener("pagehide", flushOnPageHide);
    return () => {
      document.removeEventListener("visibilitychange", flushOnHidden);
      window.removeEventListener("pagehide", flushOnPageHide);
    };
  }, [flushListenTime, saveProgressNow]);

  useEffect(() => {
    if (!current || !audioUrl || !audioRef.current) return;
    const audio = audioRef.current;
    playedCurrentRef.current = null;
    lastTimeRef.current = null;
    audio.load();

    const resumeAt = pendingResumeRef.current;
    pendingResumeRef.current = null;
    if (resumeAt) {
      const onLoaded = () => {
        audio.currentTime = resumeAt;
        audio.removeEventListener("loadedmetadata", onLoaded);
      };
      audio.addEventListener("loadedmetadata", onLoaded);
    }

    audio.play().catch(() => setIsPlaying(false));
  }, [current, audioUrl]);

  // Fires a silent, non-blocking AI summary generation the first time a
  // never-summarized track is played, instead of waiting for someone to
  // press "Summarize with AI" — the edge function itself dedupes
  // (returns the cached summary, or a no-op if one's already being
  // generated), so this doesn't multiply Groq usage even if several
  // listeners start the same untranscribed track around the same time.
  // Failures are swallowed on purpose: this is a background nice-to-have,
  // never something that should interrupt or error out playback.
  const triggerAutoSummary = (sermon, resolvedUrl) => {
    if (!sermon?.id || !SUMMARIZABLE_TYPES.has(sermon.type)) return;
    if (sermon.aiSummary) return;
    if (autoSummarizedRef.current.has(sermon.id)) return;
    const user = auth.currentUser;
    if (!user) return; // summarize-audio requires a signed-in caller

    autoSummarizedRef.current.add(sermon.id);
    (async () => {
      try {
        const token = await user.getIdToken();
        // A smaller, speech-optimized copy (made at upload time) keeps
        // long recordings under Groq's 25MB cap — resolve its own
        // signed URL rather than reusing the full-quality playback one.
        // Falls back to the already-resolved playback URL for audio
        // uploaded before that copy existed.
        const audioUrl = sermon.transcribeStorageKey
          ? await requestDownloadUrl({ audioStorageKey: sermon.transcribeStorageKey }, token)
          : resolvedUrl;
        await supabase.functions.invoke("summarize-audio", {
          headers: { Authorization: `Bearer ${token}` },
          body: { audioId: sermon.id, audioUrl, audioType: sermon.type, title: sermon.title || "Untitled audio" },
        });
      } catch (error) {
        console.warn("Background AI summary generation failed", error);
      }
    })();
  };

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
  // `options.resumeAt` (seconds) seeks there once metadata loads —
  // used by the "Resume" button on a card that was left partway
  // through.
  const playSermon = async (sermon, options = {}) => {
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
      pendingResumeRef.current = options.resumeAt || null;
      setAudioUrl(url);
      setCurrent(sermon);
      triggerAutoSummary(sermon, url);
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

  const seekTo = (seconds) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(seconds, audioRef.current.duration || seconds));
  };

  //////////////////////////////////////////////////
  // PLAY NEXT QUEUE
  //////////////////////////////////////////////////

  const playNext = (sermon) => {
    setQueue((q) => [sermon, ...q.filter((s) => s.id !== sermon.id)]);
  };

  const removeFromQueue = (index) => {
    setQueue((q) => q.filter((_, i) => i !== index));
  };

  const clearQueue = () => setQueue([]);

  // Auto-advance to the head of the queue when a track ends — unless
  // the sleep timer is set to stop at the end of the current track,
  // in which case playback just stops there.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const onEnded = () => {
      if (sleepTimerMode === "endOfTrack") {
        setSleepTimerMode(null);
        return;
      }
      setQueue((q) => {
        if (q.length === 0) return q;
        const [next, ...rest] = q;
        playSermon(next);
        return rest;
      });
    };

    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [sleepTimerMode]);

  //////////////////////////////////////////////////
  // SLEEP TIMER
  //////////////////////////////////////////////////

  // `value` is a number of minutes, the string "endOfTrack", or null to cancel.
  const setSleepTimer = (value) => {
    if (value == null) {
      setSleepTimerMode(null);
      setSleepTimerEndsAt(null);
      setSleepTimerRemaining(0);
      return;
    }
    if (value === "endOfTrack") {
      setSleepTimerMode("endOfTrack");
      setSleepTimerEndsAt(null);
      setSleepTimerRemaining(0);
      return;
    }
    setSleepTimerMode("duration");
    setSleepTimerEndsAt(Date.now() + value * 60000);
    setSleepTimerRemaining(value * 60);
  };

  useEffect(() => {
    if (sleepTimerMode !== "duration" || !sleepTimerEndsAt) return undefined;

    const tick = () => {
      const remainingMs = sleepTimerEndsAt - Date.now();
      if (remainingMs <= 0) {
        audioRef.current?.pause();
        setSleepTimerMode(null);
        setSleepTimerEndsAt(null);
        setSleepTimerRemaining(0);
        return;
      }
      setSleepTimerRemaining(Math.ceil(remainingMs / 1000));
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sleepTimerMode, sleepTimerEndsAt]);

  //////////////////////////////////////////////////
  // OUTPUT DEVICE (Bluetooth / internal speaker, etc.)
  //////////////////////////////////////////////////
  // Not supported on iOS Safari at all — iOS routes audio output at
  // the OS level (Control Center / AirPlay), not through the page.
  const outputDeviceSupported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.selectAudioOutput &&
    typeof HTMLMediaElement !== "undefined" &&
    "setSinkId" in HTMLMediaElement.prototype;

  const chooseOutputDevice = async () => {
    if (!outputDeviceSupported) throw new Error("Not supported in this browser.");
    const device = await navigator.mediaDevices.selectAudioOutput();
    if (audioRef.current?.setSinkId) {
      await audioRef.current.setSinkId(device.deviceId);
    }
    return device;
  };

  //////////////////////////////////////////////////
  // MEDIA SESSION — lock-screen / OS media controls
  //////////////////////////////////////////////////
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = current
      ? new MediaMetadata({
          title: current.title || "Sermon",
          artist: current.speaker || "Palouse Fellowship",
          album: "Palouse Fellowship",
          artwork: [{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }],
        })
      : null;
  }, [current]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return undefined;
    const audio = audioRef.current;

    navigator.mediaSession.setActionHandler("play", () => audio?.play().catch(() => {}));
    navigator.mediaSession.setActionHandler("pause", () => audio?.pause());
    navigator.mediaSession.setActionHandler("seekbackward", () => {
      if (audio) audio.currentTime = Math.max(0, audio.currentTime - 30);
    });
    navigator.mediaSession.setActionHandler("seekforward", () => {
      if (audio) audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + 30);
    });
    navigator.mediaSession.setActionHandler(
      "nexttrack",
      queue.length > 0
        ? () => {
            setQueue((q) => {
              if (q.length === 0) return q;
              const [next, ...rest] = q;
              playSermon(next);
              return rest;
            });
          }
        : null
    );

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("seekbackward", null);
      navigator.mediaSession.setActionHandler("seekforward", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
    };
  }, [queue]);

  return (
    <AudioPlayerContext.Provider
      value={{
        current,
        playSermon,
        togglePlay,
        isPlaying,
        audioRef,
        playError,
        duration,
        currentTime,
        seekTo,
        queue,
        playNext,
        removeFromQueue,
        clearQueue,
        sleepTimerMode,
        sleepTimerRemaining,
        setSleepTimer,
        outputDeviceSupported,
        chooseOutputDevice,
      }}
    >
      <audio ref={audioRef} src={audioUrl || undefined} preload="metadata" />
      {children}
    </AudioPlayerContext.Provider>
  );
}

export const useAudioPlayer = () => useContext(AudioPlayerContext);
