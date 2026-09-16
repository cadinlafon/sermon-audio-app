import { useEffect, useState } from "react";

// Mounted once, globally — the scroll threshold alone is what limits
// this to actually-long pages; short pages never scroll far enough
// for it to appear.
export default function BackToTop({ threshold = 600 }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  if (!visible) return null;

  return (
    <button
      style={btn}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      title="Back to top"
    >
      ↑
    </button>
  );
}

const btn = {
  position: "fixed",
  bottom: "96px",
  right: "18px",
  width: "44px",
  height: "44px",
  borderRadius: "50%",
  border: "1px solid #eddfc8",
  background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)",
  color: "#fff8ee",
  fontSize: "20px",
  lineHeight: 1,
  cursor: "pointer",
  boxShadow: "0 4px 14px rgba(160,80,20,0.3)",
  zIndex: 900,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
