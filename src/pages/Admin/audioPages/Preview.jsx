import { useMemo, useState } from "react";
import AudioListView from "../../../components/AudioListView";
import { AudioConfigContext } from "../../../hooks/useAudioConfig";
import { resolveAudioConfig } from "../../../data/audioPageDefaults";

// Page visualizer: the real audio page, rendered with the DRAFT settings. It
// never plays, saves or navigates (`preview`), so it is safe to poke at.
const WIDTHS = [["phone", "Phone", 390], ["tablet", "Tablet", 640], ["desktop", "Desktop", 900]];

export default function Preview({ draft, pageKey, items, loading, notices }) {
  const [size, setSize] = useState("phone");
  const cfg = useMemo(() => resolveAudioConfig(draft, pageKey), [draft, pageKey]);
  const width = WIDTHS.find((w) => w[0] === size)[2];
  return (
    <div style={wrap}>
      <div style={bar}>
        <span style={barTitle}>Live preview</span>
        <div style={{ display: "flex", gap: "4px" }}>
          {WIDTHS.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setSize(id)} style={id === size ? { ...sizeBtn, ...sizeOn } : sizeBtn} aria-pressed={id === size}>{label}</button>
          ))}
        </div>
      </div>
      <div style={frameScroll}>
        <div style={{ ...frame, width: `${width}px` }}>
          <AudioConfigContext.Provider value={cfg}>
            <AudioListView pageKey={pageKey} items={items} loading={loading} onPlay={() => {}} onSummarySaved={() => {}} notices={notices} preview />
          </AudioConfigContext.Provider>
        </div>
      </div>
      <p style={note}>Buttons here are for show — nothing plays or saves. Your changes appear above before you press Save.</p>
    </div>
  );
}

const wrap = { background: "var(--color-fffdf9)", border: "1px solid var(--color-eddfc8)", borderRadius: "14px", padding: "12px", display: "flex", flexDirection: "column", gap: "10px", minWidth: 0 };
const bar = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" };
const barTitle = { fontSize: "13px", fontWeight: "600", color: "var(--color-5c3a1e)", fontFamily: "sans-serif" };
const sizeBtn = { padding: "5px 11px", borderRadius: "999px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fffdf9)", color: "var(--color-7a4f10)", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer" };
const sizeOn = { background: "var(--color-f6e4b0)", border: "1px solid var(--color-c8922a)", fontWeight: "600" };
const frameScroll = { overflow: "auto", maxHeight: "calc(100vh - 220px)", minHeight: "420px", borderRadius: "10px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)" };
const frame = { maxWidth: "100%", margin: "0 auto", transformOrigin: "top center" };
const note = { margin: 0, fontSize: "11.5px", color: "var(--color-9b7040)", fontFamily: "sans-serif", lineHeight: 1.5 };
