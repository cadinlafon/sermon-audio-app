export default function LoadingScreen() {
  return (
    <div style={container}>
      <img
        src="/icons/icon-512.png"
        alt="App Logo"
        style={logo}
      />
    </div>
  );
}

const container = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  background: "#062362", // 🔥 nice blue
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
};

const logo = {
  width: "120px",
  height: "120px",
};