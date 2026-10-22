import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAudioPlayer } from "../context/AudioPlayerContext";

import back30 from "../assets/Player/back30.png";

export default function MiniPlayer() {
  const { current, isPlaying, togglePlay, audioRef, duration, currentTime, settings, playError, retryPlayback, isLoading } = useAudioPlayer();
  const navigate = useNavigate();

  // Swipe up on the bar to open the full player (it slides up as a sheet —
  // see PlayerSheet.jsx). The bar lifts a little with your finger as feedback.
  const [lift, setLift] = useState(0);
  const touch = useRef(null);
  const swiped = useRef(false);

  const onTouchStart = (e) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, time: e.timeStamp };
    swiped.current = false;
  };
  const onTouchMove = (e) => {
    if (!touch.current) return;
    const t = e.touches[0];
    const dy = t.clientY - touch.current.y;
    const dx = t.clientX - touch.current.x;
    if (dy < 0 && Math.abs(dy) > Math.abs(dx)) setLift(Math.max(dy, -80));
  };
  const onTouchEnd = (e) => {
    const start = touch.current;
    touch.current = null;
    const dy = (e.changedTouches?.[0]?.clientY ?? start?.y ?? 0) - (start?.y ?? 0);
    const dx = (e.changedTouches?.[0]?.clientX ?? start?.x ?? 0) - (start?.x ?? 0);
    const fast = start && dy / Math.max(1, e.timeStamp - start.time) < -0.5;
    setLift(0);
    if (hasAudio && dy < -10 && Math.abs(dy) > Math.abs(dx) && (dy < -40 || fast)) {
      swiped.current = true; // the click that follows a swipe must not also fire
      navigate("/player");
    }
  };

  const hasAudio = !!current;
  const progressPercent = hasAudio && duration ? (currentTime / duration) * 100 : 0;

  const jumpBack = (e) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, audio.currentTime - settings.skipBack);
  };

  const handlePlay = (e) => {
    e.stopPropagation();
    togglePlay();
  };

  return (
    <div
      style={{
        ...(hasAudio ? container : { ...container, ...containerEmpty }),
        transform: lift ? `translateY(${lift}px)` : "none",
        transition: lift ? "none" : "transform 0.2s ease-out",
        touchAction: hasAudio ? "none" : undefined,
      }}
      onClick={() => {
        if (swiped.current) { swiped.current = false; return; }
        if (hasAudio) navigate("/player");
      }}
      onTouchStart={hasAudio ? onTouchStart : undefined}
      onTouchMove={hasAudio ? onTouchMove : undefined}
      onTouchEnd={hasAudio ? onTouchEnd : undefined}
      onTouchCancel={hasAudio ? () => { touch.current = null; setLift(0); } : undefined}
    >
      {hasAudio && (
        <div style={progressTrack}>
          <div style={{ ...progressFill, width: `${progressPercent}%` }} />
        </div>
      )}

      <div style={row}>
        <div style={textContainer}>
          {hasAudio ? (
            <>
              <div style={title}>{current.title}</div>
              {playError ? (
                <button style={retryLink} onClick={(e) => { e.stopPropagation(); retryPlayback(); }}>⚠ Couldn't play — tap to retry</button>
              ) : (
                <div style={speaker}>{isLoading ? "Loading…" : current.speaker}</div>
              )}
            </>
          ) : playError ? (
            <button style={retryLink} onClick={(e) => { e.stopPropagation(); retryPlayback(); }}>⚠ {playError}</button>
          ) : (
            <div style={emptyTitle}>{isLoading ? "Loading…" : "No audio playing"}</div>
          )}
        </div>

        {hasAudio && (
          <div style={controls}>
            <button onClick={jumpBack} style={iconBtn} title={`Back ${settings.skipBack}s`}>
              <img src={back30} style={iconImg} alt={`Back ${settings.skipBack} seconds`} />
            </button>

            <button onClick={handlePlay} style={playBtn}>
              <span style={playGlyph} aria-label={isPlaying ? "Pause" : "Play"}>
                {isPlaying ? "\u23F8\uFE0E" : "\u25B6\uFE0E"}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

//////////////////////////////////////////////////
// STYLES
//////////////////////////////////////////////////

const container = {
  width: "100%",
  background: "var(--color-fffdf9)",
  boxSizing: "border-box",
  cursor: "pointer",
  overflow: "hidden",
  position: "relative",
};

const containerEmpty = {
  cursor: "default",
  opacity: 0.6,
};

const progressTrack = {
  height: "3px",
  width: "100%",
  background: "var(--color-eddfc8)",
};

const progressFill = {
  height: "100%",
  background: "linear-gradient(to right, var(--color-e08930), var(--color-c97c2e))",
  transition: "width 0.2s linear",
};

const row = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 16px",
  gap: "12px",
};

const textContainer = {
  flex: 1,
  overflow: "hidden",
  minWidth: 0,
};

const title = {
  fontSize: "14px",
  fontWeight: "600",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  color: "var(--color-3d2200)",
  fontFamily: "'Georgia', serif",
  lineHeight: 1.3,
};

const speaker = {
  fontSize: "11px",
  color: "var(--color-9b7040)",
  fontFamily: "sans-serif",
  marginTop: "2px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const emptyTitle = {
  fontSize: "13px",
  color: "var(--color-b08050)",
  fontFamily: "sans-serif",
  fontStyle: "italic",
};

const controls = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexShrink: 0,
};

const iconBtn = {
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "4px",
  display: "flex",
  alignItems: "center",
};

const iconImg = {
  width: "20px",
  opacity: 0.7,
  filter: "sepia(1) saturate(2) hue-rotate(10deg) brightness(0.6)",
};

const playBtn = {
  background: "linear-gradient(135deg, var(--color-e08930) 0%, var(--color-c97c2e) 100%)",
  border: "none",
  borderRadius: "50%",
  width: "36px",
  height: "36px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: "0 2px 10px rgba(200,100,20,0.35)",
  flexShrink: 0,
};

const playGlyph = {
  color: "var(--color-ffffff)",
  fontSize: "22px",
  lineHeight: 1,
};

const retryLink = { background: "none", border: "none", padding: 0, textAlign: "left", color: "var(--color-b3432c)", fontSize: "11px", fontFamily: "sans-serif", cursor: "pointer", textDecoration: "underline" };
