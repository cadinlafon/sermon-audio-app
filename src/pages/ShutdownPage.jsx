import { useState } from "react";
import { useNavigate } from "react-router-dom";

function ShutdownPage({ message, returnDate }) {
  const navigate = useNavigate();
  const [clickCount, setClickCount] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);

  const handleLogoClick = () => {
    const now = Date.now();
    if (now - lastClickTime < 2000) {
      const newCount = clickCount + 1;
      setClickCount(newCount);
      if (newCount >= 5) navigate("/admin-access");
    } else {
      setClickCount(1);
    }
    setLastClickTime(now);
  };

  let formattedDate = "Soon";
  if (returnDate && returnDate.seconds) {
    formattedDate = new Date(returnDate.seconds * 1000).toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <div style={page}>

      {/* LOGO */}
      <img
        src="/icons/icon-192.png"
        alt="Palouse Fellowship"
        onClick={handleLogoClick}
        style={logo}
      />

      {/* ICON + TITLE */}
      <div style={iconRing}>
        <span style={wrenchIcon}>🔧</span>
      </div>

      <h1 style={title}>Down for Maintenance</h1>

      <p style={subtitle}>
        {message || "We're making some improvements. We'll be back shortly."}
      </p>

      {/* RETURN DATE CARD */}
      <div style={dateCard}>
        <p style={dateLabel}>Expected return</p>
        <p style={dateValue}>{formattedDate}</p>
      </div>

      <p style={footerNote}>
        Questions? Contact{" "}
        <a href="mailto:cadinlafon@gmail.com" style={footerLink}>
          cadinlafon@gmail.com
        </a>
      </p>

    </div>
  );
}

export default ShutdownPage;

//////////////////////////////////////////////////
// STYLES
//////////////////////////////////////////////////

const page = {
  background: "#fdf8f3",
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "48px 24px",
  fontFamily: "'Georgia', serif",
  textAlign: "center",
};

const logo = {
  width: "64px",
  height: "64px",
  borderRadius: "16px",
  marginBottom: "28px",
  cursor: "pointer",
  opacity: 0.85,
};

const iconRing = {
  width: "80px",
  height: "80px",
  borderRadius: "50%",
  background: "linear-gradient(135deg, #e08930 0%, #a85e18 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "24px",
  boxShadow: "0 6px 22px rgba(160,80,20,0.28)",
};

const wrenchIcon = {
  fontSize: "34px",
  lineHeight: 1,
};

const title = {
  fontSize: "clamp(22px, 5vw, 30px)",
  fontWeight: "normal",
  color: "#3d2200",
  margin: "0 0 12px",
};

const subtitle = {
  fontSize: "16px",
  color: "#9b7040",
  fontFamily: "sans-serif",
  lineHeight: 1.7,
  maxWidth: "400px",
  margin: "0 0 32px",
};

const dateCard = {
  background: "#fffdf9",
  border: "1px solid #eddfc8",
  borderRadius: "16px",
  padding: "20px 32px",
  marginBottom: "32px",
  boxShadow: "0 2px 12px rgba(160,100,40,0.07)",
};

const dateLabel = {
  margin: "0 0 6px",
  fontSize: "11px",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#b08050",
  fontFamily: "sans-serif",
};

const dateValue = {
  margin: 0,
  fontSize: "18px",
  color: "#3d2200",
};

const footerNote = {
  fontSize: "13px",
  color: "#b08050",
  fontFamily: "sans-serif",
};

const footerLink = {
  color: "#c97c2e",
  textDecoration: "none",
};