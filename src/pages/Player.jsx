import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { useAudioPlayer } from "../context/AudioPlayerContext";
import { useDocumentPiP } from "../hooks/useDocumentPiP";
import { fetchNote, saveNote, fetchBookmarks, saveBookmarks } from "../utils/notes";
import PlayerSettings from "../components/PlayerSettings";
import QueueSheet from "../components/QueueSheet";
import DesktopMiniPlayerContent from "../components/DesktopMiniPlayerContent";
import RelatedAudio from "../components/RelatedAudio";

import back30 from "../assets/Player/back30.png";
import forward30 from "../assets/Player/forward30.png";

const SLEEP_PRESETS = [5, 15, 30, 45, 60];

export default function Player() {
  const {
    current,
    isPlaying,
    togglePlay,
    audioRef,
    playSermon,
    duration,
    currentTime,
    seekTo,
    queue,
    playPrevious,
    advance,
    history,
    settings,
    updateSettings,
    isLoading,
    playError,
    retryPlayback,
    sleepTimerMode,
    sleepTimerRemaining,
    setSleepTimer,
    outputDeviceSupported,
    chooseOutputDevice,
  } = useAudioPlayer();
  const navigate = useNavigate();
  const pip = useDocumentPiP();

  const [progress, setProgress] = useState(currentTime);
  const speed = settings.speed;
  const showRemaining = settings.showRemaining;
  const setShowRemaining = (v) => updateSettings({ showRemaining: v });
  const [isDragging, setIsDragging] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [flashMsg, setFlashMsg] = useState("");
  const [timeCopied, setTimeCopied] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState("");
  const [selectedSleepPreset, setSelectedSleepPreset] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteStatus, setNoteStatus] = useState("");
  const noteSaveTimer = useRef(null);

  //////////////////////////////////////////////////
  // AUDIO EVENTS
  //////////////////////////////////////////////////
  // Read straight from the context's already-centralized currentTime
  // rather than re-attaching our own timeupdate/loadedmetadata
  // listeners here. The shared <audio> element never unmounts, so a
  // page-local listener that mounts after playback already started
  // (e.g. started from a list page, then opened here) would miss the
  // loadedmetadata event that already fired and be stuck at duration 0
  // — which is exactly what made the seek bar undraggable.
  useEffect(() => {
    if (!isDragging) setProgress(currentTime);
  }, [currentTime, isDragging]);

  //////////////////////////////////////////////////
  // NOTES
  //////////////////////////////////////////////////
  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !current?.id) {
      setNoteText("");
      return;
    }
    let cancelled = false;
    fetchNote(user.uid, current.id).then((text) => {
      if (!cancelled) setNoteText(text);
    });
    return () => { cancelled = true; };
  }, [current?.id]);

  const handleNoteChange = (e) => {
    const text = e.target.value;
    setNoteText(text);
    setNoteStatus("");
    clearTimeout(noteSaveTimer.current);
    noteSaveTimer.current = setTimeout(async () => {
      const user = auth.currentUser;
      if (!user || !current?.id) return;
      await saveNote(user.uid, current.id, text);
      setNoteStatus("Saved");
      setTimeout(() => setNoteStatus(""), 1500);
    }, 800);
  };

  //////////////////////////////////////////////////
  // BOOKMARKS + TIMESTAMPS
  //////////////////////////////////////////////////
  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !current?.id) {
      setBookmarks([]);
      return undefined;
    }
    let cancelled = false;
    fetchBookmarks(user.uid, current.id).then((list) => {
      if (!cancelled) setBookmarks(list);
    });
    return () => { cancelled = true; };
  }, [current?.id]);

  const flash = (text) => {
    setFlashMsg(text);
    setTimeout(() => setFlashMsg(""), 2200);
  };

  const persistBookmarks = (next) => {
    setBookmarks(next);
    const user = auth.currentUser;
    if (user && current?.id) saveBookmarks(user.uid, current.id, next);
  };

  const addBookmark = () => {
    if (!auth.currentUser) { flash("Sign in to save bookmarks."); return; }
    const t = Math.floor(audioRef.current?.currentTime || 0);
    const next = [...bookmarks, { id: Math.random().toString(36).slice(2, 10), t, label: "", createdAt: Date.now() }].sort((a, b) => a.t - b.t);
    persistBookmarks(next);
    flash(`Bookmarked ${format(t)}`);
  };

  const relabelBookmark = (id, label) => persistBookmarks(bookmarks.map((b) => (b.id === id ? { ...b, label: label.slice(0, 80) } : b)));
  const removeBookmark = (id) => persistBookmarks(bookmarks.filter((b) => b.id !== id));
  const jumpToBookmark = (t) => {
    seekTo(t);
    if (audioRef.current?.paused) audioRef.current.play().catch(() => {});
  };

  const timestampLink = () => `${deepLink}?t=${Math.floor(audioRef.current?.currentTime || progress || 0)}`;

  const copyTimestamp = async () => {
    try {
      await navigator.clipboard.writeText(format(audioRef.current?.currentTime || progress));
      setTimeCopied(true);
      setTimeout(() => setTimeCopied(false), 1500);
    } catch (error) {
      console.error("Couldn't copy timestamp", error);
    }
  };

  const shareTimestamp = async () => {
    const url = timestampLink();
    const at = format(audioRef.current?.currentTime || progress);
    if (navigator.share) {
      try {
        await navigator.share({ title: `${current?.title} (${at})`, text: current?.speaker, url });
      } catch (error) {
        if (error?.name !== "AbortError") console.error("Share failed", error);
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        flash(`Link to ${at} copied`);
      } catch (error) {
        console.error("Couldn't copy link", error);
      }
    }
  };

  const toggleSection = (key) => updateSettings((prev) => ({ sections: { ...prev.sections, [key]: !prev.sections[key] } }));

  //////////////////////////////////////////////////
  // SEEK
  //////////////////////////////////////////////////
  const handleSeek = (e) => {
    const value = Number(e.target.value);
    setProgress(value);
  };

  const commitSeek = (e) => {
    const value = Number(e.target.value);
    seekTo(value);
    setProgress(value);
    setIsDragging(false);
  };

  //////////////////////////////////////////////////
  // SPEED
  //////////////////////////////////////////////////
  const changeSpeed = (val) => updateSettings({ speed: val });

  //////////////////////////////////////////////////
  // SKIP
  //////////////////////////////////////////////////
  const jumpBack = () => {
    const audio = audioRef.current;
    audio.currentTime = Math.max(0, audio.currentTime - settings.skipBack);
  };

  const jumpForward = () => {
    const audio = audioRef.current;
    audio.currentTime = Math.min(duration || Infinity, audio.currentTime + settings.skipForward);
  };

  const startFromBeginning = () => {
    seekTo(0);
    if (audioRef.current?.paused) audioRef.current.play().catch(() => {});
  };

  //////////////////////////////////////////////////
  // SHARE / COPY LINK
  //////////////////////////////////////////////////
  const deepLink = current ? `${window.location.origin}/listen/${current.id}` : "";

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(deepLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
    } catch (error) {
      console.error("Couldn't copy link", error);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share?.({ title: current?.title, text: current?.speaker, url: deepLink });
    } catch (error) {
      if (error?.name !== "AbortError") console.error("Share failed", error);
    }
  };

  //////////////////////////////////////////////////
  // FORMAT TIME
  //////////////////////////////////////////////////
  const format = (time) => {
    if (!time || isNaN(time)) return "0:00";
    const h = Math.floor(time / 3600);
    const m = Math.floor((time % 3600) / 60);
    const s = Math.floor(time % 60).toString().padStart(2, "0");
    return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${s}` : `${m}:${s}`;
  };

  const progressPercent = duration ? (progress / duration) * 100 : 0;
  const remaining = duration ? duration - progress : 0;

  //////////////////////////////////////////////////
  // PLAY NEXT QUEUE
  //////////////////////////////////////////////////
  //////////////////////////////////////////////////
  // SLEEP TIMER
  //////////////////////////////////////////////////
  const formatSleepRemaining = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  //////////////////////////////////////////////////
  // OUTPUT DEVICE
  //////////////////////////////////////////////////
  const handleConnectDevice = async () => {
    setDeviceStatus("");
    try {
      const device = await chooseOutputDevice();
      setDeviceStatus(`Playing on ${device.label || "selected device"}`);
    } catch (err) {
      if (err?.name !== "NotFoundError" && err?.name !== "NotAllowedError") {
        setDeviceStatus(err.message || "Couldn't switch output device.");
      }
    }
  };

  //////////////////////////////////////////////////
  // DESKTOP MINI PLAYER
  //////////////////////////////////////////////////
  const toggleMiniPlayer = async () => {
    if (pip.active) {
      pip.close();
      return;
    }
    try {
      await pip.open({ width: 320, height: 140 });
    } catch {
      // User cancelled or the browser refused — nothing to recover from.
    }
  };

  if (!current) {
    return (
      <div style={page}>
        <button className="pf-back-btn" style={backBtn} onClick={() => navigate(-1)}>
          ← Back
        </button>
        <div style={{ ...card, alignItems: "center", padding: "60px 28px" }}>
          <span style={{ fontSize: "40px", marginBottom: "16px" }}>🎧</span>
          <h2 style={{ ...title, textAlign: "center" }}>No audio playing</h2>
          <p style={{ ...speaker, textAlign: "center" }}>Pick a sermon to start listening.</p>
        </div>
      </div>
    );
  }

  //////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////
  return (
    <div style={page} className="pf-player">
      <style>{`
        .pf-player input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #ffffff;
          border: 3px solid #c97c2e;
          box-shadow: 0 2px 8px rgba(160,80,20,0.4);
          cursor: pointer;
          transition: transform 0.15s ease;
        }
        .pf-player input[type="range"]:active::-webkit-slider-thumb {
          transform: scale(1.25);
        }
        .pf-player input[type="range"]::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #ffffff;
          border: 3px solid #c97c2e;
          box-shadow: 0 2px 8px rgba(160,80,20,0.4);
          cursor: pointer;
        }
        .pf-player button:focus-visible,
        .pf-player input:focus-visible {
          outline: 2px solid #c97c2e;
          outline-offset: 3px;
        }
        .pf-player .pf-play-btn:hover {
          transform: scale(1.04);
          box-shadow: 0 8px 28px rgba(160,80,20,0.46);
        }
        .pf-player .pf-play-btn:active {
          transform: scale(0.97);
        }
        .pf-player .pf-skip-btn:hover img {
          opacity: 1;
          transform: scale(1.08);
        }
        .pf-player .pf-speed-btn:hover {
          border-color: #c98d4e;
        }
        .pf-player .pf-share-btn:hover {
          background: #fdf1e2;
        }
        .pf-player .pf-back-btn:hover {
          color: #c97c2e;
        }
        @keyframes pf-spin { to { transform: rotate(360deg); } }
        .pf-spinner {
          display: inline-block; width: 14px; height: 14px; border-radius: 50%;
          border: 2px solid #eddfc8; border-top-color: #c97c2e; animation: pf-spin 0.8s linear infinite; vertical-align: -2px; margin-right: 6px;
        }
        @media (prefers-reduced-motion: reduce) {
          .pf-spinner, .pf-player * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
        }
      `}</style>

      {/* HEADER: BACK + SETTINGS */}
      <div style={headerRow}>
        <button className="pf-back-btn" style={backBtn} onClick={() => navigate(-1)}>
          ← Back
        </button>
        <button style={gearBtn} onClick={() => setShowSettings(true)} aria-label="Player settings" title="Player settings">
          ⚙
        </button>
      </div>

      <div style={card}>
        {/* ARTWORK / LOGO */}
        <div style={artworkRing}>
          <div style={artworkInner}>
            <img src="/icons/icon-512.png" style={artworkImg} alt="Palouse Fellowship" />
          </div>
        </div>

        {/* TITLE BLOCK */}
        <div style={titleBlock}>
          <p style={nowPlayingLabel}>
            {isLoading ? <><span className="pf-spinner" aria-hidden="true" />Loading…</> : isPlaying ? "Now Playing" : "Paused"}
          </p>
          <h2 style={title}>{current.title}</h2>
          <p style={speaker}>{current.speaker}</p>
        </div>

        {playError && (
          <div style={errorBanner} role="alert">
            <span>⚠ {playError}</span>
            <button style={retryBtn} onClick={retryPlayback}>Tap to retry</button>
          </div>
        )}

        {/* SEEK BAR */}
        <div style={seekWrapper}>
          <div style={seekTrackOuter}>
            <div style={{ ...seekFill, width: `${progressPercent}%` }} />
            <input
              type="range"
              min="0"
              max={duration || 0}
              step="1"
              value={progress}
              onMouseDown={() => setIsDragging(true)}
              onTouchStart={() => setIsDragging(true)}
              onChange={handleSeek}
              onMouseUp={commitSeek}
              onTouchEnd={commitSeek}
              style={seekInput}
              aria-label="Seek"
            />
          </div>
          <div style={timeRow}>
            <span style={timeLabel}>{format(progress)}</span>
            <span
              style={{ ...timeLabel, cursor: "pointer" }}
              onClick={() => setShowRemaining(!showRemaining)}
              title="Tap to toggle remaining time"
            >
              {showRemaining ? `-${format(remaining)}` : format(duration)}
            </span>
          </div>
        </div>

        {/* MAIN CONTROLS */}
        <div style={controls}>
          <button style={trackBtn} onClick={playPrevious} title="Previous track (restarts if you're a few seconds in)" aria-label="Previous track">
            ⏮
          </button>

          <button className="pf-skip-btn" onClick={jumpBack} style={skipBtn} title={`Back ${settings.skipBack}s`}>
            <img src={back30} style={skipIcon} alt={`Back ${settings.skipBack} seconds`} />
            <span style={skipLabel}>{settings.skipBack}</span>
          </button>

          <button className="pf-play-btn" onClick={togglePlay} style={playBtn} aria-label={isPlaying ? "Pause" : "Play"}>
            {isLoading && !isPlaying ? <span className="pf-spinner" style={{ width: "22px", height: "22px", margin: 0 }} aria-hidden="true" /> : <span style={playSymbol}>{isPlaying ? "❚❚" : "▶"}</span>}
          </button>

          <button className="pf-skip-btn" onClick={jumpForward} style={skipBtn} title={`Forward ${settings.skipForward}s`}>
            <img src={forward30} style={skipIcon} alt={`Forward ${settings.skipForward} seconds`} />
            <span style={skipLabel}>{settings.skipForward}</span>
          </button>

          <button style={{ ...trackBtn, opacity: queue.length > 0 || settings.repeat === "queue" ? 1 : 0.35 }} onClick={() => advance(false)} disabled={queue.length === 0 && settings.repeat !== "queue"} title="Next in queue" aria-label="Next track">
            ⏭
          </button>
        </div>

        {/* VOLUME */}
        <div style={volumeRow}>
          <button style={muteBtn} onClick={() => updateSettings({ muted: !settings.muted })} aria-pressed={settings.muted} aria-label={settings.muted ? "Unmute" : "Mute"} title={settings.muted ? "Unmute" : "Mute"}>
            {settings.muted || settings.volume === 0 ? "🔇" : settings.volume < 0.5 ? "🔉" : "🔊"}
          </button>
          <input
            type="range" min="0" max="1" step="0.01"
            value={settings.muted ? 0 : settings.volume}
            onChange={(e) => updateSettings({ volume: Number(e.target.value), muted: false })}
            style={{ flex: 1 }}
            aria-label="Volume"
          />
        </div>

        {/* SPEED + SHARE */}
        <div style={bottomRow}>
          <div style={speedRow}>
            <span style={speedLabel}>Speed</span>
            {[0.75, 1, 1.25, 1.5, 2].map((s) => (
              <button
                key={s}
                className="pf-speed-btn"
                onClick={() => changeSpeed(s)}
                style={speed === s ? { ...speedBtn, ...speedBtnActive } : speedBtn}
              >
                {s}x
              </button>
            ))}
          </div>

          <div style={shareGroup}>
            <button style={shareBtn} onClick={handleCopyLink}>
              {linkCopied ? "✓ Copied" : "🔗 Copy Link"}
            </button>
            {typeof navigator !== "undefined" && navigator.share && (
              <button className="pf-share-btn" style={shareBtn} onClick={handleShare}>
                ↑ Share
              </button>
            )}
          </div>
        </div>

        {/* TIMESTAMP TOOLS */}
        <div style={stampRow}>
          <button style={extraBtn} onClick={addBookmark}>🔖 Bookmark {format(progress)}</button>
          <button style={extraBtn} onClick={copyTimestamp}>{timeCopied ? "✓ Copied" : `⧉ Copy ${format(progress)}`}</button>
          <button style={extraBtn} onClick={shareTimestamp}>↑ Share at {format(progress)}</button>
        </div>
        {flashMsg && <p style={flashText} role="status">{flashMsg}</p>}

        {/* EXTRAS: QUEUE / SLEEP TIMER / OUTPUT / MINI PLAYER */}
        <div style={extrasRow}>
          <button style={extraBtn} onClick={startFromBeginning}>
            ⟲ Start from Beginning
          </button>

          <button style={extraBtn} onClick={() => setShowQueue(true)}>
            📋 Playing Next{queue.length > 0 ? ` (${queue.length})` : ""}
          </button>

          <button style={extraBtn} onClick={() => setShowSleepMenu(true)}>
            🌙 {sleepTimerMode === "duration"
              ? formatSleepRemaining(sleepTimerRemaining)
              : sleepTimerMode === "endOfTrack"
              ? "End of track"
              : "Sleep Timer"}
          </button>

          {outputDeviceSupported && (
            <button style={extraBtn} onClick={handleConnectDevice}>
              🔊 Connect to Device
            </button>
          )}

          {pip.supported && (
            <button style={pip.active ? { ...extraBtn, ...extraBtnActive } : extraBtn} onClick={toggleMiniPlayer}>
              🗔 {pip.active ? "Close Mini Player" : "Mini Player"}
            </button>
          )}

          {auth.currentUser && (
            <button style={extraBtn} onClick={() => setShowNotes(true)}>
              📝 {noteText ? "Notes" : "Take Notes"}
            </button>
          )}
        </div>

        {deviceStatus && <p style={deviceStatusText}>{deviceStatus}</p>}
      </div>

      <div style={sectionsWrap}>
        <Collapsible title={`🔖 Bookmarks${bookmarks.length ? ` (${bookmarks.length})` : ""}`} open={settings.sections.bookmarks} onToggle={() => toggleSection("bookmarks")}>
          {bookmarks.length === 0 ? (
            <p style={mutedText}>{auth.currentUser ? "No bookmarks yet — tap Bookmark while listening." : "Sign in to save bookmarks."}</p>
          ) : (
            bookmarks.map((b) => (
              <div key={b.id} style={bookmarkRow}>
                <button style={bookmarkTime} onClick={() => jumpToBookmark(b.t)} title="Jump to this moment">{format(b.t)}</button>
                <input style={bookmarkInput} defaultValue={b.label} placeholder="Add a label" onBlur={(e) => e.target.value !== b.label && relabelBookmark(b.id, e.target.value)} aria-label={`Label for bookmark at ${format(b.t)}`} />
                <button style={queueRemoveBtn} onClick={() => removeBookmark(b.id)} aria-label="Delete bookmark">✕</button>
              </div>
            ))
          )}
        </Collapsible>

        <Collapsible title="🕘 Recently Played" open={settings.sections.recent} onToggle={() => toggleSection("recent")}>
          {history.filter((h) => h.id !== current.id).length === 0 ? (
            <p style={mutedText}>Nothing else yet.</p>
          ) : (
            history.filter((h) => h.id !== current.id).slice(0, 6).map((h) => (
              <button key={h.id} style={recentRow} onClick={() => playSermon(h, { fromHistory: false })}>
                <span style={queueItemTitle}>{h.title}</span>
                <span style={queueItemSpeaker}>{h.speaker}</span>
              </button>
            ))
          )}
        </Collapsible>

        <Collapsible title="✨ Related" open={settings.sections.related} onToggle={() => toggleSection("related")}>
          <RelatedAudio current={current} />
        </Collapsible>
      </div>

      {/* PLAYING NEXT SHEET */}
      {showQueue && (
        <QueueSheet
          onClose={() => setShowQueue(false)}
          styles={{ backdrop, sheet, sheetHeader, sheetTitle, sheetLinkBtn, sheetEmptyText, sheetCloseBtn, queueList, queueRow, queueItemBtn, queueItemTitle, queueItemSpeaker, queueRemoveBtn }}
        />
      )}

      {/* PLAYER SETTINGS */}
      {showSettings && <PlayerSettings onClose={() => setShowSettings(false)} />}

      {/* SLEEP TIMER SHEET */}
      {showSleepMenu && (
        <>
          <div style={backdrop} onClick={() => setShowSleepMenu(false)} />
          <div style={sheet}>
            <h3 style={sheetTitle}>Sleep Timer</h3>
            <div style={sleepGrid}>
              {SLEEP_PRESETS.map((m) => (
                <button
                  key={m}
                  style={sleepTimerMode === "duration" && selectedSleepPreset === m ? { ...sleepBtn, ...sleepBtnActive } : sleepBtn}
                  onClick={() => { setSleepTimer(m); setSelectedSleepPreset(m); setShowSleepMenu(false); }}
                >
                  {m} min
                </button>
              ))}
              <button
                style={sleepTimerMode === "endOfTrack" ? { ...sleepBtn, ...sleepBtnActive } : sleepBtn}
                onClick={() => { setSleepTimer("endOfTrack"); setSelectedSleepPreset(null); setShowSleepMenu(false); }}
              >
                End of track
              </button>
            </div>
            <button style={sheetLinkBtn} onClick={() => { setSleepTimer(null); setSelectedSleepPreset(null); setShowSleepMenu(false); }}>
              Turn Off
            </button>
            <button style={sheetCloseBtn} onClick={() => setShowSleepMenu(false)}>Close</button>
          </div>
        </>
      )}

      {/* NOTES SHEET */}
      {showNotes && (
        <>
          <div style={backdrop} onClick={() => setShowNotes(false)} />
          <div style={sheet}>
            <div style={sheetHeader}>
              <h3 style={sheetTitle}>Notes</h3>
              {noteStatus && <span style={noteStatusText}>{noteStatus}</span>}
            </div>
            <textarea
              autoFocus
              value={noteText}
              onChange={handleNoteChange}
              placeholder="Jot down anything that stands out while you listen…"
              style={noteTextarea}
            />
            <button style={sheetCloseBtn} onClick={() => setShowNotes(false)}>Close</button>
          </div>
        </>
      )}

      <DesktopMiniPlayerContent pipWindow={pip.pipWindow} />
    </div>
  );
}

function Collapsible({ title, open, onToggle, children }) {
  return (
    <div style={collapsible}>
      <button style={collapsibleHead} onClick={onToggle} aria-expanded={open}>
        <span>{title}</span>
        <span style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▾</span>
      </button>
      {open && <div style={collapsibleBody}>{children}</div>}
    </div>
  );
}

//////////////////////////////////////////////////
// STYLES
//////////////////////////////////////////////////

const page = {
  minHeight: "100vh",
  background: "#fdf8f3",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "20px 24px 60px",
  fontFamily: "'Georgia', serif",
  position: "relative",
};

const backBtn = {
  alignSelf: "flex-start",
  background: "none",
  border: "none",
  color: "#9b7040",
  fontFamily: "sans-serif",
  fontSize: "14px",
  cursor: "pointer",
  padding: "4px 0",
  marginBottom: "20px",
  transition: "color 0.15s ease",
};

// Card
const card = {
  width: "100%",
  maxWidth: "480px",
  background: "#fffdf9",
  border: "1px solid #f1e4cc",
  borderRadius: "24px",
  padding: "32px 28px 28px",
  boxShadow: "0 16px 46px rgba(160,80,20,0.10)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

// Artwork
const artworkRing = {
  width: "190px",
  height: "190px",
  borderRadius: "50%",
  background: "linear-gradient(135deg, #e08930 0%, #a85e18 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 8px 32px rgba(160,80,20,0.30)",
  marginBottom: "28px",
};

const artworkInner = {
  width: "162px",
  height: "162px",
  borderRadius: "50%",
  background: "#fffdf9",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
};

const artworkImg = {
  width: "110px",
  height: "110px",
  objectFit: "contain",
};

// Title
const titleBlock = {
  textAlign: "center",
  marginBottom: "28px",
  width: "100%",
};

const nowPlayingLabel = {
  fontSize: "10px",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "#c97c2e",
  fontFamily: "sans-serif",
  margin: "0 0 6px",
};

const title = {
  fontSize: "clamp(18px, 4vw, 24px)",
  fontWeight: "normal",
  color: "#3d2200",
  margin: "0 0 6px",
  lineHeight: 1.3,
};

const speaker = {
  color: "#9b7040",
  fontSize: "14px",
  fontFamily: "sans-serif",
  margin: 0,
};

// Seek bar
const seekWrapper = {
  width: "100%",
  marginBottom: "32px",
};

const seekTrackOuter = {
  position: "relative",
  height: "6px",
  background: "#eddfc8",
  borderRadius: "999px",
  marginBottom: "10px",
};

const seekFill = {
  position: "absolute",
  top: 0,
  left: 0,
  height: "100%",
  background: "linear-gradient(to right, #e08930, #c97c2e)",
  borderRadius: "999px",
  pointerEvents: "none",
  transition: "width 0.1s linear",
};

const seekInput = {
  position: "absolute",
  top: "50%",
  left: 0,
  transform: "translateY(-50%)",
  width: "100%",
  height: "22px",
  opacity: 1,
  background: "transparent",
  cursor: "pointer",
  margin: 0,
  WebkitAppearance: "none",
  appearance: "none",
};

const timeRow = {
  display: "flex",
  justifyContent: "space-between",
};

const timeLabel = {
  fontSize: "12px",
  color: "#b08050",
  fontFamily: "sans-serif",
  fontVariantNumeric: "tabular-nums",
};

// Controls
const controls = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "32px",
  marginBottom: "36px",
};

const skipBtn = {
  background: "none",
  border: "none",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "3px",
  padding: "4px",
};

const skipIcon = {
  width: "30px",
  opacity: 0.7,
  filter: "sepia(1) saturate(2) hue-rotate(10deg) brightness(0.6)",
  transition: "transform 0.15s ease, opacity 0.15s ease",
};

const skipLabel = {
  fontSize: "9px",
  fontFamily: "sans-serif",
  color: "#b08050",
  letterSpacing: "0.06em",
};

const playBtn = {
  width: "82px",
  height: "82px",
  borderRadius: "50%",
  border: "none",
  background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)",
  color: "#fff8ee",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: "0 6px 24px rgba(160,80,20,0.38)",
  transition: "transform 0.15s ease, box-shadow 0.15s ease",
};

const playSymbol = {
  fontSize: "26px",
  lineHeight: 1,
  marginLeft: "3px",
};

// Speed + share
const bottomRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  width: "100%",
  flexWrap: "wrap",
  gap: "12px",
};

const speedRow = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  background: "#fdf1e2",
  padding: "5px",
  borderRadius: "999px",
};

const speedLabel = {
  fontSize: "11px",
  fontFamily: "sans-serif",
  color: "#b08050",
  margin: "0 4px 0 6px",
  letterSpacing: "0.06em",
};

const speedBtn = {
  padding: "6px 10px",
  borderRadius: "999px",
  border: "1px solid transparent",
  background: "transparent",
  color: "#7a4f10",
  cursor: "pointer",
  fontSize: "12px",
  fontFamily: "sans-serif",
  transition: "border-color 0.15s ease",
};

const speedBtnActive = {
  background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)",
  border: "1px solid transparent",
  color: "#fff8ee",
  boxShadow: "0 2px 8px rgba(160,80,20,0.28)",
};

const shareBtn = {
  padding: "8px 18px",
  borderRadius: "999px",
  border: "1px solid #c8922a",
  background: "transparent",
  color: "#7a4f10",
  cursor: "pointer",
  fontSize: "13px",
  fontFamily: "sans-serif",
  transition: "background 0.15s ease",
};

const shareGroup = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

// Extras row (queue / sleep timer / device / mini player)
const extrasRow = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  justifyContent: "center",
  marginTop: "22px",
  paddingTop: "20px",
  borderTop: "1px solid #f0e4d0",
  width: "100%",
};

const extraBtn = {
  padding: "8px 14px",
  borderRadius: "999px",
  border: "1px solid #eddfc8",
  background: "#fdf8f3",
  color: "#7a4f10",
  cursor: "pointer",
  fontSize: "12px",
  fontFamily: "sans-serif",
};

const extraBtnActive = {
  background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)",
  color: "#fff8ee",
  borderColor: "transparent",
};

const deviceStatusText = {
  fontSize: "12px",
  color: "#9b7040",
  fontFamily: "sans-serif",
  textAlign: "center",
  marginTop: "10px",
};

// Bottom sheets (Playing Next / Sleep Timer)
const backdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(40,18,0,0.45)",
  zIndex: 1999,
};

const sheet = {
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  background: "#fffdf9",
  borderTopLeftRadius: "22px",
  borderTopRightRadius: "22px",
  padding: "20px 22px calc(28px + env(safe-area-inset-bottom))",
  zIndex: 2000,
  boxShadow: "0 -8px 30px rgba(80,35,0,0.18)",
  boxSizing: "border-box",
  maxHeight: "70vh",
  overflowY: "auto",
};

const sheetHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "14px",
};

const sheetTitle = {
  fontSize: "17px",
  fontWeight: "normal",
  color: "#3d2200",
  fontFamily: "'Georgia', serif",
  margin: "0 0 14px",
};

const sheetLinkBtn = {
  background: "none",
  border: "none",
  color: "#c97c2e",
  fontFamily: "sans-serif",
  fontSize: "13px",
  cursor: "pointer",
  padding: "4px",
};

const noteTextarea = {
  width: "100%",
  minHeight: "160px",
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #eddfc8",
  background: "#fdf8f3",
  color: "#3d2200",
  fontSize: "14px",
  fontFamily: "sans-serif",
  lineHeight: 1.6,
  resize: "vertical",
  outline: "none",
  boxSizing: "border-box",
  marginBottom: "12px",
};

const noteStatusText = {
  fontSize: "12px",
  color: "#16a34a",
  fontFamily: "sans-serif",
  fontWeight: "600",
};

const sheetEmptyText = {
  fontSize: "13px",
  color: "#b08050",
  fontStyle: "italic",
  fontFamily: "sans-serif",
  textAlign: "center",
  padding: "20px 0",
};

const sheetCloseBtn = {
  width: "100%",
  marginTop: "16px",
  padding: "13px",
  borderRadius: "12px",
  border: "1px solid #eddfc8",
  background: "transparent",
  color: "#9b7040",
  fontFamily: "sans-serif",
  fontSize: "14px",
  cursor: "pointer",
};

const queueList = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const queueRow = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  background: "#fdf8f3",
  border: "1px solid #f0e4d0",
  borderRadius: "12px",
  padding: "10px 12px",
};

const queueItemBtn = {
  flex: 1,
  textAlign: "left",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
  minWidth: 0,
};

const queueItemTitle = {
  fontSize: "13px",
  color: "#3d2200",
  fontFamily: "sans-serif",
  fontWeight: "600",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const queueItemSpeaker = {
  fontSize: "11px",
  color: "#9b7040",
  fontFamily: "sans-serif",
  marginTop: "2px",
};

const queueRemoveBtn = {
  background: "none",
  border: "none",
  color: "#b08050",
  cursor: "pointer",
  fontSize: "14px",
  padding: "4px 6px",
  flexShrink: 0,
};

const sleepGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "8px",
  marginBottom: "14px",
};

const sleepBtn = {
  padding: "12px 8px",
  borderRadius: "12px",
  border: "1px solid #eddfc8",
  background: "#fdf8f3",
  color: "#7a4f10",
  cursor: "pointer",
  fontSize: "13px",
  fontFamily: "sans-serif",
};

const sleepBtnActive = {
  background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)",
  color: "#fff8ee",
  borderColor: "transparent",
};

const headerRow = { width: "100%", maxWidth: "480px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" };
const gearBtn = { width: "44px", height: "44px", borderRadius: "50%", border: "1px solid #eddfc8", background: "#fffdf9", color: "#7a4f10", fontSize: "22px", lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", paddingBottom: "2px" };
const trackBtn = { width: "44px", height: "44px", borderRadius: "50%", border: "none", background: "transparent", color: "#7a4f10", fontSize: "20px", cursor: "pointer", flexShrink: 0 };
const volumeRow = { display: "flex", alignItems: "center", gap: "10px", width: "100%", margin: "4px 0 10px" };
const muteBtn = { width: "40px", height: "40px", borderRadius: "50%", border: "1px solid #eddfc8", background: "#fdf8f3", fontSize: "18px", cursor: "pointer", flexShrink: 0 };
const stampRow = { display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center", width: "100%", marginBottom: "8px" };
const flashText = { margin: "0 0 8px", fontSize: "12px", color: "#166534", fontFamily: "sans-serif", textAlign: "center" };
const errorBanner = { width: "100%", boxSizing: "border-box", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap", background: "#fff5f2", border: "1px solid #f3c8ba", color: "#a33622", borderRadius: "12px", padding: "10px 12px", fontSize: "13px", fontFamily: "sans-serif", marginBottom: "12px" };
const retryBtn = { padding: "8px 14px", borderRadius: "999px", border: "none", background: "#b3432c", color: "#fff", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer", fontWeight: "600" };
const sectionsWrap = { width: "100%", maxWidth: "480px", marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" };
const collapsible = { background: "#fffdf9", border: "1px solid #f1e4cc", borderRadius: "16px", overflow: "hidden" };
const collapsibleHead = { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "transparent", border: "none", fontSize: "14px", fontWeight: "600", color: "#5c3a1e", fontFamily: "sans-serif", cursor: "pointer" };
const collapsibleBody = { padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: "8px" };
const mutedText = { margin: 0, fontSize: "13px", color: "#b08050", fontFamily: "sans-serif", fontStyle: "italic" };
const bookmarkRow = { display: "flex", alignItems: "center", gap: "8px" };
const bookmarkTime = { padding: "8px 12px", borderRadius: "999px", border: "none", background: "#fde8b8", color: "#7a4f10", fontSize: "13px", fontWeight: "600", fontFamily: "sans-serif", cursor: "pointer", flexShrink: 0 };
const bookmarkInput = { flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: "8px", border: "1px solid #eddfc8", background: "#fdf8f3", fontSize: "13px", fontFamily: "sans-serif", color: "#3d2200" };
const recentRow = { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2px", textAlign: "left", background: "#fdf8f3", border: "1px solid #f1e4cc", borderRadius: "10px", padding: "10px 12px", cursor: "pointer" };
