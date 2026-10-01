import { createContext, useCallback, useContext, useEffect, useState } from "react";

////////////////////////////////////////////////////////////////
// THEME — light / dark / system
//
// "system" tracks the OS/browser's prefers-color-scheme live (no
// refresh needed if it changes while the app is open — e.g. macOS
// switching to Dark Mode at sunset). The resolved theme ("light" or
// "dark") is written to <html data-theme="..."> , which every color
// in src/theme-tokens.css keys off of.
////////////////////////////////////////////////////////////////

const STORAGE_KEY = "pf-theme-preference"; // "light" | "dark" | "system"
const ThemeContext = createContext(null);

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === "light" || stored === "dark" || stored === "system" ? stored : "light";
    } catch {
      return "light";
    }
  });

  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  // Live-track the OS preference so "system" updates without a reload.
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e) => setSystemDark(e.matches);
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  const resolvedTheme = preference === "system" ? (systemDark ? "dark" : "light") : preference;

  // Apply to <html> so theme-tokens.css's :root[data-theme="dark"] block takes over.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Private browsing / storage disabled — theme just won't persist across visits.
    }
  }, [preference]);

  const cycleTheme = useCallback(() => {
    setPreference((current) => (current === "light" ? "dark" : current === "dark" ? "system" : "light"));
  }, []);

  const value = { preference, resolvedTheme, setPreference, cycleTheme };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
