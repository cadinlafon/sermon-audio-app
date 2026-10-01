import { useTheme } from "../context/ThemeContext";

// One click cycles light -> dark -> system -> light. The icon always
// shows the current PREFERENCE (not the resolved theme), so "system"
// is visually distinct even when it currently resolves to light.
const MODES = {
  light: { icon: "☀️", label: "Light theme — tap to switch to dark" },
  dark: { icon: "🌙", label: "Dark theme — tap to switch to system" },
  system: { icon: "🖥️", label: "System theme — tap to switch to light" },
};

export default function ThemeToggle() {
  const { preference, cycleTheme } = useTheme();
  const mode = MODES[preference] || MODES.light;

  return (
    <button
      style={btn}
      onClick={cycleTheme}
      aria-label={mode.label}
      title={mode.label}
    >
      {mode.icon}
    </button>
  );
}

const btn = {
  width: "36px",
  height: "36px",
  borderRadius: "50%",
  border: "1px solid var(--color-eddfc8)",
  background: "var(--color-fdf8f3)",
  color: "var(--color-7a4f10)",
  fontSize: "15px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
