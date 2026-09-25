import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const ToastContext = createContext({ toast: () => {} });
export const useToast = () => useContext(ToastContext);

// Toast messages — replaces browser alert() popups. Also supports an action
// (e.g. "Undo") so destructive actions can be reversed.
//   toast("Saved")
//   toast("Playlist deleted", { action: { label: "Undo", onClick: restore }, type: "info" })
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback((message, options = {}) => {
    const id = nextId.current++;
    const duration = options.duration ?? (options.action ? 6500 : 3500);
    setToasts((t) => [...t.slice(-3), { id, message: String(message), type: options.type || "info", action: options.action }]);
    if (duration > 0) setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  // Existing code calls alert(); route those through toasts instead of the
  // blocking browser dialog (confirm() stays native — it needs an answer).
  useEffect(() => {
    const original = window.alert;
    window.alert = (message) => { toast(message, { type: /couldn't|failed|error|unable|can't|not |please/i.test(String(message)) ? "error" : "info" }); };
    return () => { window.alert = original; };
  }, [toast]);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div style={stack} aria-live="polite" role="status">
        {toasts.map((t) => (
          <div key={t.id} className="pf-toast" style={{ ...box, ...(t.type === "error" ? errorBox : null), ...(t.type === "success" ? successBox : null) }}>
            <span style={{ flex: 1 }}>{t.message}</span>
            {t.action && (
              <button style={actionBtn} onClick={() => { t.action.onClick(); dismiss(t.id); }}>{t.action.label}</button>
            )}
            <button style={closeBtn} onClick={() => dismiss(t.id)} aria-label="Dismiss">✕</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const stack = { position: "fixed", left: 0, right: 0, bottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", zIndex: 6500, pointerEvents: "none", padding: "0 16px" };
const box = { pointerEvents: "auto", display: "flex", alignItems: "center", gap: "10px", maxWidth: "460px", width: "100%", boxSizing: "border-box", background: "#3d2200", color: "#fff8ee", padding: "12px 14px", borderRadius: "14px", fontSize: "13px", fontFamily: "sans-serif", boxShadow: "0 8px 24px rgba(0,0,0,0.25)", lineHeight: 1.4 };
const errorBox = { background: "#8f2e1a" };
const successBox = { background: "#1f6b37" };
const actionBtn = { background: "rgba(255,255,255,0.18)", border: "none", color: "#fff", padding: "6px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "sans-serif" };
const closeBtn = { background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: "13px", cursor: "pointer", padding: "2px 4px" };
