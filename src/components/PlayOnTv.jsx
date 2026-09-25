import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { useAudioPlayer } from "../context/AudioPlayerContext";
import { useToast } from "../context/ToastContext";

// "Play on TV": Chromecast, plus a QR / link that opens TV mode on any
// screen with a browser (smart TV, a laptop on HDMI, another phone).
export default function PlayOnTv({ onClose }) {
  const { current, currentTime, cast } = useAudioPlayer();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [qr, setQr] = useState("");
  const tvLink = current ? `${window.location.origin}/tv?a=${encodeURIComponent(current.id)}&t=${Math.floor(currentTime || 0)}` : `${window.location.origin}/tv`;

  // Load the Cast SDK as soon as the sheet opens so the Cast button works in one tap.
  useEffect(() => { cast.ensure().catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(tvLink, { margin: 1, width: 240, color: { dark: "#3d2200", light: "#ffffff" } }).then((u) => live && setQr(u)).catch(() => {});
    return () => { live = false; };
  }, [tvLink]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(tvLink); toast("TV link copied", { type: "success" }); } catch { toast("Couldn't copy the link.", { type: "error" }); }
  };

  return (
    <div style={overlay} role="dialog" aria-modal="true" aria-label="Play on TV" onClick={onClose}>
      <div style={sheet} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <h2 style={title}>📺 Play on TV</h2>
          <button style={closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <section style={box}>
          <h3 style={h3}>Chromecast</h3>
          {cast.casting ? (
            <>
              <p style={text}>Playing on <b>{cast.deviceName}</b>. Pause, skip and seek from here as usual — this device stays in sync and plays silently. Speed is fixed at 1× while casting.</p>
              <button style={dangerBtn} onClick={cast.stop}>Stop casting</button>
            </>
          ) : (
            <>
              <p style={text}>Send this recording to a Chromecast or Google TV on the same Wi-Fi.</p>
              <button style={primary} onClick={cast.start} disabled={!current || cast.status === "loading" || cast.status === "unavailable"}>
                {cast.status === "loading" ? "Getting ready…" : "Cast to a device"}
              </button>
              {cast.status === "ready" && cast.devicesAvailable === false && <p style={hint}>No Chromecast devices found yet on this network.</p>}
              {!current && <p style={hint}>Start a recording first.</p>}
            </>
          )}
          {cast.error && <p style={errorText}>{cast.error}</p>}
          <p style={hint}>Works in Chrome and Edge. On iPhone or iPad use AirPlay from Control Center instead.</p>
        </section>

        <section style={box}>
          <h3 style={h3}>TV mode</h3>
          <p style={text}>Scan this with a phone or open the link on a TV browser to show a big, remote-friendly player for this recording.</p>
          <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
            {qr ? <img src={qr} width={160} height={160} alt="QR code that opens TV mode" style={{ borderRadius: "10px", border: "1px solid #eddfc8" }} /> : <div style={{ width: 160, height: 160 }} />}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1, minWidth: "160px" }}>
              <button style={ghost} onClick={() => navigate(current ? `/tv?a=${encodeURIComponent(current.id)}&t=${Math.floor(currentTime || 0)}` : "/tv")}>Open TV mode here</button>
              <button style={ghost} onClick={copy}>Copy TV link</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

const overlay = { position: "fixed", inset: 0, zIndex: 3600, background: "rgba(40,22,4,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" };
const sheet = { width: "100%", maxWidth: "520px", maxHeight: "90vh", overflowY: "auto", background: "#fdf8f3", borderRadius: "22px 22px 0 0", padding: "18px 20px calc(env(safe-area-inset-bottom, 0px) + 22px)", fontFamily: "sans-serif" };
const header = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" };
const title = { margin: 0, fontSize: "20px", fontWeight: "normal", color: "#3d2200", fontFamily: "'Georgia', serif" };
const closeBtn = { width: "40px", height: "40px", borderRadius: "50%", border: "1px solid #eddfc8", background: "#fffdf9", color: "#7a4f10", cursor: "pointer" };
const box = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "16px", padding: "14px 16px", marginBottom: "12px" };
const h3 = { margin: "0 0 6px", fontSize: "15px", color: "#3d2200" };
const text = { margin: "0 0 12px", fontSize: "13px", color: "#7a4f10", lineHeight: 1.5 };
const hint = { margin: "10px 0 0", fontSize: "12px", color: "#9b7040", lineHeight: 1.5 };
const errorText = { margin: "10px 0 0", fontSize: "12px", color: "#a33622", lineHeight: 1.5 };
const primary = { padding: "12px 20px", borderRadius: "999px", border: "none", background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", fontSize: "14px", fontWeight: "600", cursor: "pointer" };
const ghost = { padding: "11px 16px", borderRadius: "999px", border: "1px solid #eddfc8", background: "#fdf8f3", color: "#7a4f10", fontSize: "13px", cursor: "pointer" };
const dangerBtn = { padding: "11px 18px", borderRadius: "999px", border: "1px solid #f3c8ba", background: "#fff5f2", color: "#a33622", fontSize: "13px", cursor: "pointer" };
