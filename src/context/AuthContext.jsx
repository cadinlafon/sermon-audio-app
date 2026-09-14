import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  // Absent/null permissions means a full (unrestricted) admin — the shape
  // every existing admin account already has today. A restricted admin
  // carries a real { moduleKey: { view, edit, delete } } object here.
  const [permissions, setPermissions] = useState(null);
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
            const data = snap.exists() ? snap.data() : null;
            setRole(data?.role || "user");
            const perms = data?.permissions;
            setPermissions(perms && typeof perms === "object" ? perms : null);
            setAuthLoading(false);
          },
          () => setAuthLoading(false)
        );
      } else {
        setRole(null);
        setPermissions(null);
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
    <AuthContext.Provider value={{ user, role, isAdmin, permissions, authLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
