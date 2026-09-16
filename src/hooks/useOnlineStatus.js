import { useEffect, useState } from "react";

// Just the current connectivity boolean — see NetworkStatus.jsx for the
// banner, which needs its own extra "just came back online" flash state.
export default function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(typeof navigator === "undefined" || navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return isOnline;
}
