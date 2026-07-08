import { useState, useEffect } from "react";

export default function Feedback() {
  const [activeTab, setActiveTab] = useState("review");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div style={page}>
      {/* Tab Bar */}
      <div style={tabBar}>
        {[
          { id: "review", label: "App Review" },
          { id: "feedback", label: "Feedback" },
          { id: "suggest", label: "Suggest Feature" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={activeTab === tab.id ? activeTabBtn : tabBtn}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <h1 style={pageTitle}>
        {activeTab === "review" && "App Review"}
        {activeTab === "feedback" && "Share Your Feedback"}
        {activeTab === "suggest" && "Suggest a Feature"}
      </h1>

      <p style={pageSubtitle}>
        {activeTab === "review" && "We'd love to hear what you think. Your review helps us improve."}
        {activeTab === "feedback" && "Have something to share? We're listening."}
        {activeTab === "suggest" && "Got an idea? Tell us what you'd like to see."}
      </p>

      <div style={card}>
        {activeTab === "review" && (
          <iframe
            id="LovableIFrame-feedback"
            title="Palouse Fellowship Audio App - Review"
            allow="geolocation; microphone; camera; fullscreen; payment"
            src="https://pf-feedback.lovable.app"
            style={{
              width: "100%",
              height: "750px",
              border: "none",
              borderRadius: "8px",
            }}
          />
        )}

        {(activeTab === "feedback" || activeTab === "suggest") && (
          <div style={notInstalledBox}>
            <div style={notInstalledIcon}>🛠</div>
            <p style={notInstalledTitle}>Form Not Installed Yet</p>
            <p style={notInstalledSub}>
              This form hasn't been set up yet. Check back soon!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const page = {
  padding: "32px 20px 60px",
  maxWidth: "860px",
  margin: "0 auto",
  background: "#fdf8f3",
  minHeight: "100vh",
  fontFamily: "'Georgia', serif",
  textAlign: "center",
};

const tabBar = {
  display: "flex",
  gap: "6px",
  background: "#fffdf9",
  border: "1px solid #eddfc8",
  borderRadius: "14px",
  padding: "6px",
  marginBottom: "28px",
  boxShadow: "0 1px 6px rgba(160,100,40,0.06)",
};

const tabBtn = {
  flex: 1,
  padding: "9px 12px",
  border: "none",
  borderRadius: "10px",
  background: "transparent",
  color: "#9b7040",
  fontFamily: "'Georgia', serif",
  fontSize: "14px",
  cursor: "pointer",
  transition: "background 0.15s, color 0.15s",
};

const activeTabBtn = {
  ...tabBtn,
  background: "#3d2200",
  color: "#fdf8f3",
};

const pageTitle = {
  fontSize: "28px",
  fontWeight: "normal",
  color: "#3d2200",
  marginBottom: "8px",
};

const pageSubtitle = {
  color: "#9b7040",
  fontFamily: "sans-serif",
  fontSize: "15px",
  marginBottom: "28px",
};

const card = {
  background: "#fffdf9",
  borderRadius: "18px",
  border: "1px solid #eddfc8",
  boxShadow: "0 2px 14px rgba(160,100,40,0.07)",
  padding: "16px",
  overflow: "hidden",
};

const notInstalledBox = {
  padding: "60px 20px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "10px",
};

const notInstalledIcon = {
  fontSize: "36px",
  marginBottom: "4px",
};

const notInstalledTitle = {
  fontSize: "18px",
  color: "#3d2200",
  fontFamily: "'Georgia', serif",
  margin: 0,
};

const notInstalledSub = {
  fontSize: "14px",
  color: "#9b7040",
  fontFamily: "sans-serif",
  margin: 0,
};