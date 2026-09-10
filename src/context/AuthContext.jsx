import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let unsubRole = null;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      if (unsubRole) {
        unsubRole();
        unsubRole = null;
      }

      if (currentUser) {
        unsubRole = onSnapshot(
          doc(db, "users", currentUser.uid),
          (snap) => {
            setRole(snap.exists() ? snap.data().role || "user" : "user");
            setAuthLoading(false);
          },
          () => setAuthLoading(false)
        );
      } else {
        setRole(null);
        setAuthLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubRole) unsubRole();
    };
  }, []);

  const isAdmin = role === "admin";

  return (
    <AuthContext.Provider value={{ user, role, isAdmin, authLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
