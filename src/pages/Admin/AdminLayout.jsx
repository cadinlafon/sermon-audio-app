import { Outlet, Link, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase";
import { useState } from "react";

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = "/";
  };

  const linkStyle = (path) => ({
    display: "block",
    padding: "10px 15px",
    marginBottom: "8px",
    borderRadius: "6px",
    textDecoration: "none",
    color: location.pathname === path || location.pathname.includes(path)
      ? "white"
      : "#ddd",
    background:
      location.pathname === path || location.pathname.includes(path)
        ? "#333"
        : "transparent",
  });

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <div
        style={{
          width: "230px",
          background: "#1e1e1e",
          color: "white",
          padding: "20px",
        }}
      >
        <h3 style={{ marginBottom: "25px" }}>Admin Panel</h3>

        {/* Dashboard */}
        <Link to="/admin" style={linkStyle("/admin")}>
          Dashboard
        </Link>

        <Link to="upload" style={linkStyle("upload")}>
          Upload Audio
        </Link>

        <Link to="users" style={linkStyle("users")}>
          Users
        </Link>

        <Link to="notifications" style={linkStyle("notifications")}>
          Notifications
        </Link>

        <Link to="analytics" style={linkStyle("analytics")}>
          Analytics
        </Link>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1 }}>
        {/* Top Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            padding: "15px 30px",
            background: "#f5f5f5",
            borderBottom: "1px solid #ddd",
          }}
        >
          <div style={{ position: "relative" }}>
            <div
              onClick={() => setOpen(!open)}
              style={{
                cursor: "pointer",
                width: "35px",
                height: "35px",
                borderRadius: "50%",
                background: "#555",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: "bold",
              }}
            >
              👤
            </div>

            {open && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "45px",
                  background: "white",
                  padding: "10px",
                  borderRadius: "8px",
                  boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
                }}
              >
                <button
                  onClick={handleLogout}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "5px 10px",
                  }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Page Content */}
        <div style={{ padding: "30px" }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}