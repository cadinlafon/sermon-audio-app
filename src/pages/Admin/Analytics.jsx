import { useEffect, useRef, useState } from "react";
import { db, auth } from "../../firebase";
import { supabase } from "../../supabase";
import { buildActivityDigest, periodStart } from "../../utils/activityDigest";
import { collection, getDocs, query, where } from "firebase/firestore";
import { startOfToday, summarizeToday } from "../../utils/todayActivity";
import ClarityInsights from "../../components/Admin/ClarityInsights";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function Analytics() {
  const [stats, setStats] = useState({ totalUsers:0, newUsers:0, totalUploads:0, minutesPlayed:0, totalListens:0, usesWeb:0, usesPWA:0, pwaIphone:0, pwaAndroid:0, pwaDesktop:0 });
  const [monthlyActivity, setMonthlyActivity] = useState([]);
  const [today, setToday] = useState({ users: [], anonymous: 0, loading: true, error: false });
  const [expanded, setExpanded] = useState(() => new Set());
  const [aiPeriod, setAiPeriod] = useState("today");
  const [ai, setAi] = useState({ loading: false, error: "", summary: "", period: "", at: null, events: 0 });
  // Users + audio titles, kept from the main load so the AI summary can
  // name people and sermons without reading those collections again.
  const lookups = useRef({ users: [], audio: [] });

  const getWeekRange = () => {
    const now = new Date();
    const start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0,0,0,0);
    const end = new Date(start); end.setDate(start.getDate() + 7);
    return { start, end };
  };

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const [usersSnap, audioSnap, usageSnap, logsSnap, todayLogsSnap] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "audio")),
          getDocs(collection(db, "appUsage")),
          getDocs(collection(db, "logs")),
          // Only today's logs (a handful of docs) for the "used the app today" card.
          getDocs(query(collection(db, "logs"), where("createdAt", ">=", startOfToday()))),
        ]);
        const users = usersSnap.docs.map(d => d.data());
        const usage = usageSnap.docs.map(d => d.data());
        const logs = logsSnap.docs.map(d => d.data());
        const { start, end } = getWeekRange();

        lookups.current = {
          users: usersSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          audio: audioSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        };
        const usersById = new Map(usersSnap.docs.map(d => [d.id, d.data()]));
        const summary = summarizeToday(todayLogsSnap.docs.map(d => d.data()), usersById);
        setToday({ ...summary, loading: false, error: false });

        const newUsers = users.filter(u => u.createdAt?.seconds && new Date(u.createdAt.seconds*1000) >= start && new Date(u.createdAt.seconds*1000) <= end).length;
        let minutesPlayed = 0, totalListens = 0;
        usage.forEach(item => {
          if (!item.createdAt?.seconds) return;
          const d = new Date(item.createdAt.seconds*1000);
          if (d >= start && d <= end) { totalListens++; if (item.duration) minutesPlayed += item.duration; }
        });
        minutesPlayed = Math.floor(minutesPlayed / 60);

        const monthlyMap = {};
        usage.forEach(item => {
          if (!item.createdAt?.seconds) return;
          const d = new Date(item.createdAt.seconds*1000);
          const key = `${d.getFullYear()}-${d.getMonth()}`;
          if (!monthlyMap[key]) monthlyMap[key] = 0;
          monthlyMap[key]++;
        });
        const monthlyData = Object.entries(monthlyMap)
          .map(([key, count]) => { const [year, month] = key.split("-"); return { label: `${MONTH_NAMES[month].slice(0,3)} ${year}`, count, date: new Date(year, month) }; })
          .sort((a,b) => a.date - b.date).slice(-6);
        setMonthlyActivity(monthlyData);

        let usesWeb=0, usesPWA=0, pwaIphone=0, pwaAndroid=0, pwaDesktop=0;
        logs.forEach(log => {
          if (log.event === "app_opened") usesWeb++;
          if (log.event === "pwa_installed") {
            usesPWA++;
            const device = log.device || "";
            if (device.includes("iPhone") || device.includes("iPad")) pwaIphone++;
            else if (device.includes("Android")) pwaAndroid++;
            else pwaDesktop++;
          }
        });

        setStats({ totalUsers: users.length, newUsers, totalUploads: audioSnap.size, minutesPlayed, totalListens, usesWeb, usesPWA, pwaIphone, pwaAndroid, pwaDesktop });
      } catch (err) {
        console.error("Analytics error:", err);
        setToday(t => ({ ...t, loading: false, error: true }));
      }
    };
    fetchAnalytics();
  }, []);

  const generateAiSummary = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) { setAi(a => ({ ...a, error: "Please sign in again." })); return; }
    const period = aiPeriod;
    setAi({ loading: true, error: "", summary: "", period, at: null, events: 0 });
    try {
      const start = periodStart(period);
      // Only the chosen period is read (range queries), not the whole history.
      const [logsSnap, listensSnap] = await Promise.all([
        getDocs(query(collection(db, "logs"), where("createdAt", ">=", start))),
        getDocs(query(collection(db, "appUsage"), where("createdAt", ">=", start))),
      ]);
      const logs = logsSnap.docs.map(d => d.data());
      const listens = listensSnap.docs.map(d => d.data());
      const digest = buildActivityDigest({ logs, listens, users: lookups.current.users, audio: lookups.current.audio, start });

      const token = await currentUser.getIdToken();
      const { data, error } = await supabase.functions.invoke("admin-activity-summary", {
        headers: { Authorization: `Bearer ${token}` },
        body: { period, digest },
      });
      if (error) {
        const body = await error.context?.json?.().catch(() => null);
        throw new Error(body?.error || error.message);
      }
      if (!data?.summary) throw new Error(data?.error || "No summary was returned.");
      setAi({ loading: false, error: "", summary: data.summary, period, at: new Date(), events: logs.length + listens.length });
    } catch (err) {
      console.error("AI activity summary failed", err);
      setAi({ loading: false, error: err.message || "Couldn't write the summary. Please try again.", summary: "", period, at: null, events: 0 });
    }
  };

  const toggleUser = (id) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const maxCount = Math.max(...monthlyActivity.map(m => m.count), 1);

  return (
    <div style={page}>
      <div style={pageHeader}>
        <h1 style={pageTitle}>Analytics</h1>
        <p style={pageSubtitle}>Usage stats for the current week.</p>
      </div>

      <div style={{ ...chartCard, marginBottom: "28px" }}>
        <div style={aiHeader}>
          <h2 style={{ ...chartTitle, margin: 0 }}>✦ AI Summary</h2>
          <div style={aiPeriodRow} role="group" aria-label="Summary period">
            {[["today", "Today"], ["week", "This Week"]].map(([value, label]) => (
              <button key={value} onClick={() => setAiPeriod(value)} aria-pressed={aiPeriod === value} style={aiPeriod === value ? { ...aiPeriodBtn, ...aiPeriodBtnActive } : aiPeriodBtn}>{label}</button>
            ))}
          </div>
        </div>
        <p style={todayHint}>An AI-written recap of what happened in the app {aiPeriod === "week" ? "this week" : "today"} — sign-ups, who was active, what they played and which pages they visited.</p>
        <button onClick={generateAiSummary} disabled={ai.loading} style={ai.loading ? { ...aiGenerateBtn, opacity: 0.6 } : aiGenerateBtn}>
          {ai.loading ? "Writing summary…" : ai.summary ? "↻ Regenerate" : "✦ Generate Summary"}
        </button>
        {ai.error && <p style={aiError} role="alert">{ai.error}</p>}
        {ai.summary && (
          <div style={aiResult}>
            {ai.summary.split(/\n{2,}/).map((para, i) => <p key={i} style={aiParagraph}>{para}</p>)}
            <p style={aiMeta}>{ai.period === "week" ? "This week" : "Today"} · based on {ai.events} recorded {ai.events === 1 ? "event" : "events"} · generated {ai.at?.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. AI can make mistakes — check anything important.</p>
          </div>
        )}
      </div>

      <div style={grid}>
        <StatCard icon="👥" label="Total Users" value={stats.totalUsers} color="var(--color-c97c2e)" />
        <StatCard icon="✨" label="New Users This Week" value={stats.newUsers} color="var(--color-16a34a)" />
        <StatCard icon="🎙️" label="Total Uploads" value={stats.totalUploads} color="var(--color-2563eb)" />
        <StatCard icon="🎧" label="Listens This Week" value={stats.totalListens} color="var(--color-7c3aed)" />
        <StatCard icon="⏱️" label="Minutes Played" value={stats.minutesPlayed} color="var(--color-db2777)" />
        <StatCard icon="🌐" label="Web Opens" value={stats.usesWeb} color="var(--color-0891b2)" />
        <StatCard icon="📱" label="PWA Installs" value={stats.usesPWA} color="var(--color-65a30d)" />
        <StatCard icon="🍎" label="PWA on iPhone" value={stats.pwaIphone} color="var(--color-dc2626)" />
        <StatCard icon="🤖" label="PWA on Android" value={stats.pwaAndroid} color="var(--color-16a34a)" />
        <StatCard icon="💻" label="PWA on Desktop" value={stats.pwaDesktop} color="var(--color-6d28d9)" />
      </div>

      <ClarityInsights />

      <div style={{ ...chartCard, marginBottom: "28px" }}>
        <h2 style={{ ...chartTitle, margin: "0 0 4px" }}>These users used the app today</h2>
        <p style={todayHint}>
          {today.loading ? "Loading…" : today.error ? "Couldn't load today's activity." : `${today.users.length} signed-in ${today.users.length === 1 ? "user" : "users"}${today.anonymous ? ` · ${today.anonymous} signed-out ${today.anonymous === 1 ? "visitor" : "visitors"}` : ""}`}
        </p>
        {!today.loading && !today.error && today.users.length === 0 && (
          <p style={todayEmpty}>No signed-in users have used the app yet today.</p>
        )}
        <div style={userList}>
          {today.users.map(u => {
            const open = expanded.has(u.id);
            return (
              <div key={u.id} style={userRow}>
                <button style={userBtn} onClick={() => toggleUser(u.id)} aria-expanded={open}>
                  <span style={userName}>{u.name}</span>
                  <span style={userMeta}>{u.pages.length} {u.pages.length === 1 ? "page" : "pages"} <span aria-hidden="true">{open ? "▴" : "▾"}</span></span>
                </button>
                {open && (
                  <ul style={pageList}>
                    {u.pages.length === 0 && <li style={pageItem}>No page views recorded</li>}
                    {u.pages.map(p => (
                      <li key={p.label} style={pageItem}>
                        <span>{p.label}</span>
                        {p.count > 1 && <span style={pageCount}>×{p.count}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {monthlyActivity.length > 0 && (
        <div style={chartCard}>
          <h2 style={chartTitle}>Monthly Activity</h2>
          <div style={chartArea}>
            {monthlyActivity.map((m, i) => (
              <div key={i} style={barWrapper}>
                <div style={barValue}>{m.count}</div>
                <div style={{ ...bar, height: `${(m.count / maxCount) * 160}px` }} />
                <div style={barLabel}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div style={statCard}>
      <div style={{ ...iconWrap, background: color + "18", color }}>{icon}</div>
      <div style={statLabel}>{label}</div>
      <div style={statValue}>{value}</div>
    </div>
  );
}

const page = { maxWidth: "1100px" };
const pageHeader = { marginBottom: "24px" };
const pageTitle = { fontSize: "26px", fontWeight: "normal", color: "var(--color-3d2200)", margin: "0 0 4px", fontFamily: "'Georgia', serif" };
const pageSubtitle = { fontSize: "14px", color: "var(--color-9b7040)", fontFamily: "sans-serif", margin: 0 };
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "28px" };
const statCard = { background: "var(--color-fffdf9)", border: "1px solid var(--color-eddfc8)", borderRadius: "14px", padding: "18px", boxShadow: "0 2px 10px rgba(160,100,40,0.06)" };
const iconWrap = { width: "36px", height: "36px", borderRadius: "9px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", marginBottom: "10px" };
const statLabel = { fontSize: "11px", fontFamily: "sans-serif", color: "var(--color-9b7040)", marginBottom: "4px", letterSpacing: "0.04em" };
const statValue = { fontSize: "28px", fontWeight: "bold", color: "var(--color-3d2200)", fontFamily: "sans-serif" };

const chartCard = { background: "var(--color-fffdf9)", border: "1px solid var(--color-eddfc8)", borderRadius: "16px", padding: "24px", boxShadow: "0 2px 12px rgba(160,100,40,0.07)" };
const chartTitle = { fontSize: "17px", fontWeight: "normal", color: "var(--color-5c3a1e)", fontFamily: "'Georgia', serif", margin: "0 0 20px" };
const chartArea = { display: "flex", alignItems: "flex-end", gap: "12px", height: "200px" };
const barWrapper = { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" };
const bar = { width: "100%", maxWidth: "48px", background: "linear-gradient(180deg, var(--color-e08930), var(--color-c97c2e))", borderRadius: "6px 6px 0 0" };
const barValue = { fontSize: "12px", fontFamily: "sans-serif", color: "var(--color-7a4f10)", fontWeight: "bold", marginBottom: "4px" };
const barLabel = { fontSize: "11px", fontFamily: "sans-serif", color: "var(--color-9b7040)", marginTop: "6px", textAlign: "center" };

const todayHint = { fontSize: "13px", fontFamily: "sans-serif", color: "var(--color-9b7040)", margin: "0 0 14px" };
const todayEmpty = { fontSize: "14px", fontFamily: "sans-serif", color: "var(--color-5c3a1e)", margin: 0 };
const userList = { display: "flex", flexDirection: "column", gap: "8px" };
const userRow = { border: "1px solid var(--color-eddfc8)", borderRadius: "10px", background: "var(--color-fdf8f3)", overflow: "hidden" };
const userBtn = { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "sans-serif" };
const userName = { fontSize: "14px", color: "var(--color-3d2200)", fontWeight: "bold" };
const userMeta = { fontSize: "12px", color: "var(--color-9b7040)", whiteSpace: "nowrap" };
const pageList = { listStyle: "none", margin: 0, padding: "0 14px 12px", display: "flex", flexDirection: "column", gap: "6px" };
const pageItem = { display: "flex", justifyContent: "space-between", fontSize: "13px", fontFamily: "sans-serif", color: "var(--color-5c3a1e)" };
const pageCount = { color: "var(--color-9b7040)" };

const aiHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "6px" };
const aiPeriodRow = { display: "flex", gap: "6px" };
const aiPeriodBtn = { padding: "6px 14px", borderRadius: "999px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)", color: "var(--color-7a4f10)", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer" };
const aiPeriodBtnActive = { background: "linear-gradient(135deg, var(--color-c97c2e), var(--color-a85e18))", color: "var(--color-fff8ee)", border: "none" };
const aiGenerateBtn = { padding: "10px 18px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, var(--color-c97c2e) 0%, var(--color-a85e18) 100%)", color: "var(--color-fff8ee)", fontSize: "13px", fontWeight: "600", fontFamily: "sans-serif", cursor: "pointer", boxShadow: "0 3px 10px rgba(160,80,20,0.25)" };
const aiError = { color: "var(--color-b3432c)", fontSize: "13px", fontFamily: "sans-serif", margin: "12px 0 0" };
const aiResult = { marginTop: "16px", padding: "16px 18px", borderRadius: "12px", background: "var(--color-fdf8f3)", border: "1px solid var(--color-eddfc8)" };
const aiParagraph = { fontSize: "14px", lineHeight: 1.65, color: "var(--color-3d2200)", fontFamily: "sans-serif", margin: "0 0 10px" };
const aiMeta = { fontSize: "11px", color: "var(--color-9b7040)", fontFamily: "sans-serif", margin: "4px 0 0" };
