import { Link, Outlet } from "react-router-dom";

export default function AdminLayout() {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      
      {/* Sidebar */}
      <div
        style={{
          width: "250px",
          background: "#111827",
          color: "white",
          padding: "20px",
        }}
      >
        <h2 style={{ marginBottom: "30px" }}>Admin Panel</h2>

        <nav style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <Link to="/admin/dashboard" style={linkStyle}>Dashboard</Link>
          <Link to="/admin/upload" style={linkStyle}>Upload</Link>
          <Link to="/admin/users" style={linkStyle}>Users</Link>
          <Link to="/admin/analytics" style={linkStyle}>Analytics</Link>
          <Link to="/admin/content" style={linkStyle}>Content Manager</Link>
          <Link to="/admin/notifications" style={linkStyle}>Notifications</Link>
          <Link to="/admin/settings" style={linkStyle}>Settings</Link>
          <Link to="/admin/logs" style={linkStyle}>Logs</Link>
        </nav>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: "40px", background: "#f3f4f6" }}>
        <Outlet />
      </div>
    </div>
  );
}

const linkStyle = {
  color: "white",
  textDecoration: "none",
  fontWeight: "500",
};