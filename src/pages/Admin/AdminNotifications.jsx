export default function AdminNotifications() {

  const openOneSignal = () => {
    window.open(
      "https://dashboard.onesignal.com/apps/1ef262cd-90f7-499d-a3d9-b35ecd259745/push",
      "_blank"
    );
  };

  return (
    <div style={container}>
      <h1 style={title}>Notifications</h1>

      {/* MAIN BUTTON */}
      <button style={mainButton} onClick={openOneSignal}>
        Send Custom Notification
      </button>

      {/* INFO BOX */}
      <div style={infoBox}>
        <p style={{ marginBottom: "10px" }}>
          This will open the OneSignal dashboard where you can:
        </p>

        <ul style={list}>
          <li>Create notifications</li>
          <li>Target users or segments</li>
          <li>Schedule sends</li>
          <li>View analytics</li>
        </ul>
      </div>

      {/* OPTIONAL: FUTURE PRESETS UI */}
      <div style={presetSection}>
        <h3>Presets (Coming Later)</h3>
        <p style={{ color: "#777", fontSize: "13px" }}>
          You can add saved notification templates here later if needed.
        </p>
      </div>
    </div>
  );
}

//////////////////////////////////////////////////
// STYLES
//////////////////////////////////////////////////

const container = {
  padding: "40px",
  maxWidth: "700px",
  margin: "0 auto",
};

const title = {
  textAlign: "center",
  marginBottom: "30px",
};

const mainButton = {
  width: "100%",
  padding: "14px",
  background: "#111",
  color: "#fff",
  border: "none",
  borderRadius: "10px",
  fontSize: "16px",
  cursor: "pointer",
  marginBottom: "20px",
};

const infoBox = {
  background: "#f9fafb",
  border: "1px solid #eee",
  padding: "20px",
  borderRadius: "10px",
};

const list = {
  paddingLeft: "18px",
  lineHeight: "1.6",
};

const presetSection = {
  marginTop: "40px",
};