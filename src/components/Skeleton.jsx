// Placeholder cards shown while a list loads (respects reduced motion).
export function SkeletonCard() {
  return (
    <div style={card} aria-hidden="true">
      <div className="pf-skel" style={{ ...bar, width: "70px", height: "18px" }} />
      <div className="pf-skel" style={{ ...bar, width: "75%", height: "20px", marginTop: "14px" }} />
      <div className="pf-skel" style={{ ...bar, width: "40%", height: "14px", marginTop: "10px" }} />
      <div style={{ display: "flex", gap: "8px", marginTop: "18px" }}>
        <div className="pf-skel" style={{ ...bar, width: "84px", height: "34px", borderRadius: "999px" }} />
        <div className="pf-skel" style={{ ...bar, width: "100px", height: "34px", borderRadius: "999px" }} />
      </div>
    </div>
  );
}

export default function SkeletonList({ count = 4, label = "Loading" }) {
  return (
    <div role="status" aria-label={label}>
      {Array.from({ length: count }, (_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

const card = { background: "#fffdf9", borderRadius: "18px", padding: "22px", marginBottom: "16px", border: "1px solid #eddfc8" };
const bar = { background: "#f0e4d0", borderRadius: "8px" };
