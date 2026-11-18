import { useState } from "react";
import PreviewFrame from "./PreviewFrame";
import PopupView from "../PopupView";
import { sanitizePopup } from "../../lib/popups";

// The popup being edited, drawn over a pretend app screen. Nothing sends or
// navigates. "Replay" runs the entrance animation again.
export default function PopupPreview({ popup }) {
  const [tick, setTick] = useState(0);
  const [closed, setClosed] = useState(false);
  const p = sanitizePopup({
    ...popup,
    id: popup.id || "preview",
    // Half-finished buttons still show up so you can see where they'll go.
    buttons: (popup.buttons || []).map((b) => ({ ...b, text: b.text || "Button", value: b.value || (b.action === "dismiss" ? "" : "x") })),
    ...(popup.inputEnabled ? null : { inputFields: [] }),
  });
  const stageHeight = p.type === "banner" ? 360 : p.type === "fullscreen" ? 560 : 580;

  return (
    <PreviewFrame
      title="Live preview"
      fill
      height={stageHeight}
      note="Drawn over a pretend app screen. Buttons and forms are for show — nothing opens or sends. Press Replay to watch the entrance again."
      chips={
        <button type="button" onClick={() => { setClosed(false); setTick((t) => t + 1); }} style={replay}>↻ Replay</button>
      }
    >
      <div style={fake} aria-hidden="true">
        <div style={fakeBar}><span style={{ fontFamily: "'Georgia', serif", fontSize: "13px" }}>Palouse Fellowship</span></div>
        <div style={{ ...fakeLine, width: "70%" }} />
        <div style={{ ...fakeLine, width: "92%" }} />
        <div style={{ ...fakeLine, width: "55%" }} />
        <div style={fakeCard} />
        <div style={fakeCard} />
        <div style={fakeNav} />
      </div>
      {closed ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <button type="button" onClick={() => { setClosed(false); setTick((t) => t + 1); }} style={replay}>It was closed — show it again</button>
        </div>
      ) : (
        <PopupView key={`${tick}-${p.type}`} popup={p} frame preview onClose={() => setClosed(true)} offset={56} />
      )}
    </PreviewFrame>
  );
}

const replay = { padding: "5px 11px", borderRadius: "999px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fffdf9)", color: "var(--color-7a4f10)", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer" };
const fake = { position: "absolute", inset: 0, padding: "0 0 0", display: "flex", flexDirection: "column", gap: "10px", background: "var(--color-fdf8f3)" };
const fakeBar = { padding: "12px 16px", borderBottom: "1px solid var(--color-eddfc8)", background: "var(--color-fffdf9)", color: "var(--color-3d2200)" };
const fakeLine = { height: "10px", borderRadius: "999px", background: "var(--color-eddfc8)", margin: "6px 16px 0" };
const fakeCard = { height: "78px", borderRadius: "14px", background: "var(--color-fffdf9)", border: "1px solid var(--color-eddfc8)", margin: "0 16px" };
const fakeNav = { marginTop: "auto", height: "52px", background: "var(--color-fffdf9)", borderTop: "1px solid var(--color-eddfc8)" };
