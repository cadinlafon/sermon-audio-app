import { useNavigate } from "react-router-dom";
import * as s from "./stateScreenStyles";
import RichText from "../../components/RichText";

export default function LockedScreen({ config }) {
  const navigate = useNavigate();
  const name = config?.name || config?.defaultName || "This page";

  return (
    <div style={s.page}>
      <div style={s.iconRing()}>
        <span style={s.icon}>🔒</span>
      </div>

      <h1 style={s.title}>{name} is locked</h1>

      <RichText text={config?.description || "This page isn't available to you right now. Check back later."} style={s.subtitle} />

      <button style={s.homeButton} onClick={() => navigate("/")}>
        ← Back to Home
      </button>
    </div>
  );
}
