import { useEffect, useState } from "react";
import { db } from "../../firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";

export default function Dashboard() {
  const [totalUsers, setTotalUsers] = useState(0);
  const [newUsersToday, setNewUsersToday] = useState(0);
  const [totalAudio, setTotalAudio] = useState(0);
  const [latestUpload, setLatestUpload] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const usersSnapshot = await getDocs(collection(db, "users"));
        const users = usersSnapshot.docs.map((doc) => doc.data());
        setTotalUsers(users.length);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const newToday = users.filter((u) => u.createdAt && u.createdAt.toDate() >= today);
        setNewUsersToday(newToday.length);

        const audioSnapshot = await getDocs(collection(db, "audio"));
        setTotalAudio(audioSnapshot.size);

        const latestQuery = query(collection(db, "audio"), orderBy("createdAt", "desc"), limit(1));
        const latestSnapshot = await getDocs(latestQuery);
        if (!latestSnapshot.empty) setLatestUpload(latestSnapshot.docs[0].data());
      } catch (error) {
        console.error("Dashboard error:", error);
      }
    };
    fetchStats();
  }, []);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Welcome back — here's what's happening." />

      <div style={grid}>
        <StatCard icon="👥" label="Total Users" value={totalUsers} color="#c97c2e" />
        <StatCard icon="✨" label="New Users Today" value={newUsersToday} color="#16a34a" />
        <StatCard icon="🎙️" label="Audio Files" value={totalAudio} color="#2563eb" />
        <StatCard
          icon="🕐"
          label="Latest Upload"
          value={latestUpload ? latestUpload.title : "None"}
          small
          color="#7c3aed"
        />
      </div>

      <div style={quickLinks}>
        <p style={quickLinksLabel}>Quick actions</p>
        <div style={quickLinksRow}>
          {[
            { href: "/admin/upload", icon: "🎙️", label: "Upload Audio" },
            { href: "/admin/notices", icon: "📌", label: "Post a Notice" },
            { href: "/admin/users", icon: "👥", label: "Manage Users" },
            { href: "/admin/analytics", icon: "📈", label: "View Analytics" },
          ].map(({ href, icon, label }) => (
            <a key={href} href={href} style={quickLink}>
              <span style={{ fontSize: "22px" }}>{icon}</span>
              <span style={quickLinkLabel}>{label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color, small }) {
  return (
    <div style={statCard}>
      <div style={{ ...statIconWrap, background: color + "18", color }}>
        {icon}
      </div>
      <div style={statLabel}>{label}</div>
      <div style={{ ...statValue, fontSize: small ? "16px" : "32px" }}>{value}</div>
    </div>
  );
}

function PageHeader({ title, subtitle }) {
  return (
    <div style={pageHeader}>
      <h1 style={pageTitle}>{title}</h1>
      {subtitle && <p style={pageSubtitle}>{subtitle}</p>}
    </div>
  );
}

// Shared exports for reuse
export { PageHeader };

const pageHeader = { marginBottom: "28px" };
const pageTitle = { fontSize: "26px", fontWeight: "normal", color: "#3d2200", margin: "0 0 4px" };
const pageSubtitle = { fontSize: "14px", color: "#9b7040", fontFamily: "sans-serif", margin: 0 };

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "16px",
  marginBottom: "32px",
};

const statCard = {
  background: "#fffdf9",
  border: "1px solid #eddfc8",
  borderRadius: "16px",
  padding: "20px",
  boxShadow: "0 2px 12px rgba(160,100,40,0.07)",
};

const statIconWrap = {
  width: "40px",
  height: "40px",
  borderRadius: "10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "20px",
  marginBottom: "12px",
};

const statLabel = {
  fontSize: "12px",
  fontFamily: "sans-serif",
  color: "#9b7040",
  marginBottom: "4px",
  letterSpacing: "0.04em",
};

const statValue = {
  fontWeight: "bold",
  color: "#3d2200",
  fontFamily: "sans-serif",
  lineHeight: 1.2,
  wordBreak: "break-word",
};

const quickLinks = {
  background: "#fffdf9",
  border: "1px solid #eddfc8",
  borderRadius: "16px",
  padding: "20px 24px",
};

const quickLinksLabel = {
  fontSize: "11px",
  fontFamily: "sans-serif",
  color: "#b08050",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  margin: "0 0 14px",
};

const quickLinksRow = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
};

const quickLink = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "10px 16px",
  borderRadius: "10px",
  border: "1px solid #eddfc8",
  background: "#fdf8f3",
  textDecoration: "none",
  color: "#5c3a1e",
};

const quickLinkLabel = {
  fontSize: "13px",
  fontFamily: "sans-serif",
  color: "#5c3a1e",
};