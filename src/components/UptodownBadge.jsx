////////////////////////////////////////////////////////////////
// UPTODOWN DOWNLOAD BADGE
//
// "Download it on Uptodown" button linking to the Android app's
// Uptodown listing. Uptodown retired its hosted badge image
// (download-aao-big.png), so this is built from their logo.
////////////////////////////////////////////////////////////////

export const UPTODOWN_URL = "https://palouse-fellowship-audio.en.uptodown.com/android";
const UPTODOWN_LOGO = "https://stc.utdstc.com/img/mediakit/isotipo.png";

export default function UptodownBadge({ size = "md", onClick, linkRef }) {
  const big = size === "lg";
  return (
    <a
      href={UPTODOWN_URL}
      title="Download Palouse Fellowship Audio"
      aria-label="Download Palouse Fellowship Audio on Uptodown"
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      ref={linkRef}
      style={{ ...link, ...(big ? linkLg : null) }}
    >
      <img src={UPTODOWN_LOGO} alt="" style={big ? logoLg : logo} />
      <span style={textWrap}>
        <span style={{ ...small, ...(big ? smallLg : null) }}>Download it on</span>
        <span style={{ ...name, ...(big ? nameLg : null) }}>Uptodown</span>
      </span>
    </a>
  );
}

const link = {
  display: "inline-flex",
  alignItems: "center",
  gap: "10px",
  padding: "8px 18px 8px 12px",
  borderRadius: "12px",
  background: "#111",
  border: "1px solid #3a3a3a",
  color: "#fff",
  textDecoration: "none",
  boxShadow: "0 3px 10px rgba(0,0,0,0.18)",
};
const linkLg = { gap: "12px", padding: "10px 22px 10px 14px", borderRadius: "14px" };
const logo = { width: "30px", height: "30px", flexShrink: 0 };
const logoLg = { width: "36px", height: "36px", flexShrink: 0 };
const textWrap = { display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.1, fontFamily: "sans-serif" };
const small = { fontSize: "10.5px", letterSpacing: "0.02em", opacity: 0.85 };
const smallLg = { fontSize: "12px" };
const name = { fontSize: "19px", fontWeight: 600, letterSpacing: "-0.01em" };
const nameLg = { fontSize: "23px" };
