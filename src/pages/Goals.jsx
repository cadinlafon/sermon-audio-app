import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useGoalData from "../hooks/useGoalData";
import { PERIODS, METRICS, SERIES_TYPES, asciiBar, fmtMinutes, goalProgress } from "../utils/goals";
import { useToast } from "../context/ToastContext";

const periodName = (p) => PERIODS.find((x) => x[0] === p)?.[1] || p;
const describe = (g) => {
  const m = METRICS.find((x) => x[0] === g.metric)?.[1] || g.metric;
  if (g.metric === "series") return `Complete ${SERIES_TYPES.find((s) => s[0] === g.seriesType)?.[1] || "a series"}`;
  return `${m} · ${periodName(g.period)}`;
};

export default function Goals() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const data = useGoalData();
  const { user, goals, saveGoals, stats, completed, audioTypes, totals, streaks, loading } = data;
  const [form, setForm] = useState({ period: "week", metric: "minutes", target: 120, seriesType: "sermon" });
  const [notif, setNotif] = useState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");

  if (!user) {
    return <Shell><h1 style={title}>Goals</h1><div style={empty}><div style={{ fontSize: "36px" }}>🔒</div><p style={muted}>Sign in to set listening goals.</p><button style={primary} onClick={() => navigate("/login")}>Sign in</button></div></Shell>;
  }

  const add = async () => {
    const target = Number(form.target);
    if (!(target > 0) && form.metric !== "series") { toast("Enter a target above zero.", { type: "error" }); return; }
    const goal = { id: Math.random().toString(36).slice(2, 10), period: form.period, metric: form.metric, target: form.metric === "series" ? Number(form.target) || 0 : target, seriesType: form.metric === "series" ? form.seriesType : undefined, createdAt: Date.now() };
    if (goal.seriesType === undefined) delete goal.seriesType;
    await saveGoals([...goals, goal]).catch(() => toast("Couldn't save the goal.", { type: "error" }));
    toast("Goal added", { type: "success" });
  };

  const remove = async (g) => {
    await saveGoals(goals.filter((x) => x.id !== g.id));
    toast("Goal removed", { action: { label: "Undo", onClick: () => saveGoals([...goals]) } });
  };

  const enableNotifications = async () => {
    if (typeof Notification === "undefined") return;
    setNotif(await Notification.requestPermission());
  };


  return (
    <Shell>
      <h1 style={title}>Goals</h1>
      <p style={subtitle}>Set a target and watch it fill up as you listen.</p>

      <div style={streakRow}>
        <Stat label="Current streak" value={`${streaks.current} day${streaks.current === 1 ? "" : "s"}`} icon="🔥" />
        <Stat label="Longest streak" value={`${streaks.longest} day${streaks.longest === 1 ? "" : "s"}`} icon="🏆" />
        <Stat label="Longest session" value={stats.longestSessionSeconds ? fmtMinutes(stats.longestSessionSeconds / 60) : "—"} icon="⏱" />
      </div>

      {loading ? <p style={muted}>Loading…</p> : goals.length === 0 ? (
        <div style={empty}><div style={{ fontSize: "34px" }}>🎯</div><h3 style={emptyTitle}>No goals yet</h3><p style={muted}>Try “Listen 2 hours this week” below.</p></div>
      ) : goals.map((g) => {
        const p = goalProgress(g, { daily: stats.daily, completed, audioTypes, totals });
        const isMin = p.unit === "min";
        return (
          <div key={g.id} style={{ ...card, borderColor: p.done ? "#86c99a" : "#eddfc8" }}>
            <div style={cardHead}>
              <div><div style={goalTitle}>{describe(g)}</div><div style={goalSub}>{p.done ? "🎉 Goal reached!" : `${Math.max(0, Math.round(p.target - p.value))}${isMin ? " min" : ""} to go`}</div></div>
              <button style={x} onClick={() => remove(g)} aria-label="Remove goal">✕</button>
            </div>
            <div style={track} role="progressbar" aria-valuenow={Math.round(p.pct)} aria-valuemin={0} aria-valuemax={100}><div style={{ ...fill, width: `${p.pct}%`, background: p.done ? "#2f8a4a" : undefined }} /></div>
            <div style={mono}>{asciiBar(p.pct)} {isMin ? `${fmtMinutes(p.value)} / ${fmtMinutes(p.target)}` : `${Math.round(p.value)} / ${Math.round(p.target)} recordings`}</div>
          </div>
        );
      })}

      <div style={card}>
        <h2 style={h2}>Add a goal</h2>
        <div style={formGrid}>
          <label style={field}><span style={lab}>I want to</span>
            <select style={select} value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value, target: e.target.value === "minutes" || e.target.value === "doctrine" ? 120 : 3 })}>
              {METRICS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          {form.metric !== "series" && (
            <label style={field}><span style={lab}>Period</span>
              <select style={select} value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })}>{PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </label>
          )}
          {form.metric === "series" && (
            <label style={field}><span style={lab}>Series</span>
              <select style={select} value={form.seriesType} onChange={(e) => setForm({ ...form, seriesType: e.target.value, target: totals[e.target.value] || 3 })}>{SERIES_TYPES.map(([v, l]) => <option key={v} value={v}>{l} {totals[v] ? `(${totals[v]})` : ""}</option>)}</select>
            </label>
          )}
          <label style={field}><span style={lab}>{form.metric === "minutes" || form.metric === "doctrine" ? "Target (minutes)" : "Target (recordings)"}</span>
            <input style={select} type="number" min="1" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
          </label>
        </div>
        <button style={primary} onClick={add}>＋ Add goal</button>
      </div>

      {typeof Notification !== "undefined" && (
        <div style={card}>
          <h2 style={h2}>Goal notifications</h2>
          <p style={muted}>{notif === "granted" ? "On — you'll get a notification (and confetti) when you hit a goal." : notif === "denied" ? "Blocked in your browser settings. You'll still see a celebration in the app." : "Get a notification when you reach a goal."}</p>
          {notif === "default" && <button style={ghost} onClick={enableNotifications}>🔔 Turn on</button>}
        </div>
      )}

      <button style={ghost} onClick={() => navigate("/year-in-review")}>🎁 See your Year in Review →</button>
      <p style={{ ...muted, marginTop: "14px" }}>Daily listening is tracked from the day this feature was added, so earlier listening isn't counted toward time-based goals.</p>
    </Shell>
  );
}

function Stat({ label, value, icon }) { return <div style={stat}><div style={{ fontSize: "20px" }}>{icon}</div><div style={statVal}>{value}</div><div style={statLab}>{label}</div></div>; }
function Shell({ children }) { return <div style={page}>{children}</div>; }

const page = { padding: "32px 20px 60px", maxWidth: "640px", margin: "0 auto", background: "#fdf8f3", minHeight: "100vh", fontFamily: "'Georgia', serif" };
const title = { textAlign: "center", margin: "0 0 6px", fontSize: "28px", fontWeight: "normal", color: "#3d2200" };
const subtitle = { textAlign: "center", margin: "0 0 20px", fontSize: "14px", color: "#9b7040", fontFamily: "sans-serif" };
const muted = { margin: "0 0 12px", fontSize: "13px", color: "#9b7040", fontFamily: "sans-serif", lineHeight: 1.55 };
const streakRow = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "16px" };
const stat = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "14px", padding: "12px", textAlign: "center" };
const statVal = { fontSize: "18px", color: "#3d2200", margin: "2px 0" };
const statLab = { fontSize: "11px", color: "#9b7040", fontFamily: "sans-serif" };
const card = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "16px", padding: "16px", marginBottom: "14px" };
const cardHead = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "10px" };
const goalTitle = { fontSize: "16px", color: "#3d2200" };
const goalSub = { fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif", marginTop: "2px" };
const track = { height: "12px", background: "#eddfc8", borderRadius: "999px", overflow: "hidden" };
const fill = { height: "100%", background: "linear-gradient(to right, #e08930, #c97c2e)", borderRadius: "999px", transition: "width 0.4s" };
const mono = { marginTop: "8px", fontFamily: "monospace", fontSize: "12px", color: "#7a5530", letterSpacing: "0.02em" };
const x = { width: "30px", height: "30px", borderRadius: "50%", border: "none", background: "#f4e7d4", color: "#7a4f10", cursor: "pointer", fontSize: "12px" };
const h2 = { margin: "0 0 12px", fontSize: "16px", fontWeight: "600", color: "#3d2200", fontFamily: "sans-serif" };
const formGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", marginBottom: "12px" };
const field = { display: "flex", flexDirection: "column", gap: "4px" };
const lab = { fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#9b7040", fontFamily: "sans-serif" };
const select = { padding: "10px 12px", borderRadius: "10px", border: "1px solid #eddfc8", background: "#fdf8f3", fontSize: "14px", fontFamily: "sans-serif", color: "#3d2200" };
const primary = { padding: "10px 18px", borderRadius: "999px", border: "none", background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", fontSize: "13px", fontFamily: "sans-serif", fontWeight: "600", cursor: "pointer" };
const ghost = { padding: "9px 14px", borderRadius: "999px", border: "1px solid #eddfc8", background: "#fffdf9", color: "#7a4f10", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
const empty = { textAlign: "center", padding: "20px 10px" };
const emptyTitle = { margin: "8px 0 4px", fontSize: "18px", fontWeight: "normal", color: "#3d2200" };
