import { useNavigate } from "react-router-dom";
import * as s from "./stateScreenStyles";

export default function AccessDeniedScreen({ config }) {
  const navigate = useNavigate();
  const name = config?.name || config?.defaultName || "This page";

  return (
    <div style={s.page}>
      <div style={s.iconRing({ background: "linear-gradient(135deg, #d65f5f 0%, #a83232 100%)" })}>
        <span style={s.icon}>🚫</span>
      </div>

      <h1 style={s.title}>You don't have access</h1>

      <p style={s.subtitle}>
        You don't have permission to view {name}. If you think this is a
        mistake, reach out to an admin.
      </p>

      <button style={s.homeButton} onClick={() => navigate("/")}>
        ← Back to Home
      </button>
    </div>
  );
}
