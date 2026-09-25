import { useState } from "react";
import { useAudioPlayer } from "../context/AudioPlayerContext";

// "Play all" / "Add all to queue" / "Add remaining" for whatever list is on
// screen — respects the current search and filters.
export default function PlayAllBar({ items, filtered }) {
  const { playAll, addAllToQueue, addRemainingToQueue, queue, current } = useAudioPlayer();
  const [message, setMessage] = useState("");
  if (!items || items.length === 0) return null;

  const flash = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(""), 2200);
  };

  const notQueued = (list) => {
    const have = new Set(queue.map((q) => q.id));
    if (current) have.add(current.id);
    return list.filter((i) => !have.has(i.id));
  };

  const remainingItems = () => {
    const i = current ? items.findIndex((t) => t.id === current.id) : -1;
    return i >= 0 ? items.slice(i + 1) : items;
  };

  const onPlayAll = () => {
    playAll(items);
    flash(`Playing ${items.length}${filtered ? " filtered" : ""} recording${items.length === 1 ? "" : "s"}`);
  };
  const onAddAll = () => {
    const n = notQueued(items).length;
    addAllToQueue(items);
    flash(n ? `Added ${n} to queue` : "Already in your queue");
  };
  const onAddRemaining = () => {
    const n = notQueued(remainingItems()).length;
    addRemainingToQueue(items);
    flash(n ? `Added ${n} to queue` : "Nothing left to add");
  };

  return (
    <div style={bar}>
      <button style={primary} onClick={onPlayAll}>▶ Play all{filtered ? " filtered" : ""} ({items.length})</button>
      <button style={secondary} onClick={onAddAll}>＋ Add all to queue</button>
      {current && <button style={secondary} onClick={onAddRemaining}>＋ Add remaining</button>}
      {message && <span style={note} role="status">{message}</span>}
    </div>
  );
}

const bar = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", margin: "0 0 16px" };
const primary = { padding: "9px 16px", borderRadius: "999px", border: "none", background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", fontSize: "13px", fontFamily: "sans-serif", fontWeight: "600", cursor: "pointer" };
const secondary = { padding: "9px 14px", borderRadius: "999px", border: "1px solid #eddfc8", background: "#fdf8f3", color: "#7a4f10", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
const note = { fontSize: "12px", color: "#166534", fontFamily: "sans-serif" };
