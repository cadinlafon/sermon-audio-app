import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { trackListenTime, trackPlay, recordListen } from "../utils/listenTracker";
import { saveListenProgress } from "../utils/listenProgress";
import { getLocalBlobUrl } from "../utils/offlineDownloads";
import { loadPlayerSettings, savePlayerSettings, loadQueue, saveQueue, loadHistory, saveHistory, slimTrack } from "../utils/playerSettings";
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
  const pendingAutoplayRef = useRef(true);
  const autoResumeAttemptedRef = useRef(false);
  const autoSummarizedRef = useRef(new Set());

  const [current, setCurrent] = useState(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playError, setPlayError] = useState("");
  // True while a track is being prepared or the audio element is buffering.
  const [isLoading, setIsLoading] = useState(false);

  // Player preferences (skip intervals, speed, volume, repeat, shuffle...) —
  // remembered per device, see utils/playerSettings.js.
  const [settings, setSettings] = useState(loadPlayerSettings);
  const settingsRef = useRef(settings);
  const updateSettings = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) };
      savePlayerSettings(next);
      return next;
    });
  }, []);

  // Recently played, most recent first (persisted).
  const [history, setHistory] = useState(loadHistory);
  const historyRef = useRef(history);
  // Tracks already played out of the queue this session — what "repeat
  // queue" loops back through when the queue runs dry.
  const queuePastRef = useRef([]);
  // What to retry if playback failed before/while loading.
  const lastRequestRef = useRef(null);

  // Shared progress so any consumer (mini player, desktop mini player,
  // the full player page) can show a scrubber without each attaching
  // its own timeupdate/loadedmetadata listeners.
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // "Play Next" queue — a plain array of sermon objects. Newest
  // "Play Next" goes to the front, ahead of whatever was queued
  // before it (same convention as Spotify/Apple Music).
  const [queue, setQueue] = useState(loadQueue);
  const queueRef = useRef(queue);

  // Sleep timer: null (off), "duration" (counting down to a pause),
  // or "endOfTrack" (pause when the current track ends instead of
  // advancing the queue).
  const [sleepTimerMode, setSleepTimerMode] = useState(null);
  const [sleepTimerEndsAt, setSleepTimerEndsAt] = useState(null);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState(0);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { historyRef.current = history; saveHistory(history); }, [history]);
  // The queue survives reloads.
  useEffect(() => { queueRef.current = queue; saveQueue(queue); }, [queue]);

  // Apply speed / volume / mute to the audio element. defaultPlaybackRate is
  // what a freshly loaded track starts at, so the chosen speed sticks.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.defaultPlaybackRate = settings.speed;
    audio.playbackRate = settings.speed;
    audio.volume = settings.volume;
    audio.muted = settings.muted;
  }, [settings.speed, settings.volume, settings.muted, audioUrl]);

  // Loading indicator + playback errors from the element itself.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    const busy = () => setIsLoading(true);
    const ready = () => setIsLoading(false);
    const failed = () => {
      setIsLoading(false);
      if (!audio.getAttribute("src")) return;
      setPlayError(navigator.onLine ? "This audio couldn't be loaded." : "You're offline and this audio isn't available. Tap to retry once you're back online.");
    };
    audio.addEventListener("loadstart", busy);
    audio.addEventListener("waiting", busy);
    audio.addEventListener("canplay", ready);
    audio.addEventListener("playing", ready);
    audio.addEventListener("error", failed);
    return () => {
      audio.removeEventListener("loadstart", busy);
      audio.removeEventListener("waiting", busy);
      audio.removeEventListener("canplay", ready);
      audio.removeEventListener("playing", ready);
      audio.removeEventListener("error", failed);
    };
  }, []);

  // Picks back up a signed-in listener's last in-progress track on app
  // open — loaded and seeked to the right spot, but not auto-played
  // (browsers block audio.play() without a real tap anyway, and even
  // where they wouldn't, starting sermon audio the instant the app
  // opens with no warning would be a bad surprise). One tap on the
  // mini player's Play button — a real user gesture — continues it.
  // Only ever attempted once per page load, and never if the listener
  // already started something else before this resolves.
  useEffect(() => onAuthStateChanged(auth, (user) => {
    userRef.current = user;
    if (!user || autoResumeAttemptedRef.current) return;
    autoResumeAttemptedRef.current = true;

    (async () => {
      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const lastPlayed = userSnap.exists() ? userSnap.data().lastPlayed : null;
        if (!lastPlayed?.audioId || currentRef.current) return;

        const audioSnap = await getDoc(doc(db, "audio", lastPlayed.audioId));
        if (!audioSnap.exists() || currentRef.current) return;

        const sermon = { id: audioSnap.id, ...audioSnap.data() };
        playSermon(sermon, { resumeAt: lastPlayed.position, autoplay: false });
      } catch (error) {
        console.warn("Couldn't restore last-played audio", error);
      }
    })();
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
      if (sermon && playedCurrentRef.current !== sermon.id) {
        playedCurrentRef.current = sermon.id;
        // Guest-inclusive — the only thing that records a guest listen
        // at all. Feeds the admin Audio Stats page.
        void recordListen({ sermonId: sermon.id, userId: user?.uid || null });
        if (user) {
          void trackPlay({
            userId: user.uid,
            sermonId: sermon.id,
            title: sermon.title,
            speaker: sermon.speaker,
          });
        }
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

    const shouldAutoplay = pendingAutoplayRef.current;
    pendingAutoplayRef.current = true; // reset to the default for next time
    if (shouldAutoplay) audio.play().catch(() => setIsPlaying(false));
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
  // through. `options.autoplay` (default true) set to false loads and
  // seeks without calling .play() — used by the app-open auto-resume
  // effect above, which shouldn't start sound without a real tap.
  const playSermon = async (sermon, options = {}) => {
    flushListenTime();
    const user = auth.currentUser;
    lastRequestRef.current = { sermon, options: { ...options, fromHistory: false } };
    setPlayError("");
    setIsLoading(true);
    try {
      let url;

      if (!navigator.onLine) {
        // Offline: only a downloaded-for-offline copy can play at all —
        // there's nothing to fall back to fetch a signed URL from.
        url = user ? await getLocalBlobUrl(user.uid, sermon.id) : null;
        if (!url) {
          setPlayError("You're offline and this hasn't been downloaded for offline listening. Tap to retry once you're back online.");
          setIsLoading(false);
          return;
        }
      } else {
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
      }

      pendingResumeRef.current = options.resumeAt || null;
      pendingAutoplayRef.current = options.autoplay !== false;
      setAudioUrl(url);
      setCurrent(sermon);
      if (!options.fromHistory) {
        setHistory((h) => [slimTrack(sermon), ...h.filter((x) => x.id !== sermon.id)].slice(0, 30));
      }
      if (navigator.onLine) triggerAutoSummary(sermon, url);
    } catch (error) {
      console.error("Unable to prepare private audio", error);
      setIsLoading(false);
      setPlayError(navigator.onLine ? error.message || "Audio is unavailable." : "You're offline. Tap to retry once you're back online.");
    }
  };

  // Re-attempts whatever last failed (or reloads the current track at its
  // current position).
  const retryPlayback = () => {
    const req = lastRequestRef.current;
    if (!req) return;
    const resumeAt = currentRef.current?.id === req.sermon.id ? audioRef.current?.currentTime || req.options.resumeAt : req.options.resumeAt;
    playSermon(req.sermon, { ...req.options, resumeAt, autoplay: true });
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

  const playSermonRef = useRef(null);
  playSermonRef.current = playSermon;
  const sleepModeRef = useRef(null);
  sleepModeRef.current = sleepTimerMode;

  const playNext = (sermon) => {
    setQueue((q) => [slimTrack(sermon), ...q.filter((s) => s.id !== sermon.id)]);
  };

  const removeFromQueue = (index) => {
    setQueue((q) => q.filter((_, i) => i !== index));
  };

  const clearQueue = () => {
    queuePastRef.current = [];
    setQueue([]);
  };

  // Drag-and-drop / arrow reordering in the queue sheet.
  const moveQueueItem = (from, to) => {
    setQueue((q) => {
      if (from === to || from < 0 || to < 0 || from >= q.length || to >= q.length) return q;
      const next = [...q];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const shuffleQueueNow = () => {
    setQueue((q) => {
      const next = [...q];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    });
  };

  // "Play all" / "Add all to queue" / "Add remaining" from any list.
  const playAll = (list) => {
    const items = (list || []).filter((t) => t && t.id);
    if (items.length === 0) return;
    queuePastRef.current = [];
    setQueue(items.slice(1).map(slimTrack));
    playSermon(items[0]);
  };

  const addAllToQueue = (list) => {
    setQueue((q) => {
      const have = new Set(q.map((s) => s.id));
      if (currentRef.current) have.add(currentRef.current.id);
      return [...q, ...(list || []).filter((t) => t && t.id && !have.has(t.id)).map(slimTrack)];
    });
  };

  // Everything after the playing track in the list you're looking at (or the
  // whole list if the current track isn't in it).
  const addRemainingToQueue = (list) => {
    const items = list || [];
    const cur = currentRef.current;
    const i = cur ? items.findIndex((t) => t.id === cur.id) : -1;
    addAllToQueue(i >= 0 ? items.slice(i + 1) : items);
  };

  // Advance to the next track. `auto` = the track ended on its own, which is
  // when "repeat queue" loops back around; a manual Next never loops.
  const advance = (auto = false) => {
    const q = queueRef.current;
    const cur = currentRef.current;
    const audio = audioRef.current;

    if (q.length === 0) {
      if (auto && settingsRef.current.repeat === "queue" && cur) {
        const all = [...queuePastRef.current, cur];
        queuePastRef.current = [];
        if (all.length > 1) {
          setQueue(all.slice(1).map(slimTrack));
          playSermonRef.current(all[0]);
        } else if (audio) {
          audio.currentTime = 0;
          audio.play().catch(() => {});
        }
      }
      return;
    }

    const index = settingsRef.current.shuffle ? Math.floor(Math.random() * q.length) : 0;
    const next = q[index];
    if (cur) queuePastRef.current.push(cur);
    setQueue(q.filter((_, i) => i !== index));
    playSermonRef.current(next);
  };

  // Previous: restart the track if you're a few seconds in, otherwise go back
  // to what played before (the current track returns to the front of the queue).
  const playPrevious = () => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    const prev = historyRef.current[1];
    if (!prev) {
      if (audio) audio.currentTime = 0;
      return;
    }
    const cur = currentRef.current;
    if (cur) setQueue((q) => [slimTrack(cur), ...q.filter((s) => s.id !== cur.id)]);
    setHistory((h) => h.slice(1));
    playSermonRef.current(prev, { fromHistory: true });
  };

  // Auto-advance when a track ends — unless the sleep timer is set to stop
  // at the end of the current track. Repeat-track loops the same recording.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const onEnded = () => {
      if (sleepModeRef.current === "endOfTrack") {
        setSleepTimerMode(null);
        return;
      }
      if (settingsRef.current.repeat === "track") {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }
      advance(true);
    };

    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    navigator.mediaSession.setActionHandler("seekbackward", (d) => {
      if (audio) audio.currentTime = Math.max(0, audio.currentTime - (d?.seekOffset || settings.skipBack));
    });
    navigator.mediaSession.setActionHandler("seekforward", (d) => {
      if (audio) audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + (d?.seekOffset || settings.skipForward));
    });
    navigator.mediaSession.setActionHandler("previoustrack", () => playPrevious());
    navigator.mediaSession.setActionHandler("nexttrack", queue.length > 0 || settings.repeat === "queue" ? () => advance(false) : null);

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("seekbackward", null);
      navigator.mediaSession.setActionHandler("seekforward", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, settings.skipBack, settings.skipForward, settings.repeat]);

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
        moveQueueItem,
        shuffleQueueNow,
        playAll,
        addAllToQueue,
        addRemainingToQueue,
        advance,
        playPrevious,
        history,
        retryPlayback,
        isLoading,
        settings,
        updateSettings,
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
