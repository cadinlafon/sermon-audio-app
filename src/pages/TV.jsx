import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAudioPlayer } from "../context/AudioPlayerContext";
import { formatTime } from "../utils/notes";

// Big-screen player: huge type, high contrast, and every control is a focus
// target so a TV remote's D-pad + OK works. Space/Enter play-pause, arrows seek.
export default function TV() {
  const { current, isPlaying, togglePlay, currentTime, duration, seekTo, playSermon, queue, advance, playPrevious, settings, isLoading, playError, retryPlayback } = useAudioPlayer();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const startedFor = useRef(null);
  const playRef = useRef(null);

  useEffect(() => {
    const id = params.get("a");
    if (!id || startedFor.current === id) return;
    startedFor.current = id;
    (async () => {
      if (current?.id === id) return;
      setStatus("Loading…");
      try {
        const snap = await getDoc(doc(db, "audio", id));
        if (!snap.exists()) { setStatus("That recording couldn't be found."); return; }
        const t = Number(params.get("t")) || 0;
        await playSermon({ id: snap.id, ...snap.data() }, t > 0 ? { resumeAt: t } : {});
        setStatus("");
      } catch {
        setStatus("Couldn't load that recording. Check the connection and try again.");
      }
    })();
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { playRef.current?.focus(); }, [current?.id]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowLeft") seekTo(Math.max(0, currentTime - settings.skipBack));
      else if (e.key === "ArrowRight") seekTo(currentTime + settings.skipForward);
      else if (e.key === "MediaPlayPause") togglePlay();
      else if (e.key === "MediaTrackNext") advance(false);
      else if (e.key === "MediaTrackPrevious") playPrevious();
      else if (e.key === "Escape" || e.key === "Backspace") navigate(-1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentTime, settings.skipBack, settings.skipForward, seekTo, togglePlay, advance, playPrevious, navigate]);

  const pct = duration ? Math.min(100, (currentTime / duration) * 100) : 0;
  const upNext = queue.slice(0, 3);

  return (
    <div style={page}>
      <style>{`.pf-tv button:focus-visible { outline: 6px solid #fde8b8 !important; outline-offset: 6px; transform: scale(1.06); }`}</style>
      <div className="pf-tv" style={inner}>
        <div style={brand}>Palouse Fellowship</div>
        {!current ? (
          <div style={idle}>
            <div style={{ fontSize: "96px" }}>📺</div>
            <div style={bigTitle}>{status || "Nothing playing yet"}</div>
            <div style={sub}>Start a recording on your phone and choose “Play on TV”, or pick something from the app.</div>
            <button style={{ ...ctrl, width: "auto", padding: "0 44px", borderRadius: "999px", fontSize: "30px" }} onClick={() => navigate("/sermons")}>Browse recordings</button>
          </div>
        ) : (
          <>
            <div style={now}>Now playing</div>
            <div style={bigTitle}>{current.title}</div>
            <div style={sub}>{[current.speaker, current.date].filter(Boolean).join("  ·  ")}</div>

            <div style={track}><div style={{ ...fill, width: `${pct}%` }} /></div>
            <div style={times}><span>{formatTime(currentTime)}</span><span>-{formatTime(Math.max(0, (duration || 0) - currentTime))}</span></div>

            <div style={controls}>
              <button style={ctrl} onClick={() => playPrevious()} aria-label="Previous">⏮</button>
              <button style={ctrl} onClick={() => seekTo(Math.max(0, currentTime - settings.skipBack))} aria-label="Back">↺ {settings.skipBack}</button>
              <button ref={playRef} style={{ ...ctrl, ...playCtrl }} onClick={togglePlay} aria-label={isPlaying ? "Pause" : "Play"}>{isLoading && !isPlaying ? "…" : isPlaying ? "⏸" : "▶"}</button>
              <button style={ctrl} onClick={() => seekTo(currentTime + settings.skipForward)} aria-label="Forward">{settings.skipForward} ↻</button>
              <button style={{ ...ctrl, opacity: queue.length ? 1 : 0.4 }} onClick={() => queue.length && advance(false)} aria-label="Next">⏭</button>
            </div>
            {playError && <button style={errorBtn} onClick={retryPlayback}>⚠ {playError} — press OK to retry</button>}
            {upNext.length > 0 && (
              <div style={upNextBox}>
                <div style={now}>Up next</div>
                {upNext.map((q) => <div key={q.id} style={upNextRow}>{q.title}{q.speaker ? ` — ${q.speaker}` : ""}</div>)}
              </div>
            )}
          </>
        )}
        <button style={exit} onClick={() => navigate(-1)}>Exit TV mode</button>
      </div>
    </div>
  );
}

const page = { position: "fixed", inset: 0, zIndex: 3100, overflowY: "auto", background: "radial-gradient(circle at 20% 10%, #4a2a08, #120b03 70%)", color: "#fff8ee", fontFamily: "sans-serif" };
const inner = { maxWidth: "1400px", margin: "0 auto", padding: "5vh 6vw", minHeight: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: "2.2vh" };
const brand = { fontSize: "clamp(16px, 2vw, 28px)", letterSpacing: "0.2em", textTransform: "uppercase", color: "#e5c27a" };
const now = { fontSize: "clamp(16px, 2vw, 26px)", letterSpacing: "0.12em", textTransform: "uppercase", color: "#e5c27a" };
const bigTitle = { fontSize: "clamp(34px, 6vw, 88px)", lineHeight: 1.1, fontFamily: "'Georgia', serif", fontWeight: "bold" };
const sub = { fontSize: "clamp(18px, 2.6vw, 38px)", color: "#e5c27a" };
const track = { height: "clamp(10px, 1.4vw, 20px)", background: "#3a2810", borderRadius: "999px", overflow: "hidden", marginTop: "2vh" };
const fill = { height: "100%", background: "#f0a848" };
const times = { display: "flex", justifyContent: "space-between", fontSize: "clamp(18px, 2.4vw, 34px)", color: "#e5c27a" };
const controls = { display: "flex", gap: "2vw", alignItems: "center", justifyContent: "center", marginTop: "2vh", flexWrap: "wrap" };
const ctrl = { minWidth: "clamp(72px, 9vw, 140px)", height: "clamp(72px, 9vw, 140px)", borderRadius: "999px", border: "3px solid #6b4a1c", background: "#2a1c0a", color: "#fff8ee", fontSize: "clamp(26px, 3.4vw, 50px)", cursor: "pointer", padding: "0 20px" };
const playCtrl = { minWidth: "clamp(110px, 14vw, 210px)", height: "clamp(110px, 14vw, 210px)", background: "linear-gradient(135deg, #f0a848, #c97c2e)", color: "#120b03", border: "none", fontSize: "clamp(48px, 6vw, 90px)" };
const errorBtn = { padding: "16px 24px", borderRadius: "16px", border: "3px solid #a33622", background: "#3a120a", color: "#ffd9cf", fontSize: "clamp(18px, 2.2vw, 30px)", cursor: "pointer" };
const upNextBox = { marginTop: "2vh", padding: "18px 24px", background: "rgba(255,255,255,0.06)", borderRadius: "18px" };
const upNextRow = { fontSize: "clamp(18px, 2.2vw, 32px)", padding: "6px 0", color: "#fff8ee" };
const idle = { display: "flex", flexDirection: "column", alignItems: "center", gap: "24px", textAlign: "center" };
const exit = { alignSelf: "flex-start", marginTop: "2vh", padding: "14px 26px", borderRadius: "999px", border: "2px solid #6b4a1c", background: "transparent", color: "#fde8b8", fontSize: "clamp(16px, 1.8vw, 24px)", cursor: "pointer" };
