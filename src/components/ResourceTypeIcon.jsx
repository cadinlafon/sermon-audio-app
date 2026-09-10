import { getTypeMeta } from "../lib/resourceTypes";

export default function ResourceTypeIcon({ type, size = 18 }) {
  const meta = getTypeMeta(type);
  return (
    <span style={{ fontSize: `${size}px`, lineHeight: 1, display: "inline-block" }} title={meta.label}>
      {meta.icon}
    </span>
  );
}
