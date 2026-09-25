import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useGoalData from "../hooks/useGoalData";
import { fmtMinutes } from "../utils/goals";
import { useToast } from "../context/ToastContext";

const APP_LABEL = "PF Audio";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const TYPE_NAME = { sermon: "Sermons", homily: "Homilies", sundayschool: "Sunday School" };

export default function YearInReview() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, stats, completed, audioTypes, totals, loading } = useGoalData();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const canvasRef = useRef(null);

  const summary = useMemo(() => {
    const sermons = Object.entries(stats.sermons || {}).map(([id, s]) => ({ id, title: s.title || "Untitled", speaker: s.speaker || "Unknown", count: Number(s.count) || 0, seconds: Number(s.seconds) || 0, type: s.type || audioTypes[id], doctrine: !!s.doctrine }));
    const yearDays = Object.entries(stats.daily || {}).filter(([d]) => d.startsWith(String(year)));
    const dailySeconds = yearDays.reduce((s, [, v]) => s + (Number(v?.seconds) || 0), 0);
    const hasDaily = yearDays.length > 0;
    const seconds = hasDaily ? dailySeconds : year === thisYear ? stats.totalSeconds : 0;

    const byMonth = new Array(12).fill(0);
    yearDays.forEach(([d, v]) => { byMonth[Number(d.slice(5, 7)) - 1] += Number(v?.seconds) || 0; });
    const topMonth = byMonth.some((n) => n > 0) ? byMonth.indexOf(Math.max(...byMonth)) : -1;

    const bySpeaker = {}; const byType = {};
    sermons.forEach((s) => { bySpeaker[s.speaker] = (bySpeaker[s.speaker] || 0) + s.seconds; if (s.type) byType[s.type] = (byType[s.type] || 0) + s.seconds; });
    const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const completedThisYear = completed.filter((c) => c.at && new Date(c.at).getFullYear() === year);
    const started = Object.keys(byType).length;
    const doneSeries = Object.keys(totals).filter((t) => totals[t] > 0 && completed.filter((c) => audioTypes[c.audioId] === t).length >= totals[t]).length;
    const mostPlayed = [...sermons].sort((a, b) => b.count - a.count || b.seconds - a.seconds)[0];
    const doctrineTop = [...sermons].filter((s) => s.doctrine).sort((a, b) => b.seconds - a.seconds)[0];

    return { seconds, hasDaily, completed: completedThisYear.length, speaker: top(bySpeaker), mostPlayed: mostPlayed?.count ? mostPlayed.title : null, month: topMonth >= 0 ? MONTHS[topMonth] : null, category: top(byType), started, doneSeries, doctrine: doctrineTop?.title || null, session: stats.longestSessionSeconds };
  }, [stats, completed, audioTypes, totals, year, thisYear]);

  if (!user) {
    return <Shell><h1 style={title}>Year in Review</h1><div style={empty}><p style={muted}>Sign in to see your year.</p><button style={primary} onClick={() => navigate("/login")}>Sign in</button></div></Shell>;
  }

  const rows = [
    ["⏱", "Hours listened", summary.seconds ? `${(summary.seconds / 3600).toFixed(1)} h` : "—"],
    ["✅", "Recordings completed", String(summary.completed)],
    ["🎙️", "Favorite speaker", summary.speaker || "—"],
    ["⭐", "Most-played recording", summary.mostPlayed || "—"],
    ["📅", "Most active month", summary.month || "—"],
    ["🗂️", "Favorite category", summary.category ? TYPE_NAME[summary.category] || summary.category : "—"],
    ["🚀", "Series started", String(summary.started)],
    ["🏁", "Series completed", String(summary.doneSeries)],
    ["📖", "Top Doctrine recording", summary.doctrine || "—"],
    ["🌟", "Longest listening session", summary.session ? fmtMinutes(summary.session / 60) : "—"],
  ];

  const draw = () => {
    const c = canvasRef.current; const ctx = c.getContext("2d");
    const W = 1080; const H = 1350; c.width = W; c.height = H;
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#3d2200"); g.addColorStop(1, "#a85e18");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.beginPath(); ctx.arc(W - 120, 160, 320, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fde8b8"; ctx.font = "600 34px sans-serif"; ctx.fillText(APP_LABEL.toUpperCase(), 80, 110);
    ctx.fillStyle = "#fff8ee"; ctx.font = "bold 84px Georgia, serif"; ctx.fillText(`Your ${year}`, 80, 220); ctx.fillText("in listening", 80, 315);
    ctx.font = "34px Georgia, serif";
    let y = 430;
    for (const [icon, label, value] of rows.slice(0, 8)) {
      ctx.fillStyle = "#fde8b8"; ctx.font = "28px sans-serif"; ctx.fillText(`${icon}  ${label}`, 80, y);
      ctx.fillStyle = "#fff8ee"; ctx.font = "bold 40px Georgia, serif";
      const v = value.length > 28 ? `${value.slice(0, 27)}…` : value;
      ctx.fillText(v, 80, y + 48);
      y += 110;
    }
    ctx.fillStyle = "rgba(255,248,238,0.7)"; ctx.font = "26px sans-serif"; ctx.fillText(window.location.host, 80, H - 60);
  };

  const toBlob = () => new Promise((resolve) => { draw(); canvasRef.current.toBlob(resolve, "image/png"); });

  const share = async () => {
    const blob = await toBlob();
    const file = new File([blob], `my-${year}-in-review.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: `My ${year} in ${APP_LABEL}` }); return; } catch (e) { if (e?.name === "AbortError") return; } }
    download(blob);
  };
  const download = (blob) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `my-${year}-in-review.png`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast("Image saved", { type: "success" }); };

  return (
    <Shell>
      <h1 style={title}>Year in Review</h1>
      <p style={subtitle}>Your {year} in {APP_LABEL}</p>
      <div style={yearRow}>
        {[thisYear, thisYear - 1].map((y) => <button key={y} style={year === y ? { ...chip, ...chipOn } : chip} onClick={() => setYear(y)}>{y}</button>)}
      </div>

      {loading ? <p style={muted}>Loading…</p> : (
        <div style={card}>
          {rows.map(([icon, label, value]) => (
            <div key={label} style={row}><span style={rowIcon}>{icon}</span><span style={rowLabel}>{label}</span><span style={rowValue}>{value}</span></div>
          ))}
        </div>
      )}

      <div style={btnRow}>
        <button style={primary} onClick={share}>↗ Share summary card</button>
        <button style={ghost} onClick={async () => download(await toBlob())}>⬇ Save image</button>
      </div>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      {!summary.hasDaily && <p style={muted}>Some numbers (favorites, top month) get more accurate over time — daily listening has only been tracked since this feature was added.</p>}
    </Shell>
  );
}

function Shell({ children }) { return <div style={page}>{children}</div>; }

const page = { padding: "32px 20px 60px", maxWidth: "560px", margin: "0 auto", background: "#fdf8f3", minHeight: "100vh", fontFamily: "'Georgia', serif" };
const title = { textAlign: "center", margin: "0 0 6px", fontSize: "28px", fontWeight: "normal", color: "#3d2200" };
const subtitle = { textAlign: "center", margin: "0 0 14px", fontSize: "14px", color: "#9b7040", fontFamily: "sans-serif" };
const muted = { margin: "12px 0", fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif", lineHeight: 1.55 };
const yearRow = { display: "flex", justifyContent: "center", gap: "8px", marginBottom: "16px" };
const chip = { padding: "8px 16px", borderRadius: "999px", border: "1px solid #eddfc8", background: "#fffdf9", color: "#7a4f10", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
const chipOn = { background: "#fde8b8", borderColor: "#e5c27a", fontWeight: "600" };
const card = { background: "linear-gradient(160deg, #3d2200, #8a4f12)", borderRadius: "22px", padding: "10px 18px", marginBottom: "16px", color: "#fff8ee" };
const row = { display: "flex", alignItems: "center", gap: "12px", padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.12)" };
const rowIcon = { fontSize: "20px", width: "28px" };
const rowLabel = { flex: 1, fontSize: "13px", color: "#fde8b8", fontFamily: "sans-serif" };
const rowValue = { fontSize: "16px", fontWeight: "bold", textAlign: "right", maxWidth: "55%" };
const btnRow = { display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" };
const primary = { padding: "11px 20px", borderRadius: "999px", border: "none", background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", fontSize: "13px", fontFamily: "sans-serif", fontWeight: "600", cursor: "pointer" };
const ghost = { padding: "10px 16px", borderRadius: "999px", border: "1px solid #eddfc8", background: "#fffdf9", color: "#7a4f10", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
const empty = { textAlign: "center", padding: "30px 10px" };
