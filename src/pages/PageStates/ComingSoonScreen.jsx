import { useNavigate } from "react-router-dom";
import * as s from "./stateScreenStyles";

export default function ComingSoonScreen({ config }) {
  const navigate = useNavigate();
  const name = config?.name || config?.defaultName || "This page";
  const formattedDate = s.formatDateOnly(config?.releaseDate);

  return (
    <div style={s.page}>
      <div style={s.iconRing({ background: "linear-gradient(135deg, #8b6fd6 0%, #6547a5 100%)" })}>
        <span style={s.icon}>🚀</span>
      </div>

      <h1 style={s.title}>{config?.comingSoonTitle || `${name} is coming soon`}</h1>

      <p style={s.subtitle}>
        {config?.comingSoonMessage ||
          `${name} isn't available quite yet. Check back soon!`}
      </p>

      {config?.comingSoonBadge && (
        <div style={s.subtitle}>
          <span
            style={{
              fontSize: "11px",
              padding: "4px 10px",
              borderRadius: "999px",
              background: "#eee8ff",
              color: "#6547a5",
              fontFamily: "sans-serif",
              fontWeight: "600",
              letterSpacing: "0.04em",
            }}
          >
            {config.comingSoonBadge}
          </span>
        </div>
      )}

      {formattedDate && (
        <div style={s.infoCard}>
          <p style={s.infoLabel}>Planned release</p>
          <p style={s.infoValue}>{formattedDate}</p>
        </div>
      )}

      <button style={s.homeButton} onClick={() => navigate("/")}>
        ← Back to Home
      </button>
    </div>
  );
}
