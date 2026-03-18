import { Link, Outlet } from "react-router-dom";

export default function AdminLayout() {
return (
<div style={{ display: "flex", minHeight: "100vh" }}>

{/* Sidebar */}

<div
style={{
width: "260px",
background: "#111827",
color: "white",
padding: "25px",
}}
>

<h2 style={{ marginBottom: "35px", fontSize: "22px" }}>
Admin Panel
</h2>

<nav style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

<Link to="/admin/dashboard" style={linkStyle}>Dashboard</Link>

<Link to="/admin/upload" style={linkStyle}>Upload Audio</Link>

<Link to="/admin/users" style={linkStyle}>Users</Link>

<Link to="/admin/analytics" style={linkStyle}>Analytics</Link>

<Link to="/admin/content" style={linkStyle}>Content Manager</Link>

<Link to="/admin/notifications" style={linkStyle}>Notifications</Link>

<Link to="/admin/settings" style={linkStyle}>Settings</Link>

<Link to="/admin/logs" style={linkStyle}>Logs</Link>

</nav>

</div>

{/* Main Content */}

<div
style={{
flex: 1,
padding: "40px",
background: "#f3f4f6",
}}
>
<Outlet />
</div>

</div>
);
}

const linkStyle = {
display: "block",
padding: "12px 16px",
fontSize: "17px",
fontWeight: "600",
color: "white",
textDecoration: "none",
border: "2px solid #374151",
borderRadius: "8px",
background: "#1f2937",
textAlign: "center",
cursor: "pointer",
};