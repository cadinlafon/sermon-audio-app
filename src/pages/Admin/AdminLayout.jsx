import { useState } from "react";
import UploadAudio from "./AdminGate";
import AdminNotifications from "./AdminNotifications"; // if you have one

export default function AdminLayout() {
  const [activeTab, setActiveTab] = useState("upload");

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      
      {/* Sidebar */}
      <div
        style={{
          width: "220px",
          background: "#111",
          color: "#fff",
          padding: "20px",
        }}
      >
        <h2 style={{ marginBottom: "30px" }}>Admin</h2>

        <div
          style={tabStyle(activeTab === "upload")}
          onClick={() => setActiveTab("upload")}
        >
          Upload Audio
        </div>

        <div
          style={tabStyle(activeTab === "notifications")}
          onClick={() => setActiveTab("notifications")}
        >
          Notifications
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          background: "#f4f4f4",
          padding: "40px",
        }}
      >
        {activeTab === "upload" && <UploadAudio />}
        {activeTab === "notifications" && <AdminNotifications />}
      </div>
    </div>
  );
}

const tabStyle = (active) => ({
  padding: "10px",
  marginBottom: "10px",
  cursor: "pointer",
  background: active ? "#333" : "transparent",
  borderRadius: "6px",
});