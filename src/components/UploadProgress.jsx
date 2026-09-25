import { useEffect, useRef, useState } from "react";

const mb = (bytes) => `${(bytes / 1048576).toFixed(bytes > 10485760 ? 0 : 1)} MB`;
const eta = (s) => (s < 60 ? `${Math.max(1, Math.round(s))}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`);

// Animated upload progress: striped moving fill, percent, size, speed, time left.
// `percent` null = still preparing (indeterminate).
export default function UploadProgress({ percent, totalBytes, label, compact }) {
  const startRef = useRef(null);
  const [, tick] = useState(0);

  useEffect(() => {
    if (percent !== null && percent !== undefined && startRef.current === null) startRef.current = Date.now();
    if (percent === null || percent === undefined) startRef.current = null;
  }, [percent]);

  // Re-render once a second so speed / time-left stay fresh between events.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const done = percent >= 100;
  let detail = "";
  if (percent !== null && percent !== undefined && totalBytes && startRef.current && percent > 0) {
    const elapsed = (Date.now() - startRef.current) / 1000;
    const loaded = (percent / 100) * totalBytes;
    const speed = elapsed > 1 ? loaded / elapsed : 0;
    detail = `${mb(loaded)} of ${mb(totalBytes)}`;
    if (speed > 0 && !done) detail += ` · ${(speed / 1048576).toFixed(1)} MB/s · about ${eta((totalBytes - loaded) / speed)} left`;
  }

  return (
    <div>
      <div style={{ ...track, height: compact ? "6px" : "10px" }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined} aria-label={label || "Upload progress"}>
        {percent === null || percent === undefined ? (
          <div className="pf-upload-indeterminate" style={indeterminate} />
        ) : (
          <div className={done ? "" : "pf-upload-stripes"} style={{ ...fill, width: `${percent}%`, background: done ? "#2f8a4a" : undefined }} />
        )}
      </div>
      {!compact && (
        <p style={text}>
          <strong>{label}</strong>
          {detail && <span style={{ marginLeft: 8 }}>{detail}</span>}
        </p>
      )}
    </div>
  );
}

const track = { background: "#eddfc8", borderRadius: "999px", overflow: "hidden", position: "relative" };
const fill = { height: "100%", borderRadius: "999px", transition: "width 0.25s ease-out, background 0.3s", backgroundColor: "#c97c2e" };
const indeterminate = { height: "100%", width: "40%", background: "linear-gradient(to right, #e08930, #c97c2e)", borderRadius: "999px", animation: "uploadSlide 1.1s ease-in-out infinite" };
const text = { fontSize: "12px", fontFamily: "sans-serif", color: "#9b7040", margin: "8px 0 0", textAlign: "center" };
