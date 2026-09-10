import { useNavigate } from "react-router-dom";
import * as s from "./stateScreenStyles";

export default function LockedScreen({ config }) {
  const navigate = useNavigate();
  const name = config?.name || config?.defaultName || "This page";

  return (
    <div style={s.page}>
      <div style={s.iconRing()}>
        <span style={s.icon}>🔒</span>
      </div>

      <h1 style={s.title}>{name} is locked</h1>

      <p style={s.subtitle}>
        {config?.description || "This page isn't available to you right now. Check back later."}
      </p>

      <button style={s.homeButton} onClick={() => navigate("/")}>
        ← Back to Home
      </button>
    </div>
  );
}
