import { createContext, useContext, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

const ShutdownContext = createContext();

export function ShutdownProvider({ children }) {
  const [shutdown, setShutdown] = useState(false);
  const [message, setMessage] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [audioAiEnabled, setAudioAiEnabled] = useState(true);
  const [audioAiAudiences, setAudioAiAudiences] = useState(["guest", "user", "admin"]);

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
      }
    });

    return () => unsub();

  }, []);

  return (
    <ShutdownContext.Provider value={{ shutdown, message, returnDate, audioAiEnabled, audioAiAudiences }}>
      {children}
    </ShutdownContext.Provider>
  );
}

export const useShutdown = () => useContext(ShutdownContext);