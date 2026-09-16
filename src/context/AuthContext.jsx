import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
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
  // Set briefly right before the forced sign-out below completes, so the
  // app can show a real reason instead of a silent, confusing logout.
  const [accountDisabledMessage, setAccountDisabledMessage] = useState("");

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

            // Same client-side enforcement model as the rest of this admin
            // panel — a flag on the profile, checked here and forced out,
            // rather than a real Firebase Auth account disable (no Admin
            // SDK credentials wired up for that).
            if (data?.disabled) {
              setAccountDisabledMessage(data.disabledReason || "This account has been disabled. Contact an admin if you believe this is a mistake.");
              signOut(auth);
              return;
            }

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
    <AuthContext.Provider value={{ user, role, isAdmin, permissions, authLoading, accountDisabledMessage, clearAccountDisabledMessage: () => setAccountDisabledMessage("") }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
