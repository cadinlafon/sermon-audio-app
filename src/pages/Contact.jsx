import React from "react";

export default function Contact() {
  return (
    <div style={page}>
      <h1 style={pageTitle}>Get in Touch</h1>
      <p style={pageSubtitle}>We'd love to hear from you.</p>

      {/* CHURCH */}
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardIcon}>⛪</span>
          <h2 style={cardTitle}>Church</h2>
        </div>

        <div style={row}>
          <span style={label}>Name</span>
          <span style={value}>Jonathan Mcintosh</span>
        </div>
        <div style={divider} />

        <div style={row}>
          <span style={label}>Email</span>
          <span style={value}>jonathan@palousefellowship.com</span>
        </div>
        <div style={divider} />

        <div style={row}>
          <span style={label}>Phone</span>
          <span style={value}>Email for phone*</span>
        </div>
        <div style={divider} />

        <div style={row}>
          <span style={label}>For</span>
          <span style={value}>Sermons, events, and church activities</span>
        </div>

        <button
          style={emailButton}
          onClick={() => (window.location.href = "mailto:jonathan@palousefellowship.com")}
        >
          ✉ Send Email
        </button>
      </div>

      {/* APP SUPPORT */}
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardIcon}>🛠️</span>
          <h2 style={cardTitle}>App Support</h2>
        </div>

        <div style={row}>
          <span style={label}>Name</span>
          <span style={value}>Cadin LaFon</span>
        </div>
        <div style={divider} />

        <div style={row}>
          <span style={label}>Email</span>
          <span style={value}>Cadinlafon@gmail.com</span>
        </div>
        <div style={divider} />

        <div style={row}>
          <span style={label}>Phone</span>
          <span style={value}>Email for phone*</span>
        </div>
        <div style={divider} />

        <div style={row}>
          <span style={label}>For</span>
          <span style={value}>Technical issues and feature requests</span>
        </div>

        <button
          style={emailButton}
          onClick={() => (window.location.href = "mailto:Cadinlafon@gmail.com")}
        >
          ✉ Send Email
        </button>
      </div>

      <p style={footerNote}>
        * Phone numbers are not listed publicly to avoid spam. Email us and we'll get back to you as soon as possible.
      </p>
    </div>
  );
}

const page = {
  padding: "32px 20px 60px",
  maxWidth: "680px",
  margin: "0 auto",
  background: "#fdf8f3",
  minHeight: "100vh",
  fontFamily: "'Georgia', serif",
};

const pageTitle = {
  textAlign: "center",
  fontSize: "28px",
  fontWeight: "normal",
  color: "#3d2200",
  marginBottom: "6px",
};

const pageSubtitle = {
  textAlign: "center",
  color: "#9b7040",
  fontFamily: "sans-serif",
  fontSize: "15px",
  marginBottom: "32px",
};

const card = {
  background: "#fffdf9",
  borderRadius: "18px",
  padding: "22px 24px 18px",
  marginBottom: "20px",
  border: "1px solid #eddfc8",
  boxShadow: "0 2px 14px rgba(160,100,40,0.07)",
};

const cardHeader = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  marginBottom: "18px",
  paddingBottom: "14px",
  borderBottom: "1px solid #eddfc8",
};

const cardIcon = {
  fontSize: "20px",
};

const cardTitle = {
  margin: 0,
  fontSize: "17px",
  fontWeight: "normal",
  color: "#5c3a1e",
};

const row = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  padding: "10px 0",
  gap: "12px",
  flexWrap: "wrap",
};

const divider = {
  height: "1px",
  background: "#f0e4d0",
};

const label = {
  fontFamily: "sans-serif",
  fontSize: "12px",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#b08050",
  flexShrink: 0,
  paddingTop: "1px",
};

const value = {
  color: "#3d2200",
  fontFamily: "sans-serif",
  fontSize: "14px",
  textAlign: "right",
};

const emailButton = {
  marginTop: "18px",
  width: "100%",
  padding: "13px",
  borderRadius: "12px",
  border: "none",
  background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)",
  color: "#fff8ee",
  cursor: "pointer",
  fontSize: "15px",
  fontFamily: "sans-serif",
  boxShadow: "0 4px 14px rgba(160,80,20,0.28)",
  letterSpacing: "0.02em",
};

const footerNote = {
  textAlign: "center",
  fontSize: "12px",
  color: "#b08050",
  fontFamily: "sans-serif",
  lineHeight: 1.6,
  marginTop: "10px",
  fontStyle: "italic",
};