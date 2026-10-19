import { createContext, useContext, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

const ShutdownContext = createContext();

const LIQUID_KEY = "pf-liquid-screen";

// <html data-liquid="on"> switches on src/liquid-glass.css. The last value
// is remembered so the next visit starts in the right style (index.html
// applies it before first paint).
function applyLiquidScreen(enabled) {
  if (enabled) document.documentElement.setAttribute("data-liquid", "on");
  else document.documentElement.removeAttribute("data-liquid");
  try {
    if (enabled) localStorage.setItem(LIQUID_KEY, "on");
    else localStorage.removeItem(LIQUID_KEY);
  } catch {
    // storage unavailable — it just won't be remembered between visits
  }
}

export function ShutdownProvider({ children }) {
  const [shutdown, setShutdown] = useState(false);
  const [message, setMessage] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [audioAiEnabled, setAudioAiEnabled] = useState(true);
  const [audioAiAudiences, setAudioAiAudiences] = useState(["guest", "user", "admin"]);
  const [liquidScreen, setLiquidScreen] = useState(() => document.documentElement.getAttribute("data-liquid") === "on");

  useEffect(() => {

    const ref = doc(db, "appConfig", "status");

    const unsub = onSnapshot(ref, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();

        setShutdown(data.shutdown);
        setMessage(data.message);
        setReturnDate(data.returnDate);
        if (data.audioAiEnabled !== undefined) setAudioAiEnabled(data.audioAiEnabled);
        if (data.audioAiAudiences !== undefined) setAudioAiAudiences(data.audioAiAudiences);
        const liquid = data.liquidScreen === true;
        setLiquidScreen(liquid);
        applyLiquidScreen(liquid);
      }
    });

    return () => unsub();

  }, []);

  return (
    <ShutdownContext.Provider value={{ shutdown, message, returnDate, audioAiEnabled, audioAiAudiences, liquidScreen }}>
      {children}
    </ShutdownContext.Provider>
  );
}

export const useShutdown = () => useContext(ShutdownContext);