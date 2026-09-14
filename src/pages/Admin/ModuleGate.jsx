import { usePermissions } from "../../hooks/usePermissions";
import { NO_ACCESS_MESSAGE } from "../../config/adminModules";

export default function ModuleGate({ moduleKey, children }) {
  const { loading, canView } = usePermissions();

  // Render nothing while the live permissions snapshot is still loading —
  // AdminLayout's sidebar/chrome is already painted around this, so a
  // blank content pane for one tick reads as a normal load rather than
  // flashing the denial message on every hard refresh.
  if (loading) return null;

  if (!canView(moduleKey)) {
    return (
      <div style={wrap}>
        <p style={title}>{NO_ACCESS_MESSAGE}</p>
        <p style={subtitle}>Ask an administrator if you need access to this section.</p>
      </div>
    );
  }

  return children;
}

const wrap = {
  padding: "60px 20px",
  textAlign: "center",
};

const title = {
  fontSize: "18px",
  fontFamily: "'Georgia', serif",
  color: "#3d2200",
  margin: "0 0 8px",
};

const subtitle = {
  fontSize: "14px",
  fontFamily: "sans-serif",
  color: "#7a5530",
  margin: 0,
};
