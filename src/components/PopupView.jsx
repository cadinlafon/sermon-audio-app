import { useEffect, useRef } from "react";
import NoticeInputForm from "./NoticeInputForm";
import RichText from "./RichText";
import ActionButtons from "./ActionButtons";
import { resolveStyle } from "../lib/colors";
import { popupHasForm } from "../lib/popups";

////////////////////////////////////////////////////////////////
// One popup, drawn. Used by the live app (PopupContext's host) and by the
// admin visualizer — pass `frame` to draw it inside a box instead of over the
// whole screen, and `preview` so nothing is sent or navigated.
//
//   popup     a sanitized popup (lib/popups.js)
//   onClose   called when the person dismisses it
//   user      the signed-in user (for form submissions)
//   offset    px to keep clear at the bottom (the app's nav bar / mini player)
////////////////////////////////////////////////////////////////

const KEYFRAMES = `
@keyframes pfpFade{from{opacity:0}to{opacity:1}}
@keyframes pfpPop{from{opacity:0;transform:scale(.94) translateY(6px)}to{opacity:1;transform:none}}
@keyframes pfpUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}
@keyframes pfpDown{from{opacity:0;transform:translateY(-30px)}to{opacity:1;transform:none}}
@keyframes pfpRight{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:none}}
@keyframes pfpLeft{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){.pfp-anim{animation:none!important}}
`;

const WIDTH = { sm: 340, md: 440, lg: 620 };

function animationFor(popup) {
  const a = popup.animation;
  if (a === "none") return "none";
  const t = popup.type;
  if (t === "sheet") return a === "fade" ? "pfpFade .2s ease-out" : "pfpUp .28s ease-out";
  if (t === "banner") return a === "fade" ? "pfpFade .25s ease-out" : popup.position === "bottom" ? "pfpUp .28s ease-out" : "pfpDown .28s ease-out";
  if (t === "corner") {
    if (a === "fade") return "pfpFade .25s ease-out";
    if (a === "pop") return "pfpPop .22s ease-out";
    return popup.position?.endsWith("left") ? "pfpLeft .3s ease-out" : "pfpRight .3s ease-out";
  }
  if (a === "fade") return "pfpFade .22s ease-out";
  if (a === "slide") return "pfpUp .28s ease-out";
  return "pfpPop .22s ease-out";
}

// The card's content: icon, image, title, rich body, form, buttons.
function Content({ popup, st, onClose, user, preview, compact }) {
  const center = popup.align === "center" && !compact;
  const hasForm = popupHasForm(popup);
  const titleColor = st.title || "var(--color-3d2200)";
  const textColor = st.text || "var(--color-6b4c20)";
  return (
    <div style={{ textAlign: center ? "center" : "left", color: textColor }}>
      {popup.imageUrl && <img src={popup.imageUrl} alt="" style={{ width: "100%", maxHeight: "180px", objectFit: "cover", borderRadius: "12px", marginBottom: "12px", display: "block" }} />}
      {popup.icon && !compact && <div style={{ fontSize: "34px", lineHeight: 1, marginBottom: "8px" }} aria-hidden="true">{popup.icon}</div>}
      {popup.title && (
        <div style={{ fontFamily: "'Georgia', serif", fontSize: compact ? "15px" : "20px", fontWeight: "bold", color: titleColor, margin: "0 0 6px", lineHeight: 1.3 }}>
          {popup.icon && compact && <span style={{ marginRight: "8px" }} aria-hidden="true">{popup.icon}</span>}
          {popup.title}
        </div>
      )}
      {popup.body && <RichText text={popup.body} preview={preview} linkColor={st.accent || undefined} style={{ fontFamily: "sans-serif", fontSize: compact ? "13px" : "14.5px", color: textColor }} />}
      {hasForm && (
        <div style={{ marginTop: "14px", textAlign: "left" }}>
          <NoticeInputForm
            notice={{ ...popup, id: popup.id || "preview" }}
            user={user}
            target={{ collection: "popupSubmissions", idField: "popupId", storage: "popupSubmitted" }}
            requireHuman={popup.captcha}
            preview={preview}
            successText={popup.successMessage}
            accent={st.accent}
          />
        </div>
      )}
      {popup.buttons.length > 0 && (
        <ActionButtons
          buttons={popup.buttons}
          accent={st.accent}
          onDismiss={onClose}
          preview={preview}
          layout={popup.buttonLayout}
          align={popup.buttonAlign}
          size={compact ? "sm" : "md"}
          style={{ marginTop: compact ? 0 : "16px" }}
        />
      )}
    </div>
  );
}

export default function PopupView({ popup, onClose, user, preview = false, frame = false, offset = 76 }) {
  const st = resolveStyle(popup.style);
  const ref = useRef(null);
  const pos = frame ? "absolute" : "fixed";
  const anim = animationFor(popup);
  const type = popup.type;
  const blocking = type === "modal" || type === "sheet" || type === "fullscreen";

  // Escape closes; modal-type popups hold focus and stop the page scrolling behind them.
  useEffect(() => {
    if (preview || !blocking) return undefined;
    const onKey = (e) => { if (e.key === "Escape" && popup.dismissible) onClose?.(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [preview, blocking, popup.dismissible, onClose]);

  const card = {
    background: st.bg || "var(--color-fffdf9)",
    border: `1px solid ${st.border || "var(--color-eddfc8)"}`,
    boxShadow: "0 12px 40px rgba(60,30,0,0.28)",
    boxSizing: "border-box",
    position: "relative",
    outline: "none",
  };
  const closeBtn = (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      style={{ position: "absolute", top: "8px", right: "8px", width: "30px", height: "30px", borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.08)", color: st.text || "var(--color-6b4c20)", fontSize: "14px", cursor: "pointer", lineHeight: 1 }}
    >✕</button>
  );
  const dim = `rgba(40,18,0,${(popup.overlay ?? 55) / 100})`;

  return (
    <>
      <style>{KEYFRAMES}</style>

      {type === "banner" && (
        <div
          role="region"
          aria-label={popup.title || "Announcement"}
          className="pfp-anim"
          style={{
            ...card, borderRadius: 0, borderWidth: popup.position === "bottom" ? "1px 0 0" : "0 0 1px", padding: "10px 44px 10px 14px",
            display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 16px", justifyContent: popup.align === "center" ? "center" : "flex-start",
            width: "100%", animation: anim, boxShadow: "0 2px 10px rgba(60,30,0,0.12)",
            ...(popup.position === "bottom" ? { position: pos, left: 0, right: 0, bottom: frame ? 0 : `calc(${offset}px + env(safe-area-inset-bottom))`, zIndex: 1900 } : {}),
          }}
        >
          <div style={{ flex: "1 1 240px", minWidth: 0 }}><Content popup={popup} st={st} onClose={onClose} user={user} preview={preview} compact /></div>
          {popup.dismissible && closeBtn}
        </div>
      )}

      {type === "corner" && (
        <div
          role="status"
          aria-live="polite"
          className="pfp-anim"
          style={{
            ...card, position: pos, zIndex: 2500, width: "min(340px, calc(100vw - 24px))", borderRadius: "16px", padding: "16px 18px", animation: anim,
            maxHeight: frame ? "calc(100% - 24px)" : "70vh", overflowY: "auto",
            ...(popup.position?.startsWith("top") ? { top: frame ? 12 : "calc(64px + 8px)" } : { bottom: frame ? 12 : `calc(${offset}px + env(safe-area-inset-bottom))` }),
            ...(popup.position?.endsWith("left") ? { left: 12 } : { right: 12 }),
          }}
        >
          <div style={{ paddingRight: popup.dismissible ? "22px" : 0 }}><Content popup={popup} st={st} onClose={onClose} user={user} preview={preview} /></div>
          {popup.dismissible && closeBtn}
        </div>
      )}

      {blocking && (
        <div
          className="pfp-anim"
          style={{ position: pos, inset: 0, zIndex: 3500, background: type === "fullscreen" ? (st.bg || "var(--color-fdf8f3)") : dim, display: "flex", alignItems: type === "sheet" ? "flex-end" : "center", justifyContent: "center", animation: "pfpFade .2s ease-out", ...(type === "fullscreen" ? { overflowY: "auto" } : null) }}
          onClick={() => { if (popup.closeOnBackdrop && popup.dismissible && type !== "fullscreen") onClose?.(); }}
        >
          <div
            ref={ref}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={popup.title || "Message"}
            className="pfp-anim"
            onClick={(e) => e.stopPropagation()}
            style={{
              ...card, animation: anim, maxHeight: frame ? "100%" : "92vh", overflowY: "auto",
              ...(type === "modal" ? { width: `min(${WIDTH[popup.size] || 440}px, calc(100% - 28px))`, borderRadius: "20px", padding: "26px 24px 22px" } : null),
              ...(type === "sheet" ? { width: "min(560px, 100%)", borderRadius: "22px 22px 0 0", padding: "24px 22px calc(22px + env(safe-area-inset-bottom))", borderBottom: "none" } : null),
              ...(type === "fullscreen" ? { width: "min(620px, 100%)", border: "none", boxShadow: "none", background: "transparent", padding: "40px 22px" } : null),
            }}
          >
            <Content popup={popup} st={st} onClose={onClose} user={user} preview={preview} />
            {popup.dismissible && closeBtn}
          </div>
        </div>
      )}
    </>
  );
}
