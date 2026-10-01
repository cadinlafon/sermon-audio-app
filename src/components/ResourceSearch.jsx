export default function ResourceSearch({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || "Search resources…"}
      style={input}
    />
  );
}

const input = {
  padding: "11px 16px",
  borderRadius: "12px",
  border: "1px solid var(--color-eddfc8)",
  background: "var(--color-fffdf9)",
  fontSize: "14px",
  fontFamily: "sans-serif",
  color: "var(--color-3d2200)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};
