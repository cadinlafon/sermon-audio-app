import { Link, Outlet, useLocation } from "react-router-dom";
import { usePermissions } from "../../hooks/usePermissions";
import { ADMIN_MODULES, NO_ACCESS_MESSAGE } from "../../config/adminModules";
import { AdminPinProvider, useAdminPin } from "../../context/AdminPinContext";
import useAdminIdleTimeout from "../../hooks/useAdminIdleTimeout";
import { useAnalyticsPages } from "../../utils/analyticsPages";
import { useUnseenReportCount } from "../../utils/problemReports";

export default function AdminLayout() {
  useAdminIdleTimeout();

  return (
    <AdminPinProvider>
      <AdminShell />
    </AdminPinProvider>
  );
}

function AdminShell() {
  const location = useLocation();
  const { canView } = usePermissions();
  const pin = useAdminPin();
  const analyticsPages = useAnalyticsPages();
  // Red dot on the Reports button while any problem report hasn't been opened.
  const unseenReports = useUnseenReportCount(canView("reports"));
  const navLinks = ADMIN_MODULES.map((m) => ({
    to: `/admin/${m.path}`,
    label: m.label,
    icon: m.icon,
    accessible: canView(m.key),
  }));

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
          {navLinks.map(({ to, label, icon, accessible }) => {
            const active = accessible && location.pathname.startsWith(to);

            const isAnalytics = to === "/admin/analytics";
            // On Analytics the sidebar opens its sub-pages: the built-in App
            // page plus the external dashboards set up in Admin → Advanced.
            const showSub = isAnalytics && active;

            return (
              <div key={to}>
                <Link
                  to={to}
                  title={accessible ? undefined : NO_ACCESS_MESSAGE}
                  style={!accessible ? { ...link, ...linkDisabled } : active && !showSub ? { ...link, ...linkActive } : showSub ? { ...link, color: "var(--color-fde8b8)" } : link}
                  aria-expanded={isAnalytics ? showSub : undefined}
                >
                  <span style={linkIcon}>{icon}</span>
                  <span>{label}</span>

                  {isAnalytics ? <span style={chevron} aria-hidden="true">{showSub ? "▾" : "▸"}</span> : to === "/admin/reports" && unseenReports > 0 ? <span style={unseenDot} role="status" aria-label={`${unseenReports} unopened ${unseenReports === 1 ? "report" : "reports"}`} /> : active && <span style={activeDot} />}
                </Link>

                {showSub && (
                  <div style={subNav}>
                    <Link to={to} style={{ ...subLink, ...subLinkActive }}>App</Link>
                    {analyticsPages.map((p) => (
                      <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" style={subLink}>
                        {p.label}
                        <span style={externalMark} aria-hidden="true">↗</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {pin?.pinEnabled && (
          <button onClick={pin.lockNow} style={lockNowBtn}>
            🔒 Lock Admin
          </button>
        )}

        <Link to="/" style={backToApp}>
          ← Back to App
        </Link>
      </aside>

      {/* MAIN CONTENT */}
      <main style={main}>
        <Outlet />
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

const shell = {
  display: "flex",
  minHeight: "100vh",
  fontFamily: "'Georgia', serif",
};

const sidebar = {
  width: "240px",
  flexShrink: 0,
  background: "linear-gradient(180deg, var(--color-3d2000) 0%, var(--color-2a1500) 100%)",
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
  background: "linear-gradient(135deg, var(--color-e08930), var(--color-c97c2e))",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold",
  fontSize: "14px",
  color: "var(--color-fff8ee)",
  flexShrink: 0,
};

const brandName = {
  fontSize: "13px",
  color: "var(--color-fff8ee)",
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
  color: "var(--color-fde8b8)",
};

const linkDisabled = {
  color: "rgba(255,220,160,0.28)",
  cursor: "not-allowed",
};

const chevron = {
  marginLeft: "auto",
  fontSize: "11px",
  opacity: 0.7,
};

// The sub-pages sit further in, with a guide line, so they read as part of Analytics.
const subNav = {
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  margin: "2px 0 4px 22px",
  paddingLeft: "10px",
  borderLeft: "1px solid rgba(255,220,160,0.22)",
};

const subLink = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "7px 10px",
  borderRadius: "8px",
  fontSize: "12.5px",
  color: "rgba(255,220,160,0.7)",
  textDecoration: "none",
  fontFamily: "sans-serif",
};

const subLinkActive = {
  background: "rgba(224,137,48,0.18)",
  color: "var(--color-fde8b8)",
};

const externalMark = {
  marginLeft: "auto",
  fontSize: "11px",
  opacity: 0.6,
};

const linkIcon = {
  fontSize: "16px",
  width: "20px",
  textAlign: "center",
};

const unseenDot = {
  marginLeft: "auto",
  minWidth: "9px",
  height: "9px",
  borderRadius: "50%",
  background: "var(--color-dc2626)",
  boxShadow: "0 0 0 2px rgba(239,68,68,0.28)",
};

const activeDot = {
  marginLeft: "auto",
  width: "6px",
  height: "6px",
  borderRadius: "50%",
  background: "var(--color-e08930)",
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

const lockNowBtn = {
  display: "block",
  width: "calc(100% - 24px)",
  margin: "12px 12px 0",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid rgba(255,220,160,0.15)",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,220,160,0.75)",
  fontSize: "12px",
  fontFamily: "sans-serif",
  cursor: "pointer",
  textAlign: "left",
};

const main = {
  flex: 1,
  background: "var(--color-fdf8f3)",
  padding: "36px 40px 60px",
  overflowY: "auto",
};