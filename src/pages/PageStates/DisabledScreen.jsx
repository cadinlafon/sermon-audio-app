import { useNavigate } from "react-router-dom";
import * as s from "./stateScreenStyles";

export default function DisabledScreen({ config }) {
  const navigate = useNavigate();
  const name = config?.name || config?.defaultName || "This page";

  return (
    <div style={s.page}>
      <div style={s.iconRing({ background: "linear-gradient(135deg, #9a9082 0%, #6b6355 100%)" })}>
        <span style={s.icon}>⛔</span>
      </div>

      <h1 style={s.title}>{name} is unavailable</h1>

      <p style={s.subtitle}>
        This page has been temporarily turned off. Please check back later.
      </p>

      <button style={s.homeButton} onClick={() => navigate("/")}>
        ← Back to Home
      </button>
    </div>
  );
}
