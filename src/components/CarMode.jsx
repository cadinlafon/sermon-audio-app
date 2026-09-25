import { useEffect, useState } from "react";
import { useAudioPlayer } from "../context/AudioPlayerContext";
import { SPEED_OPTIONS } from "../utils/playerSettings";
import { formatTime } from "../utils/notes";

// Minimal driving mode: high-contrast, giant touch targets, nothing to read
// while moving. Lays out side-by-side in landscape. Keeps the screen awake.
function useLandscape() {
  const query = "(orientation: landscape) and (max-height: 600px)";
  const [on, setOn] = useState(() => typeof window !== "undefined" && window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return undefined;
    const fn = () => setOn(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return on;
}

export default function CarMode({ onClose }) {
  const { current, isPlaying, togglePlay, currentTime, duration, seekTo, advance, playPrevious, queue, settings, updateSettings, isLoading, playError, retryPlayback } = useAudioPlayer();
  const landscape = useLandscape();

  useEffect(() => {
    let lock = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        if ("wakeLock" in navigator) {
          lock = await navigator.wakeLock.request("screen");
          if (cancelled) lock.release().catch(() => {});
        }
      } catch {
        // Not allowed (low battery, background tab) — fine.
      }
    };
    acquire();
    const onVisible = () => { if (document.visibilityState === "visible") acquire(); };
    document.addEventListener("visibilitychange", onVisible);
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("keydown", onKey);
      lock?.release().catch(() => {});
    };
  }, [onClose]);

  const skip = (delta) => seekTo(Math.max(0, Math.min(duration || Infinity, currentTime + delta)));
  const cycleSpeed = () => {
    const i = SPEED_OPTIONS.indexOf(settings.speed);
    updateSettings({ speed: SPEED_OPTIONS[(i + 1) % SPEED_OPTIONS.length] });
  };
  const hasNext = queue.length > 0 || settings.repeat === "queue";
  const pct = duration ? Math.min(100, (currentTime / duration) * 100) : 0;

  const ls = landscape
    ? { side: { width: "64px", height: "64px" }, play: { width: "96px", height: "96px", fontSize: "44px" } }
    : { side: {}, play: {} };

  const info = (
    <div style={{ ...infoBox, textAlign: landscape ? "left" : "center" }}>
      <div style={landscape ? { ...titleStyle, fontSize: "28px" } : titleStyle}>{current?.title || "Nothing playing"}</div>
      <div style={speaker}>{current?.speaker || ""}</div>
      <div style={{ ...barTrack, marginTop: "22px" }} aria-hidden="true"><div style={{ ...barFill, width: `${pct}%` }} /></div>
      <div style={times}><span>{formatTime(currentTime)}</span><span>-{formatTime(Math.max(0, (duration || 0) - currentTime))}</span></div>
    </div>
  );

  const controls = (
    <div style={{ ...controlsBox, width: landscape ? "auto" : "100%", flexShrink: 0 }}>
      {playError && <button style={errorBtn} onClick={retryPlayback}>⚠ {playError.slice(0, 70)} — tap to retry</button>}
      <div style={row}>
        <button style={{ ...sideBtn, ...ls.side }} onClick={() => playPrevious()} aria-label="Previous">⏮</button>
        <button style={{ ...sideBtn, ...ls.side }} onClick={() => skip(-settings.skipBack)} aria-label={`Back ${settings.skipBack} seconds`}>
          <span style={{ fontSize: "34px" }}>↺</span><span style={skipNum}>{settings.skipBack}</span>
        </button>
        <button style={{ ...playBtn, ...ls.play }} onClick={togglePlay} aria-label={isPlaying ? "Pause" : "Play"}>
          {isLoading && !isPlaying ? "…" : isPlaying ? "⏸" : "▶"}
        </button>
        <button style={{ ...sideBtn, ...ls.side }} onClick={() => skip(settings.skipForward)} aria-label={`Forward ${settings.skipForward} seconds`}>
          <span style={{ fontSize: "34px" }}>↻</span><span style={skipNum}>{settings.skipForward}</span>
        </button>
        <button style={{ ...sideBtn, ...ls.side, opacity: hasNext ? 1 : 0.35 }} onClick={() => hasNext && advance(false)} disabled={!hasNext} aria-label="Next">⏭</button>
      </div>
      <button style={speedBtn} onClick={cycleSpeed} aria-label="Change playback speed">{settings.speed}× speed</button>
    </div>
  );

  return (
    <div style={overlay} role="dialog" aria-modal="true" aria-label="Driving mode">
      <button style={exitBtn} onClick={onClose}>✕ Exit driving mode</button>
      <div style={{ ...body, flexDirection: landscape ? "row" : "column", gap: landscape ? "36px" : "32px" }}>
        <div style={{ flex: landscape ? "1 1 0" : "0 1 auto", minWidth: 0, width: landscape ? "auto" : "100%" }}>{info}</div>
        {controls}
      </div>
    </div>
  );
}

const overlay = { position: "fixed", inset: 0, zIndex: 4000, background: "#120b03", color: "#fff8ee", display: "flex", flexDirection: "column", padding: "calc(env(safe-area-inset-top, 0px) + 14px) calc(env(safe-area-inset-right, 0px) + 20px) calc(env(safe-area-inset-bottom, 0px) + 18px) calc(env(safe-area-inset-left, 0px) + 20px)", fontFamily: "sans-serif", overflowY: "auto" };
const exitBtn = { alignSelf: "flex-start", minHeight: "52px", padding: "0 22px", borderRadius: "999px", border: "2px solid #6b4a1c", background: "transparent", color: "#fde8b8", fontSize: "18px", cursor: "pointer" };
const body = { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", maxWidth: "980px", width: "100%", margin: "0 auto" };
const infoBox = { width: "100%" };
const titleStyle = { fontSize: "clamp(26px, 5.5vw, 44px)", lineHeight: 1.2, fontFamily: "'Georgia', serif", fontWeight: "bold", overflowWrap: "anywhere" };
const speaker = { fontSize: "clamp(18px, 3.5vw, 26px)", color: "#e5c27a", marginTop: "8px" };
const barTrack = { height: "12px", background: "#3a2810", borderRadius: "999px", overflow: "hidden" };
const barFill = { height: "100%", background: "#f0a848", borderRadius: "999px" };
const times = { display: "flex", justifyContent: "space-between", fontSize: "20px", color: "#e5c27a", marginTop: "10px" };
const controlsBox = { display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" };
const row = { display: "flex", alignItems: "center", justifyContent: "center", gap: "clamp(6px, 2vw, 20px)", flexWrap: "nowrap" };
const sideBtn = { width: "clamp(52px, 14vw, 96px)", height: "clamp(52px, 14vw, 96px)", borderRadius: "50%", border: "2px solid #6b4a1c", background: "#2a1c0a", color: "#fff8ee", fontSize: "clamp(24px, 6vw, 34px)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1, flexShrink: 0 };
const skipNum = { fontSize: "14px", marginTop: "2px", color: "#e5c27a" };
const playBtn = { width: "clamp(84px, 24vw, 140px)", height: "clamp(84px, 24vw, 140px)", borderRadius: "50%", border: "none", background: "linear-gradient(135deg, #f0a848, #c97c2e)", color: "#120b03", fontSize: "clamp(44px, 12vw, 64px)", cursor: "pointer", flexShrink: 0 };
const speedBtn = { minHeight: "56px", padding: "0 30px", borderRadius: "999px", border: "2px solid #6b4a1c", background: "#2a1c0a", color: "#fde8b8", fontSize: "20px", cursor: "pointer" };
const errorBtn = { width: "100%", minHeight: "56px", padding: "10px 16px", borderRadius: "16px", border: "2px solid #a33622", background: "#3a120a", color: "#ffd9cf", fontSize: "18px", cursor: "pointer" };
