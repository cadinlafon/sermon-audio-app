import Account from "./Account";

export default function Settings() {
  return (
    <div style={pageWrapper}>
      <div style={contentArea}>
        <div style={pageHeader}>
          <h1 style={pageTitle}>Settings</h1>
        </div>
        <Account />
      </div>
    </div>
  );
}

const pageWrapper = {
  background: "#fdf8f3",
  minHeight: "100vh",
};

const contentArea = {
  padding: "32px 20px 60px",
  maxWidth: "680px",
  margin: "0 auto",
};

const pageHeader = { marginBottom: "20px" };
const pageTitle = { fontSize: "26px", fontWeight: "normal", color: "#3d2200", margin: 0, fontFamily: "'Georgia', serif" };