import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { useAdminSecurity } from "../hooks/useAdminSecurity";
import { usePermissions } from "../hooks/usePermissions";
import { useAuth } from "./AuthContext";
import { PIN_UNLOCK_SESSION_KEY, isPasskeySupported, SECURITY_CHANGE_ACTION } from "../config/adminSecurity";
import PinEntry from "../components/Admin/PinEntry";

function authErrorMessage(err) {
  switch (err?.code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect password.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    default:
      return "Couldn't verify your password.";
  }
}

const AdminPinContext = createContext(null);

export function useAdminPin() {
  return useContext(AdminPinContext);
}

function readUnlocked() {
  try {
    return sessionStorage.getItem(PIN_UNLOCK_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function writeUnlocked(value) {
  try {
    if (value) sessionStorage.setItem(PIN_UNLOCK_SESSION_KEY, "1");
    else sessionStorage.removeItem(PIN_UNLOCK_SESSION_KEY);
  } catch {
    // sessionStorage unavailable (private mode, etc.) — just stays
    // unlocked in memory for the life of this page load.
  }
}

// Wraps the whole admin panel (see AdminLayout.jsx). Renders the
// full-screen lock in place of the panel when entry itself is
// PIN-gated and not yet unlocked; otherwise renders the panel and
// makes requirePin(actionKey) available to every admin page via
// useAdminPin(), for gating individual sensitive actions.
export function AdminPinProvider({ children }) {
  const security = useAdminSecurity();
  const { isRestricted, loading: permsLoading } = usePermissions();
  const { user } = useAuth();

  const [unlocked, setUnlocked] = useState(readUnlocked);
  const [request, setRequest] = useState(null); // { actionKey, resolve }
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => writeUnlocked(unlocked), [unlocked]);

  const activePinAvailable = isRestricted ? security.hasRestrictedPin : security.hasOwnerPin;
  const passwordAvailable = !!user?.providerData?.some((p) => p.providerId === "password");
  const entryGated = security.pinEnabled && security.requirePinFor.has("adminEntry") && !unlocked;
  const ownerPasskeyAvailable = !isRestricted && isPasskeySupported() && security.passkeys.length > 0;

  const requirePin = useMemo(
    () => (actionKey) =>
      new Promise((resolve) => {
        if (!security.pinEnabled) return resolve(true);
        // securityChange isn't a toggle — always required once a PIN
        // exists, so security:edit access alone can't turn the PIN off.
        if (actionKey !== SECURITY_CHANGE_ACTION && !security.requirePinFor.has(actionKey)) return resolve(true);
        if (unlocked) return resolve(true);
        setError("");
        setRequest({ actionKey, resolve });
      }),
    [security.pinEnabled, security.requirePinFor, unlocked]
  );

  const lockNow = () => setUnlocked(false);

  const closeRequest = (result) => {
    request?.resolve(result);
    setRequest(null);
    setError("");
  };

  const submitPin = async (pin) => {
    setSubmitting(true);
    try {
      const ok = isRestricted ? await security.verifyRestrictedPin(pin) : await security.verifyOwnerPin(pin);
      if (!ok) {
        setError("Incorrect PIN.");
        setSubmitting(false);
        return;
      }
      setUnlocked(true);
      setSubmitting(false);
      closeRequest(true);
    } catch {
      setError("Something went wrong checking that PIN.");
      setSubmitting(false);
    }
  };

  const usePassword = async (password) => {
    setSubmitting(true);
    setError("");
    try {
      if (!user?.email) throw new Error("No signed-in account email.");
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      setUnlocked(true);
      setSubmitting(false);
      closeRequest(true);
    } catch (err) {
      setError(authErrorMessage(err));
      setSubmitting(false);
    }
  };

  const usePasskey = async () => {
    setSubmitting(true);
    setError("");
    try {
      const ok = await security.verifyOwnerPasskey();
      if (!ok) {
        setError("Passkey verification failed.");
        setSubmitting(false);
        return;
      }
      setUnlocked(true);
      setSubmitting(false);
      closeRequest(true);
    } catch (err) {
      setError(err?.message || "Passkey was cancelled or unavailable.");
      setSubmitting(false);
    }
  };

  // Passkeys are the fastest option, so when one's registered, fire it
  // the moment a lock screen (or action gate) appears — no click needed
  // first. The buttons stay visible as a manual fallback if the browser
  // blocks the unprompted call or the user cancels it.
  const entryAutoTriedRef = useRef(false);
  const requestAutoTriedRef = useRef(false);

  useEffect(() => {
    if (unlocked) entryAutoTriedRef.current = false;
  }, [unlocked]);

  useEffect(() => {
    if (entryGated && ownerPasskeyAvailable && !entryAutoTriedRef.current && !submitting) {
      entryAutoTriedRef.current = true;
      usePasskey();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryGated, ownerPasskeyAvailable]);

  useEffect(() => {
    requestAutoTriedRef.current = false;
  }, [request]);

  useEffect(() => {
    if (request && ownerPasskeyAvailable && !requestAutoTriedRef.current && !submitting) {
      requestAutoTriedRef.current = true;
      usePasskey();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, ownerPasskeyAvailable]);

  if (security.loading || permsLoading) return null;

  if (entryGated) {
    if (!activePinAvailable && !passwordAvailable && !ownerPasskeyAvailable) {
      return (
        <div style={lockScreenWrap}>
          <div style={lockCard}>
            <span style={{ fontSize: "34px" }}>🔒</span>
            <h2 style={{ fontFamily: "'Georgia', serif", color: "#3d2200", fontWeight: "normal" }}>
              Admin PIN required
            </h2>
            <p style={{ fontFamily: "sans-serif", color: "#9b7040", fontSize: "13px" }}>
              {isRestricted
                ? "A restricted-admin PIN hasn't been set yet. Ask the owner to set one in Security settings."
                : "No admin PIN is set yet."}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div style={lockScreenWrap}>
        <div style={lockCard}>
          <PinEntry
            title="Admin Dashboard Locked"
            subtitle="Enter your PIN to continue."
            onSubmitPin={submitPin}
            onSubmitPassword={usePassword}
            onUsePasskey={usePasskey}
            showPinOption={activePinAvailable}
            showPasswordOption={passwordAvailable}
            showPasskeyOption={ownerPasskeyAvailable}
            submitting={submitting}
            error={error}
          />
        </div>
      </div>
    );
  }

  return (
    <AdminPinContext.Provider value={{ requirePin, lockNow, unlocked, pinEnabled: security.pinEnabled, security }}>
      {children}

      {request && (
        <>
          <div style={backdrop} onClick={() => !submitting && closeRequest(false)} />
          <div style={modalWrap}>
            {!activePinAvailable && !passwordAvailable && !ownerPasskeyAvailable ? (
              <p style={{ fontFamily: "sans-serif", color: "#9b7040", fontSize: "13px", textAlign: "center", margin: 0 }}>
                {isRestricted
                  ? "A restricted-admin PIN hasn't been set yet. Ask the owner to set one in Security settings."
                  : "No admin PIN is set yet."}
              </p>
            ) : (
              <PinEntry
                title="Confirm With PIN"
                subtitle="This action requires your admin PIN."
                onSubmitPin={submitPin}
                onSubmitPassword={usePassword}
                onUsePasskey={usePasskey}
                showPinOption={activePinAvailable}
                showPasswordOption={passwordAvailable}
                showPasskeyOption={ownerPasskeyAvailable}
                submitting={submitting}
                error={error}
              />
            )}
            <button
              type="button"
              onClick={() => !submitting && closeRequest(false)}
              style={cancelLink}
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </AdminPinContext.Provider>
  );
}

const lockScreenWrap = {
  minHeight: "100vh",
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#fdf8f3",
  padding: "20px",
};

const lockCard = {
  background: "#fffdf9",
  border: "1px solid #eddfc8",
  borderRadius: "20px",
  padding: "36px 32px",
  width: "100%",
  maxWidth: "380px",
  boxShadow: "0 4px 20px rgba(160,100,40,0.1)",
  textAlign: "center",
};

const backdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(40,18,0,0.5)",
  zIndex: 2999,
};

const modalWrap = {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  background: "#fffdf9",
  border: "1px solid #eddfc8",
  borderRadius: "20px",
  padding: "32px 28px",
  width: "90%",
  maxWidth: "360px",
  zIndex: 3000,
  boxShadow: "0 10px 40px rgba(80,35,0,0.25)",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const cancelLink = {
  background: "none",
  border: "none",
  color: "#b08050",
  fontFamily: "sans-serif",
  fontSize: "13px",
  cursor: "pointer",
  padding: "4px",
};
