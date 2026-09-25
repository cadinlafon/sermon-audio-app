import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAudioPlayer } from "../context/AudioPlayerContext";

const SHORTCUTS = [
  ["Space", "Play / pause"],
  ["← / →", "Skip back / forward"],
  ["↑ / ↓", "Volume up / down"],
  ["M", "Mute / unmute"],
  ["N / P", "Next / previous track"],
  ["[ / ]", "Slower / faster"],
  ["/", "Search"],
  ["?", "Show this help"],
  ["Esc", "Close dialogs"],
];

const typing = (el) => el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

// Global keyboard shortcuts + the "?" help popup. Ignored while typing.
export default function KeyboardShortcuts() {
  const navigate = useNavigate();
  const { togglePlay, current, audioRef, settings, updateSettings, advance, playPrevious } = useAudioPlayer();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") { setOpen(false); return; }
      if (typing(e.target)) return;
      const audio = audioRef.current;
      switch (e.key) {
        case "?": e.preventDefault(); setOpen((v) => !v); break;
        case "/": e.preventDefault(); navigate("/search"); break;
        case " ": if (current && !e.target.closest?.("button, a, [role='button']")) { e.preventDefault(); togglePlay(); } break;
        case "ArrowLeft": if (current && audio) { e.preventDefault(); audio.currentTime = Math.max(0, audio.currentTime - settings.skipBack); } break;
        case "ArrowRight": if (current && audio) { e.preventDefault(); audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + settings.skipForward); } break;
        case "ArrowUp": if (current) { e.preventDefault(); updateSettings({ volume: Math.min(1, settings.volume + 0.1), muted: false }); } break;
        case "ArrowDown": if (current) { e.preventDefault(); updateSettings({ volume: Math.max(0, settings.volume - 0.1) }); } break;
        case "m": case "M": if (current) updateSettings({ muted: !settings.muted }); break;
        case "n": case "N": if (current) advance(false); break;
        case "p": case "P": if (current) playPrevious(); break;
        case "]": updateSettings({ speed: Math.min(3, Math.round((settings.speed + 0.25) * 100) / 100) }); break;
        case "[": updateSettings({ speed: Math.max(0.5, Math.round((settings.speed - 0.25) * 100) / 100) }); break;
        default:
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, togglePlay, current, audioRef, settings, updateSettings, advance, playPrevious]);

  if (!open) return null;
  return (
    <div style={backdrop} onClick={() => setOpen(false)}>
      <div style={card} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={(e) => e.stopPropagation()}>
        <h2 style={title}>Keyboard shortcuts</h2>
        <dl style={list}>
          {SHORTCUTS.map(([k, d]) => (
            <div key={k} style={row}><dt><kbd style={kbd}>{k}</kbd></dt><dd style={desc}>{d}</dd></div>
          ))}
        </dl>
        <button style={close} onClick={() => setOpen(false)} autoFocus>Close</button>
      </div>
    </div>
  );
}

const backdrop = { position: "fixed", inset: 0, background: "rgba(40,18,0,0.5)", zIndex: 7000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" };
const card = { background: "#fffdf9", borderRadius: "18px", padding: "24px", width: "100%", maxWidth: "400px", border: "1px solid #eddfc8", fontFamily: "sans-serif" };
const title = { margin: "0 0 14px", fontSize: "19px", fontWeight: "normal", color: "#3d2200", fontFamily: "'Georgia', serif" };
const list = { margin: 0, display: "flex", flexDirection: "column", gap: "8px" };
const row = { display: "flex", alignItems: "center", gap: "12px" };
const kbd = { display: "inline-block", minWidth: "52px", textAlign: "center", padding: "4px 8px", borderRadius: "6px", border: "1px solid #eddfc8", background: "#fdf8f3", color: "#5c3a1e", fontSize: "12px", fontFamily: "monospace" };
const desc = { margin: 0, fontSize: "13px", color: "#7a5530" };
const close = { marginTop: "18px", width: "100%", padding: "11px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", fontSize: "14px", cursor: "pointer" };
