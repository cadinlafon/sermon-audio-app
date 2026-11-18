import PreviewFrame from "./PreviewFrame";
import NoticeItem from "../NoticeItem";

// The Home page's Notices card with the notice being edited inside it.
export default function NoticePreview({ notice: draft }) {
  // The editor keeps a blank field around even when "collect replies" is off — don't preview that.
  const notice = {
    ...draft,
    buttons: (draft.buttons || []).map((b) => ({ ...b, text: b.text || "Button", value: b.value || (b.action === "dismiss" ? "" : "x") })),
    ...(draft.inputEnabled ? null : { inputFields: [], inputEnabled: false, inputType: null }),
  };
  const empty = !notice.title && !notice.details;
  return (
    <PreviewFrame title="Live preview" note="This is how it looks on the Home page. Buttons and forms are for show — nothing opens or sends. Colors you pick stay the same in dark mode.">
      <div style={card}>
        <div style={head}><span style={{ fontSize: "20px" }}>📌</span><h2 style={cardTitle}>Notices</h2></div>
        {empty ? <p style={placeholder}>Start typing a title and details to see your notice here.</p> : <NoticeItem notice={{ ...notice, id: notice.id || "preview" }} user={null} preview />}
      </div>
    </PreviewFrame>
  );
}

const card = { backgroundColor: "var(--color-fffdf9)", borderRadius: "18px", padding: "20px 18px 14px", border: "1px solid var(--color-eddfc8)", boxShadow: "0 2px 16px rgba(160,100,40,0.07)", fontFamily: "'Georgia', serif" };
const head = { display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px", borderBottom: "1px solid var(--color-eddfc8)", paddingBottom: "12px" };
const cardTitle = { margin: 0, fontSize: "17px", fontWeight: "normal", color: "var(--color-5c3a1e)", fontFamily: "'Georgia', serif" };
const placeholder = { margin: "8px 0 12px", fontSize: "13px", color: "var(--color-b08050)", fontFamily: "sans-serif", fontStyle: "italic" };
