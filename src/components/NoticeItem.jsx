import NoticeInputForm from "./NoticeInputForm";
import RichText from "./RichText";
import ActionButtons from "./ActionButtons";
import { noticeHasInput } from "../utils/noticeInputs";
import { buttonsOf } from "../lib/actionButtons";
import { resolveStyle } from "../lib/colors";
import { logEvent } from "../utils/logEvent";

////////////////////////////////////////////////////////////////
// One notice, as shown on Home. The admin notice editor's live visualizer uses
// this same component (with `preview`), so what they see is what people get.
//
// A notice can have rich-text details, any number of buttons, and its own
// colors (see lib/colors.js). Older notices (one button, no colors) render the
// same as they always did.
////////////////////////////////////////////////////////////////

export default function NoticeItem({ notice: n, user, preview = false }) {
  const st = resolveStyle(n.style);
  const buttons = buttonsOf(n);
  const title = st.title || "var(--color-3d2600)";
  const text = st.text || "var(--color-6b4c20)";

  return (
    <div style={{ ...item, background: st.bg || "var(--color-fffbee)", border: `1px solid ${st.border || "var(--color-f0d898)"}` }}>
      {n.pinned && <span style={pinnedBadge}>Pinned</span>}
      {n.title && (
        <h4 style={{ ...noticeTitle, color: title }}>
          <RichText inline text={n.title} preview={preview} linkColor={st.accent || undefined} />
        </h4>
      )}
      {n.details && <RichText text={n.details} preview={preview} linkColor={st.accent || undefined} style={{ ...noticeBody, color: text }} />}

      <ActionButtons
        buttons={buttons}
        accent={st.accent}
        preview={preview}
        onAction={(b) => { if (!preview) logEvent("notice_click", { noticeId: n.id, noticeTitle: n.title, buttonText: b.text }); }}
        style={{ marginTop: "10px" }}
      />

      {noticeHasInput(n) && <NoticeInputForm notice={n} user={user} preview={preview} accent={st.accent} />}
    </div>
  );
}

const item = { padding: "14px 16px", borderRadius: "12px", marginBottom: "10px" };
const pinnedBadge = { display: "inline-block", fontSize: "11px", fontFamily: "sans-serif", background: "var(--color-f6e4b0)", color: "var(--color-7a5a10)", borderRadius: "99px", padding: "2px 8px", marginBottom: "6px", letterSpacing: "0.04em" };
const noticeTitle = { margin: "0 0 5px", fontSize: "15px", fontWeight: "bold", fontFamily: "'Georgia', serif" };
const noticeBody = { margin: "0 0 4px", fontSize: "14px", fontFamily: "sans-serif" };
