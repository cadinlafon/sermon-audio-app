import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { useToast } from "../context/ToastContext";
import { processPendingDownloads } from "../utils/offlineDownloads";

// Runs "download for later" items whenever you're signed in and online.
export default function DownloadScheduler() {
  const { toast } = useToast();

  useEffect(() => {
    let running = false;
    const run = async () => {
      const user = auth.currentUser;
      if (!user || running || !navigator.onLine) return;
      running = true;
      try {
        const { done } = await processPendingDownloads(user);
        if (done > 0) toast(`Downloaded ${done} queued recording${done === 1 ? "" : "s"}`, { type: "success" });
      } finally {
        running = false;
      }
    };
    const unsub = onAuthStateChanged(auth, () => run());
    window.addEventListener("online", run);
    window.addEventListener("pending-downloads-changed", run);
    return () => { unsub(); window.removeEventListener("online", run); window.removeEventListener("pending-downloads-changed", run); };
  }, [toast]);

  return null;
}
