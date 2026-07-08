import { useEffect, useState } from "react";
import { db } from "../../firebase";
import { collection, getDocs } from "firebase/firestore";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function Analytics() {
  const [stats, setStats] = useState({ totalUsers:0, newUsers:0, totalUploads:0, minutesPlayed:0, totalListens:0, usesWeb:0, usesPWA:0, pwaIphone:0, pwaAndroid:0, pwaDesktop:0 });
  const [monthlyActivity, setMonthlyActivity] = useState([]);

  const getWeekRange = () => {
    const now = new Date();
    const start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0,0,0,0);
    const end = new Date(start); end.setDate(start.getDate() + 7);
    return { start, end };
  };

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const [usersSnap, audioSnap, usageSnap, logsSnap] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "audio")),
          getDocs(collection(db, "appUsage")),
          getDocs(collection(db, "logs")),
        ]);
        const users = usersSnap.docs.map(d => d.data());
        const usage = usageSnap.docs.map(d => d.data());
        const logs = logsSnap.docs.map(d => d.data());
        const { start, end } = getWeekRange();

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
      } catch (err) { console.error("Analytics error:", err); }
    };
    fetchAnalytics();
  }, []);

  const maxCount = Math.max(...monthlyActivity.map(m => m.count), 1);

  return (
    <div style={page}>
      <div style={pageHeader}>
        <h1 style={pageTitle}>Analytics</h1>
        <p style={pageSubtitle}>Usage stats for the current week.</p>
      </div>

      <div style={grid}>
        <StatCard icon="👥" label="Total Users" value={stats.totalUsers} color="#c97c2e" />
        <StatCard icon="✨" label="New Users This Week" value={stats.newUsers} color="#16a34a" />
        <StatCard icon="🎙️" label="Total Uploads" value={stats.totalUploads} color="#2563eb" />
        <StatCard icon="🎧" label="Listens This Week" value={stats.totalListens} color="#7c3aed" />
        <StatCard icon="⏱️" label="Minutes Played" value={stats.minutesPlayed} color="#db2777" />
        <StatCard icon="🌐" label="Web Opens" value={stats.usesWeb} color="#0891b2" />
        <StatCard icon="📱" label="PWA Installs" value={stats.usesPWA} color="#65a30d" />
        <StatCard icon="🍎" label="PWA on iPhone" value={stats.pwaIphone} color="#dc2626" />
        <StatCard icon="🤖" label="PWA on Android" value={stats.pwaAndroid} color="#16a34a" />
        <StatCard icon="💻" label="PWA on Desktop" value={stats.pwaDesktop} color="#6d28d9" />
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
const pageTitle = { fontSize: "26px", fontWeight: "normal", color: "#3d2200", margin: "0 0 4px", fontFamily: "'Georgia', serif" };
const pageSubtitle = { fontSize: "14px", color: "#9b7040", fontFamily: "sans-serif", margin: 0 };
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "28px" };
const statCard = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "14px", padding: "18px", boxShadow: "0 2px 10px rgba(160,100,40,0.06)" };
const iconWrap = { width: "36px", height: "36px", borderRadius: "9px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", marginBottom: "10px" };
const statLabel = { fontSize: "11px", fontFamily: "sans-serif", color: "#9b7040", marginBottom: "4px", letterSpacing: "0.04em" };
const statValue = { fontSize: "28px", fontWeight: "bold", color: "#3d2200", fontFamily: "sans-serif" };

const chartCard = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "16px", padding: "24px", boxShadow: "0 2px 12px rgba(160,100,40,0.07)" };
const chartTitle = { fontSize: "17px", fontWeight: "normal", color: "#5c3a1e", fontFamily: "'Georgia', serif", margin: "0 0 20px" };
const chartArea = { display: "flex", alignItems: "flex-end", gap: "12px", height: "200px" };
const barWrapper = { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" };
const bar = { width: "100%", maxWidth: "48px", background: "linear-gradient(180deg, #e08930, #c97c2e)", borderRadius: "6px 6px 0 0" };
const barValue = { fontSize: "12px", fontFamily: "sans-serif", color: "#7a4f10", fontWeight: "bold", marginBottom: "4px" };
const barLabel = { fontSize: "11px", fontFamily: "sans-serif", color: "#9b7040", marginTop: "6px", textAlign: "center" };