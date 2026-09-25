import { useRef, useState } from "react";
import { useAudioPlayer } from "../context/AudioPlayerContext";
import { describeQueue } from "../utils/playerSettings";

const REPEAT_ICON = { off: "🔁 Repeat off", track: "🔂 Repeat track", queue: "🔁 Repeat queue" };
const NEXT_REPEAT = { off: "track", track: "queue", queue: "off" };

// The "Playing Next" sheet: current-track indicator, drag-to-reorder list,
// estimated total duration, repeat and shuffle.
export default function QueueSheet({ onClose, styles }) {
  const { current, isPlaying, queue, playSermon, removeFromQueue, clearQueue, moveQueueItem, shuffleQueueNow, settings, updateSettings } = useAudioPlayer();
  const { backdrop, sheet, sheetHeader, sheetTitle, sheetLinkBtn, sheetEmptyText, sheetCloseBtn, queueList, queueRow, queueItemBtn, queueItemTitle, queueItemSpeaker, queueRemoveBtn } = styles;

  const rowRefs = useRef([]);
  const [drag, setDrag] = useState(null); // { from, over }

  const overIndexAt = (clientY) => {
    let over = 0;
    rowRefs.current.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (clientY > r.top + r.height / 2) over = i;
    });
    return over;
  };

  const startDrag = (e, from) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not all pointers can be captured */ }
    setDrag({ from, over: from });
  };
  const moveDrag = (e) => {
    if (!drag) return;
    const over = overIndexAt(e.clientY);
    if (over !== drag.over) setDrag({ ...drag, over });
  };
  const endDrag = () => {
    if (drag && drag.over !== drag.from) moveQueueItem(drag.from, drag.over);
    setDrag(null);
  };
  const onHandleKey = (e, i) => {
    if (e.key === "ArrowUp") { e.preventDefault(); moveQueueItem(i, i - 1); }
    if (e.key === "ArrowDown") { e.preventDefault(); moveQueueItem(i, i + 1); }
  };

  const playFromQueue = (sermon, index) => {
    removeFromQueue(index);
    playSermon(sermon);
  };

  return (
    <>
      <div style={backdrop} onClick={onClose} />
      <div style={{ ...sheet, maxHeight: "80vh", overflowY: "auto" }}>
        <div style={sheetHeader}>
          <h3 style={sheetTitle}>Playing Next</h3>
          {queue.length > 0 && <button style={sheetLinkBtn} onClick={clearQueue}>Clear All</button>}
        </div>

        {current && (
          <div style={nowRow} aria-label="Now playing">
            <span style={nowBars} aria-hidden="true">
              <span style={{ ...bar, animation: isPlaying ? "pf-eq 0.9s ease-in-out infinite" : "none" }} />
              <span style={{ ...bar, animation: isPlaying ? "pf-eq 0.9s ease-in-out 0.2s infinite" : "none" }} />
              <span style={{ ...bar, animation: isPlaying ? "pf-eq 0.9s ease-in-out 0.4s infinite" : "none" }} />
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={nowLabel}>{isPlaying ? "Now playing" : "Paused"}</span>
              <span style={queueItemTitle}>{current.title}</span>
            </span>
          </div>
        )}
        <style>{`@keyframes pf-eq{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}@media (prefers-reduced-motion: reduce){.pf-queue *{animation:none!important}}`}</style>

        <div style={controlsRow}>
          <button style={settings.shuffle ? { ...pillBtn, ...pillOn } : pillBtn} onClick={() => updateSettings({ shuffle: !settings.shuffle })} aria-pressed={settings.shuffle}>
            🔀 Shuffle{settings.shuffle ? " on" : ""}
          </button>
          <button style={settings.repeat !== "off" ? { ...pillBtn, ...pillOn } : pillBtn} onClick={() => updateSettings({ repeat: NEXT_REPEAT[settings.repeat] })}>
            {REPEAT_ICON[settings.repeat]}
          </button>
          {queue.length > 1 && <button style={pillBtn} onClick={shuffleQueueNow}>Shuffle order</button>}
        </div>

        {queue.length > 0 && <p style={summary}>{describeQueue(queue)}</p>}

        {queue.length === 0 ? (
          <p style={sheetEmptyText}>Nothing queued yet — use "Play Next" or "Add all to queue" on any list.</p>
        ) : (
          <div style={queueList} className="pf-queue" onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={() => setDrag(null)}>
            {queue.map((sermon, i) => {
              const dragging = drag?.from === i;
              const showLineAbove = drag && drag.over === i && drag.from > i;
              const showLineBelow = drag && drag.over === i && drag.from < i;
              return (
                <div
                  key={`${sermon.id}-${i}`}
                  ref={(el) => { rowRefs.current[i] = el; }}
                  style={{ ...queueRow, opacity: dragging ? 0.55 : 1, boxShadow: dragging ? "0 4px 14px rgba(160,80,20,0.25)" : "none", borderTop: showLineAbove ? "2px solid #c97c2e" : "2px solid transparent", borderBottom: showLineBelow ? "2px solid #c97c2e" : "2px solid transparent" }}
                >
                  <button
                    style={handle}
                    onPointerDown={(e) => startDrag(e, i)}
                    onKeyDown={(e) => onHandleKey(e, i)}
                    aria-label={`Reorder ${sermon.title}. Use arrow keys or drag.`}
                    title="Drag to reorder"
                  >
                    ⋮⋮
                  </button>
                  <button style={queueItemBtn} onClick={() => playFromQueue(sermon, i)}>
                    <div style={queueItemTitle}>{sermon.title}</div>
                    <div style={queueItemSpeaker}>{sermon.speaker}</div>
                  </button>
                  <button style={queueRemoveBtn} onClick={() => removeFromQueue(i)} title="Remove" aria-label={`Remove ${sermon.title}`}>✕</button>
                </div>
              );
            })}
          </div>
        )}

        <button style={sheetCloseBtn} onClick={onClose}>Close</button>
      </div>
    </>
  );
}

const nowRow = { display: "flex", alignItems: "center", gap: "12px", background: "#fdf1de", border: "1px solid #eddfc8", borderRadius: "12px", padding: "10px 12px", marginBottom: "10px" };
const nowBars = { display: "inline-flex", alignItems: "flex-end", gap: "3px", height: "18px", flexShrink: 0 };
const bar = { width: "4px", height: "18px", background: "#c97c2e", borderRadius: "2px", transformOrigin: "bottom", transform: "scaleY(.6)" };
const nowLabel = { display: "block", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em", color: "#9b7040", fontFamily: "sans-serif" };
const controlsRow = { display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" };
const pillBtn = { padding: "8px 12px", borderRadius: "999px", border: "1px solid #eddfc8", background: "#fdf8f3", color: "#7a4f10", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer" };
const pillOn = { background: "#fde8b8", borderColor: "#e5c27a", color: "#7a4f10", fontWeight: "600" };
const summary = { margin: "4px 0 8px", fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif" };
const handle = { border: "none", background: "transparent", color: "#b08050", fontSize: "18px", padding: "0 6px", cursor: "grab", touchAction: "none", letterSpacing: "-3px", minWidth: "32px", minHeight: "40px" };
