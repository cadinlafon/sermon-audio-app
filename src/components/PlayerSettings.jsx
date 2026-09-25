import { useEffect } from "react";
import { useAudioPlayer } from "../context/AudioPlayerContext";
import { DEFAULT_SETTINGS, REPEAT_MODES, SKIP_OPTIONS, SPEED_OPTIONS } from "../utils/playerSettings";

const REPEAT_LABELS = { off: "Off", track: "Repeat track", queue: "Repeat queue" };
const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

// Full-screen page that opens over the player. Everything saves instantly and
// is remembered on this device.
export default function PlayerSettings({ onClose }) {
  const { settings, updateSettings } = useAudioPlayer();

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const reset = () => updateSettings({
    skipBack: DEFAULT_SETTINGS.skipBack, skipForward: DEFAULT_SETTINGS.skipForward, speed: DEFAULT_SETTINGS.speed,
    volume: DEFAULT_SETTINGS.volume, muted: DEFAULT_SETTINGS.muted, repeat: DEFAULT_SETTINGS.repeat, shuffle: DEFAULT_SETTINGS.shuffle,
  });

  const Chips = ({ options, value, onPick, format = (o) => o }) => (
    <div style={chipRow} role="radiogroup">
      {options.map((o) => (
        <button key={o} role="radio" aria-checked={value === o} style={value === o ? { ...chip, ...chipOn } : chip} onClick={() => onPick(o)}>
          {format(o)}
        </button>
      ))}
    </div>
  );

  return (
    <div style={overlay} role="dialog" aria-modal="true" aria-label="Player settings">
      <div style={panel}>
        <div style={header}>
          <h2 style={title}>Player Settings</h2>
          <button style={closeBtn} onClick={onClose} aria-label="Close settings">✕</button>
        </div>

        <section style={section}>
          <h3 style={sectionTitle}>Skip back</h3>
          <p style={hint}>How far the back button jumps.</p>
          <Chips options={SKIP_OPTIONS} value={settings.skipBack} onPick={(v) => updateSettings({ skipBack: v })} format={(o) => `${o}s`} />
        </section>

        <section style={section}>
          <h3 style={sectionTitle}>Skip forward</h3>
          <p style={hint}>How far the forward button jumps.</p>
          <Chips options={SKIP_OPTIONS} value={settings.skipForward} onPick={(v) => updateSettings({ skipForward: v })} format={(o) => `${o}s`} />
        </section>

        <section style={section}>
          <h3 style={sectionTitle}>Playback speed</h3>
          <p style={hint}>Remembered — every recording starts at this speed.</p>
          <Chips options={SPEED_OPTIONS} value={settings.speed} onPick={(v) => updateSettings({ speed: v })} format={(o) => `${o}×`} />
        </section>

        <section style={section}>
          <h3 style={sectionTitle}>Volume</h3>
          <div style={volumeRow}>
            <button style={muteBtn} onClick={() => updateSettings({ muted: !settings.muted })} aria-pressed={settings.muted}>
              {settings.muted || settings.volume === 0 ? "🔇" : "🔊"}
            </button>
            <input
              type="range" min="0" max="1" step="0.01"
              value={settings.muted ? 0 : settings.volume}
              onChange={(e) => updateSettings({ volume: Number(e.target.value), muted: false })}
              style={{ flex: 1 }}
              aria-label="Volume"
            />
            <span style={volumeValue}>{settings.muted ? "Muted" : `${Math.round(settings.volume * 100)}%`}</span>
          </div>
          {isIOS && <p style={hint}>iPhone and iPad control volume with the side buttons — this slider has no effect there.</p>}
        </section>

        <section style={section}>
          <h3 style={sectionTitle}>Repeat</h3>
          <Chips options={REPEAT_MODES} value={settings.repeat} onPick={(v) => updateSettings({ repeat: v })} format={(o) => REPEAT_LABELS[o]} />
        </section>

        <section style={section}>
          <label style={toggleRow}>
            <span>
              <span style={sectionTitle}>Shuffle queue</span>
              <span style={hint}>Play the queue in random order.</span>
            </span>
            <input type="checkbox" checked={settings.shuffle} onChange={(e) => updateSettings({ shuffle: e.target.checked })} style={{ width: "20px", height: "20px" }} />
          </label>
        </section>

        <div style={footer}>
          <button style={resetBtn} onClick={reset}>Reset to defaults</button>
          <button style={doneBtn} onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

const overlay = { position: "fixed", inset: 0, zIndex: 3500, background: "#fdf8f3", overflowY: "auto", display: "flex", justifyContent: "center", padding: "0 0 env(safe-area-inset-bottom, 0px)" };
const panel = { width: "100%", maxWidth: "520px", padding: "calc(env(safe-area-inset-top, 0px) + 16px) 22px 32px", fontFamily: "sans-serif" };
const header = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" };
const title = { margin: 0, fontSize: "22px", fontWeight: "normal", color: "#3d2200", fontFamily: "'Georgia', serif" };
const closeBtn = { width: "40px", height: "40px", borderRadius: "50%", border: "1px solid #eddfc8", background: "#fffdf9", color: "#7a4f10", fontSize: "16px", cursor: "pointer" };
const section = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "16px", padding: "16px", marginBottom: "12px" };
const sectionTitle = { display: "block", margin: 0, fontSize: "15px", color: "#3d2200", fontWeight: "600" };
const hint = { display: "block", margin: "3px 0 10px", fontSize: "12px", color: "#9b7040", lineHeight: 1.45 };
const chipRow = { display: "flex", flexWrap: "wrap", gap: "8px" };
const chip = { minWidth: "56px", padding: "10px 14px", borderRadius: "999px", border: "1px solid #eddfc8", background: "#fdf8f3", color: "#7a4f10", fontSize: "14px", cursor: "pointer" };
const chipOn = { background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", borderColor: "transparent", fontWeight: "600" };
const volumeRow = { display: "flex", alignItems: "center", gap: "12px", marginTop: "10px" };
const muteBtn = { width: "44px", height: "44px", borderRadius: "50%", border: "1px solid #eddfc8", background: "#fdf8f3", fontSize: "20px", cursor: "pointer" };
const volumeValue = { minWidth: "50px", textAlign: "right", fontSize: "13px", color: "#7a4f10" };
const toggleRow = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", cursor: "pointer" };
const footer = { display: "flex", gap: "10px", marginTop: "18px" };
const resetBtn = { flex: 1, padding: "13px", borderRadius: "12px", border: "1px solid #eddfc8", background: "transparent", color: "#7a4f10", fontSize: "14px", cursor: "pointer" };
const doneBtn = { flex: 1, padding: "13px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", fontSize: "14px", fontWeight: "600", cursor: "pointer" };
