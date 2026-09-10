////////////////////////////////////////////////////////////////
// Shared styling for the Page Manager route-guard screens
// (Locked, Maintenance, Coming Soon, Access Denied, Disabled).
// Mirrors the look of ShutdownPage / NotFound.
////////////////////////////////////////////////////////////////

export const page = {
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

export const iconRing = (colors = {}) => ({
  width: "80px",
  height: "80px",
  borderRadius: "50%",
  background: colors.background || "linear-gradient(135deg, #e08930 0%, #a85e18 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "24px",
  boxShadow: "0 6px 22px rgba(160,80,20,0.28)",
});

export const icon = {
  fontSize: "34px",
  lineHeight: 1,
};

export const title = {
  fontSize: "clamp(22px, 5vw, 30px)",
  fontWeight: "normal",
  color: "#3d2200",
  margin: "0 0 12px",
};

export const subtitle = {
  fontSize: "16px",
  color: "#9b7040",
  fontFamily: "sans-serif",
  lineHeight: 1.7,
  maxWidth: "420px",
  margin: "0 0 32px",
};

export const infoCard = {
  background: "#fffdf9",
  border: "1px solid #eddfc8",
  borderRadius: "16px",
  padding: "20px 32px",
  marginBottom: "32px",
  boxShadow: "0 2px 12px rgba(160,100,40,0.07)",
};

export const infoLabel = {
  margin: "0 0 6px",
  fontSize: "11px",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#b08050",
  fontFamily: "sans-serif",
};

export const infoValue = {
  margin: 0,
  fontSize: "18px",
  color: "#3d2200",
};

export const homeButton = {
  padding: "12px 24px",
  borderRadius: "999px",
  border: "none",
  background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)",
  color: "#fff8ee",
  cursor: "pointer",
  fontSize: "14px",
  fontFamily: "sans-serif",
  boxShadow: "0 3px 12px rgba(160,80,20,0.28)",
};

export function formatDate(value) {
  if (!value) return null;
  const d = typeof value.toDate === "function"
    ? value.toDate()
    : typeof value.seconds === "number"
    ? new Date(value.seconds * 1000)
    : new Date(value);

  if (isNaN(d.getTime())) return null;

  return d.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateOnly(value) {
  if (!value) return null;
  const d = typeof value.toDate === "function"
    ? value.toDate()
    : typeof value.seconds === "number"
    ? new Date(value.seconds * 1000)
    : new Date(value);

  if (isNaN(d.getTime())) return null;

  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
