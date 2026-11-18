import { useNavigate } from "react-router-dom";
import * as s from "./stateScreenStyles";
import RichText from "../../components/RichText";

export default function MaintenanceScreen({ config }) {
  const navigate = useNavigate();
  const name = config?.name || config?.defaultName || "This page";
  const formattedDate = s.formatDate(config?.maintenanceUntil);

  return (
    <div style={s.page}>
      <div style={s.iconRing()}>
        <span style={s.icon}>🔧</span>
      </div>

      <h1 style={s.title}>
        {config?.maintenanceTitle || `${name} is under maintenance`}
      </h1>

      <RichText text={config?.maintenanceMessage || "We're making some improvements here. Please check back soon."} style={s.subtitle} />

      {formattedDate && (
        <div style={s.infoCard}>
          <p style={s.infoLabel}>Expected return</p>
          <p style={s.infoValue}>{formattedDate}</p>
        </div>
      )}

      <button style={s.homeButton} onClick={() => navigate("/")}>
        ← Back to Home
      </button>
    </div>
  );
}
