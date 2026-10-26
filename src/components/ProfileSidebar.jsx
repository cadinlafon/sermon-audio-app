import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getDisplayName, BADGE_COLORS } from "../lib/pageManager";
import { logEvent } from "../utils/logEvent";
import { useToast } from "../context/ToastContext";

////////////////////////////////////////////////////////////////
// PROFILE SIDEBAR
//
// What the profile icon opens for a signed-in person: a full-height panel
// sliding in from the right.
//   top        their name + a Close Sidebar button
//   quick row  Share App · Suggest Feature · Settings (big icon, label below)
//   middle     every other account page from Page Manager
//   bottom     Admin (admins only) and Log out, side by side
// Tapping outside the panel, pressing Escape, or pressing ANY button inside
// it closes it. It's rendered through a portal so a blurred/transformed top
// bar can never trap it ("liquid" mode blurs the bar).
////////////////////////////////////////////////////////////////

const QUICK_IDS = ["suggest", "settings"]; // shown as big blocks, so not repeated in the list

// A page's icon is either a legacy /navigation/*.png path or an emoji.
function Icon({ icon, size }) {
  if (icon && icon.startsWith("/")) return <img src={icon} alt="" style={{ width: size, height: size, objectFit: "contain" }} />;
  return <span style={{ fontSize: size, lineHeight: 1 }} aria-hidden="true">{icon}</span>;
}

export default function ProfileSidebar({ user, isAdmin, pages, onClose, onGo, onLogout }) {
  const { toast } = useToast();
  const [entered, setEntered] = useState(false);
  const closeRef = useRef(null);
  const returnFocusTo = useRef(null);

  // Slide in, lock the page behind it, focus the Close button, and put focus
  // back where it was when the sidebar closes.
  useEffect(() => {
    returnFocusTo.current = document.activeElement;
    const raf = requestAnimationFrame(() => { setEntered(true); closeRef.current?.focus(); });
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      returnFocusTo.current?.focus?.();
    };
  }, [onClose]);

  const byId = (id) => pages.find((p) => p.id === id);
  const suggest = byId("suggest");
  const settings = byId("settings");
  const others = pages.filter((p) => !QUICK_IDS.includes(p.id));

  const shareApp = async () => {
    const url = window.location.origin;
    const data = { title: "Palouse Fellowship Sermon App", text: "Listen to sermons from Palouse Fellowship.", url };
    onClose();
    try {
      if (navigator.share) {
        await navigator.share(data);
        logEvent("share_app", { method: "native" });
        return;
      }
      await navigator.clipboard.writeText(url);
      logEvent("share_app", { method: "copy" });
      toast("App link copied — paste it to share.", { type: "success" });
    } catch (err) {
      if (err?.name !== "AbortError") toast(`Share this link: ${url}`, { type: "info" });
    }
  };

  const name = user.displayName || user.email || "Your account";

  return createPortal(
    <>
      <div style={{ ...backdrop, opacity: entered ? 1 : 0 }} onClick={onClose} />
      <aside
        style={{ ...panel, transform: entered ? "translateX(0)" : "translateX(100%)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Account menu"
      >
        <div style={header}>
          <div style={nameStyle} title={name}>{name}</div>
          <button ref={closeRef} type="button" style={closeBtn} onClick={onClose} aria-label="Close sidebar" title="Close sidebar">✕</button>
        </div>

        <div style={divider} />

        <div style={quickRow}>
          <button type="button" style={quickBlock} onClick={shareApp}>
            <span style={quickIcon} aria-hidden="true">📤</span>
            <span style={quickLabel}>Share App</span>
          </button>
          {suggest && (
            <button type="button" style={quickBlock} onClick={() => onGo(suggest.route)}>
              <Icon icon={suggest.icon} size={30} />
              <span style={quickLabel}>{getDisplayName(suggest)}</span>
            </button>
          )}
          {settings && (
            <button type="button" style={quickBlock} onClick={() => onGo(settings.route)}>
              <Icon icon={settings.icon} size={30} />
              <span style={quickLabel}>{getDisplayName(settings)}</span>
            </button>
          )}
        </div>

        {others.length > 0 && (
          <>
            <div style={divider} />
            <nav style={list} aria-label="Account pages">
              {others.map((p) => (
                <button key={p.id} type="button" style={listButton} onClick={() => onGo(p.route)}>
                  <span style={listIcon}><Icon icon={p.icon} size={18} /></span>
                  <span>{getDisplayName(p)}</span>
                  {p.badgeEnabled && p.badgeText && <span style={miniBadge(p.badgeColor)}>{p.badgeText}</span>}
                </button>
              ))}
            </nav>
          </>
        )}

        <div style={{ flex: 1 }} />
        <div style={divider} />

        <div style={bottomRow}>
          {isAdmin && (
            <button type="button" style={adminBtn} onClick={() => onGo("/admin")}>Admin</button>
          )}
          <button type="button" style={logoutBtn} onClick={() => { onClose(); onLogout(); }}>Log out</button>
        </div>
      </aside>
    </>,
    document.body
  );
}

const backdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(40,18,0,0.45)",
  zIndex: 3100,
  transition: "opacity 0.25s ease",
};

const panel = {
  position: "fixed",
  top: 0,
  right: 0,
  bottom: 0,
  width: "min(340px, 88vw)",
  background: "var(--color-fffdf9)",
  borderLeft: "1px solid var(--color-eddfc8)",
  boxShadow: "-12px 0 40px rgba(40,18,0,0.28)",
  zIndex: 3101,
  display: "flex",
  flexDirection: "column",
  gap: "14px",
  padding: "calc(env(safe-area-inset-top, 0px) + 18px) 18px calc(env(safe-area-inset-bottom, 0px) + 18px)",
  boxSizing: "border-box",
  overflowY: "auto",
  fontFamily: "sans-serif",
  transition: "transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)",
};

const header = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" };
const nameStyle = { fontFamily: "'Georgia', serif", fontSize: "19px", color: "var(--color-3d2200)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 };
const closeBtn = { flexShrink: 0, width: "36px", height: "36px", borderRadius: "50%", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)", color: "var(--color-7a4f10)", fontSize: "14px", cursor: "pointer", lineHeight: 1 };
const divider = { height: "1px", background: "var(--color-eddfc8)", flexShrink: 0 };

const quickRow = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px" };
const quickBlock = { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", padding: "14px 6px 12px", borderRadius: "14px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)", color: "var(--color-7a4f10)", cursor: "pointer", fontFamily: "sans-serif", minWidth: 0 };
const quickIcon = { fontSize: "30px", lineHeight: 1 };
const quickLabel = { fontSize: "12px", lineHeight: 1.25, textAlign: "center", wordBreak: "break-word" };

const list = { display: "flex", flexDirection: "column", gap: "6px" };
const listButton = { display: "flex", alignItems: "center", gap: "12px", width: "100%", padding: "11px 12px", borderRadius: "10px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)", color: "var(--color-7a4f10)", fontSize: "14px", fontFamily: "sans-serif", textAlign: "left", cursor: "pointer" };
const listIcon = { width: "22px", display: "inline-flex", justifyContent: "center", flexShrink: 0 };

const bottomRow = { display: "flex", gap: "10px" };
const adminBtn = { flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid var(--color-e0a458)", background: "var(--color-fdf1e2)", color: "var(--color-a85e18)", fontSize: "14px", fontWeight: "600", fontFamily: "sans-serif", cursor: "pointer" };
const logoutBtn = { flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid var(--color-c97c2e)", background: "transparent", color: "var(--color-a85e18)", fontSize: "14px", fontWeight: "600", fontFamily: "sans-serif", cursor: "pointer" };

const miniBadge = (color) => {
  const c = BADGE_COLORS[color] || BADGE_COLORS.amber;
  return { marginLeft: "auto", fontSize: "10px", fontWeight: "700", padding: "2px 7px", borderRadius: "999px", background: c.bg, color: c.color, fontFamily: "sans-serif", whiteSpace: "nowrap" };
};
