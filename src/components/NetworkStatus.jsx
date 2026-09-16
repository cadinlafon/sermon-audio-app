import { useEffect, useState } from "react";

// A thin banner at the top of the screen — shows while offline, then
// briefly flashes "Back online" once the connection returns. Renders
// nothing the rest of the time.
export default function NetworkStatus() {
  const [online, setOnline] = useState(typeof navigator === "undefined" || navigator.onLine);
  const [showBackOnline, setShowBackOnline] = useState(false);

  useEffect(() => {
    let timer;
    const handleOnline = () => {
      setOnline(true);
      setShowBackOnline(true);
      timer = setTimeout(() => setShowBackOnline(false), 3000);
    };
    const handleOffline = () => {
      setOnline(false);
      setShowBackOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearTimeout(timer);
    };
  }, []);

  if (!online) {
    return (
      <div style={offlineBar} role="status">
        📡 You're offline — some features may not work until connection returns.
      </div>
    );
  }

  if (showBackOnline) {
    return (
      <div style={onlineBar} role="status">
        ✓ Back online
      </div>
    );
  }

  return null;
}

const barBase = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  zIndex: 4000,
  textAlign: "center",
  padding: "8px 16px",
  fontSize: "12px",
  fontFamily: "sans-serif",
  fontWeight: "600",
  color: "#fff8ee",
};

const offlineBar = {
  ...barBase,
  background: "linear-gradient(135deg, #b3432c 0%, #8f2e1a 100%)",
};

const onlineBar = {
  ...barBase,
  background: "linear-gradient(135deg, #2f8a4a 0%, #1f6b37 100%)",
};
