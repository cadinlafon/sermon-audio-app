import { COVER_COLORS } from "../context/PlaylistContext";

export default function PlaylistCover({ cover, size = 64, radius = 16 }) {
  const [a, b] = COVER_COLORS[cover?.color ?? 0] || COVER_COLORS[0];
  return (
    <div aria-hidden="true" style={{ width: size, height: size, borderRadius: radius, background: `linear-gradient(135deg, ${a}, ${b})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.5, flexShrink: 0, boxShadow: "0 3px 10px rgba(0,0,0,0.15)" }}>
      {cover?.emoji || "🎧"}
    </div>
  );
}
