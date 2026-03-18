import { createContext, useContext, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

const ShutdownContext = createContext();

export function ShutdownProvider({ children }) {
  const [shutdown, setShutdown] = useState(false);
  const [message, setMessage] = useState("");
  const [returnDate, setReturnDate] = useState("");

  useEffect(() => {

    const ref = doc(db, "appConfig", "status");

    const unsub = onSnapshot(ref, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();

        setShutdown(data.shutdown);
        setMessage(data.message);
        setReturnDate(data.returnDate);
      }
    });

    return () => unsub();

  }, []);

  return (
    <ShutdownContext.Provider value={{ shutdown, message, returnDate }}>
      {children}
    </ShutdownContext.Provider>
  );
}

export const useShutdown = () => useContext(ShutdownContext);