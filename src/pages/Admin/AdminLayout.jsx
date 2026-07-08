import { Link, Outlet, useLocation } from "react-router-dom";

const navLinks = [
  { to: "/admin/dashboard",     label: "Dashboard",        icon: "📊" },
  { to: "/admin/upload",        label: "Upload Audio",     icon: "🎙️" },
  { to: "/admin/content",       label: "Content Manager",  icon: "📂" },
  { to: "/admin/users",         label: "Users",            icon: "👥" },
  { to: "/admin/analytics",     label: "Analytics",        icon: "📈" },
  { to: "/admin/notifications", label: "Notifications",    icon: "🔔" },
  { to: "/admin/send-notifications", label: "Send Push",       icon: "📣" },
  { to: "/admin/notices",       label: "Notices",          icon: "📌" },
  { to: "/admin/pagenotices",   label: "Page Notices",     icon: "📄" },
  { to: "/admin/suggestions",   label: "Suggestions",      icon: "💡" },
  { to: "/admin/logs",          label: "Logs",             icon: "📋" },
  { to: "/admin/settings",      label: "Settings",         icon: "⚙️" },
];

export default function AdminLayout() {
  const location = useLocation();

  return (
    <div style={shell}>
      {/* SIDEBAR */}
      <aside style={sidebar}>
        <div style={sidebarTop}>
          <div style={brandMark}>PF</div>
          <div>
            <div style={brandName}>Palouse Fellowship</div>
            <div style={brandSub}>Admin Panel</div>
          </div>
        </div>

        <nav style={nav}>
          {navLinks.map(({ to, label, icon }) => {
            const active = location.pathname.startsWith(to);
            return (
              <Link key={to} to={to} style={active ? { ...link, ...linkActive } : link}>
                <span style={linkIcon}>{icon}</span>
                <span>{label}</span>
                {active && <span style={activeDot} />}
              </Link>
            );
          })}
        </nav>

        <Link to="/" style={backToApp}>← Back to App</Link>
      </aside>

      {/* MAIN */}
      <main style={main}>
        <Outlet />
      </main>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────
const shell = {
  display: "flex",
  minHeight: "100vh",
  fontFamily: "'Georgia', serif",
};

const sidebar = {
  width: "240px",
  flexShrink: 0,
  background: "linear-gradient(180deg, #3d2000 0%, #2a1500 100%)",
  display: "flex",
  flexDirection: "column",
  padding: "0",
  position: "sticky",
  top: 0,
  height: "100vh",
  overflowY: "auto",
};

const sidebarTop = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "24px 20px 20px",
  borderBottom: "1px solid rgba(255,220,160,0.12)",
  marginBottom: "12px",
};

const brandMark = {
  width: "38px",
  height: "38px",
  borderRadius: "10px",
  background: "linear-gradient(135deg, #e08930, #c97c2e)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold",
  fontSize: "14px",
  color: "#fff8ee",
  flexShrink: 0,
};

const brandName = {
  fontSize: "13px",
  color: "#fff8ee",
  fontWeight: "normal",
  lineHeight: 1.2,
};

const brandSub = {
  fontSize: "10px",
  color: "rgba(255,210,140,0.55)",
  fontFamily: "sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const nav = {
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  padding: "0 12px",
  flex: 1,
};

const link = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "10px 12px",
  borderRadius: "10px",
  fontSize: "13px",
  color: "rgba(255,220,160,0.7)",
  textDecoration: "none",
  fontFamily: "sans-serif",
  transition: "background 0.15s",
  position: "relative",
};

const linkActive = {
  background: "rgba(224,137,48,0.18)",
  color: "#fde8b8",
};

const linkIcon = {
  fontSize: "16px",
  width: "20px",
  textAlign: "center",
};

const activeDot = {
  marginLeft: "auto",
  width: "6px",
  height: "6px",
  borderRadius: "50%",
  background: "#e08930",
};

const backToApp = {
  display: "block",
  padding: "16px 20px",
  fontSize: "12px",
  fontFamily: "sans-serif",
  color: "rgba(255,210,140,0.45)",
  textDecoration: "none",
  borderTop: "1px solid rgba(255,220,160,0.1)",
  marginTop: "auto",
};

const main = {
  flex: 1,
  background: "#fdf8f3",
  padding: "36px 40px 60px",
  overflowY: "auto",
};
