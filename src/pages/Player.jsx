import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAudioPlayer } from "../context/AudioPlayerContext";

import back30 from "../assets/Player/back30.png";
import forward30 from "../assets/Player/forward30.png";

export default function Player() {
  const { current, isPlaying, togglePlay, audioRef } = useAudioPlayer();
  const navigate = useNavigate();

  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [showRemaining, setShowRemaining] = useState(false);

  //////////////////////////////////////////////////
  // AUDIO EVENTS
  //////////////////////////////////////////////////
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      if (!isDragging) setProgress(audio.currentTime);
    };
    const setMeta = () => setDuration(audio.duration || 0);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", setMeta);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", setMeta);
    };
  }, [audioRef, isDragging]);

  //////////////////////////////////////////////////
  // SEEK
  //////////////////////////////////////////////////
  const handleSeek = (e) => {
    const value = Number(e.target.value);
    setProgress(value);
  };

  const commitSeek = (e) => {
    const audio = audioRef.current;
    const value = Number(e.target.value);
    audio.currentTime = value;
    setProgress(value);
    setIsDragging(false);
  };

  //////////////////////////////////////////////////
  // SPEED
  //////////////////////////////////////////////////
  const changeSpeed = (val) => {
    const audio = audioRef.current;
    audio.playbackRate = val;
    setSpeed(val);
  };

  //////////////////////////////////////////////////
  // SKIP
  //////////////////////////////////////////////////
  const jumpBack = () => {
    const audio = audioRef.current;
    audio.currentTime = Math.max(0, audio.currentTime - 30);
  };

  const jumpForward = () => {
    const audio = audioRef.current;
    audio.currentTime = Math.min(duration, audio.currentTime + 30);
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

  if (!current) return null;

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
      `}</style>

      {/* BACK BUTTON */}
      <button className="pf-back-btn" style={backBtn} onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div style={card}>
        {/* ARTWORK / LOGO */}
        <div style={artworkRing}>
          <div style={artworkInner}>
            <img src="/icons/icon-512.png" style={artworkImg} alt="Palouse Fellowship" />
          </div>
        </div>

        {/* TITLE BLOCK */}
        <div style={titleBlock}>
          <p style={nowPlayingLabel}>{isPlaying ? "Now Playing" : "Paused"}</p>
          <h2 style={title}>{current.title}</h2>
          <p style={speaker}>{current.speaker}</p>
        </div>

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
          <button className="pf-skip-btn" onClick={jumpBack} style={skipBtn} title="Back 30s">
            <img src={back30} style={skipIcon} alt="Back 30 seconds" />
            <span style={skipLabel}>30</span>
          </button>

          <button className="pf-play-btn" onClick={togglePlay} style={playBtn}>
            <span style={playSymbol}>{isPlaying ? "❚❚" : "▶"}</span>
          </button>

          <button className="pf-skip-btn" onClick={jumpForward} style={skipBtn} title="Forward 30s">
            <img src={forward30} style={skipIcon} alt="Forward 30 seconds" />
            <span style={skipLabel}>30</span>
          </button>
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

          <button
            className="pf-share-btn"
            style={shareBtn}
            onClick={() =>
              navigator.share?.({
                title: current.title,
                text: current.speaker,
                url: window.location.href,
              })
            }
          >
            ↑ Share
          </button>
        </div>
      </div>
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
