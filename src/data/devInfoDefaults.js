////////////////////////////////////////////////////////////////
// DEV INFO — default content
//
// What the Dev Info page shows until an admin edits it. Edits made in
// Admin → Dev Info are stored in Firestore (appConfig/devInfo) and replace
// these section by section; "Reset to defaults" there deletes the stored
// copy so the page falls back to exactly this.
////////////////////////////////////////////////////////////////

export const DEV_INFO_DEFAULTS = {
  appName: "Sermon Audio App (Palouse Fellowship)",
  license: "Open source",
  githubUrl: "https://github.com/cadinlafon/sermon-audio-app",
  liveUrl: "https://app.palousefellowship.com",

  techStack: [
    { group: "Frontend", items: ["React 19", "Vite", "React Router v7", "Progressive Web App (vite-plugin-pwa)"] },
    { group: "Data & Auth", items: ["Firebase Authentication", "Cloud Firestore"] },
    { group: "Backend", items: ["Supabase Edge Functions (Deno)", "Backblaze B2 audio storage"] },
    { group: "Charts", items: ["Recharts"] },
    { group: "Hosting", items: ["Firebase Hosting"] },
  ],

  features: [
    { icon: "🎧", label: "Audio Streaming" },
    { icon: "🗂️", label: "Sermon Management" },
    { icon: "🕘", label: "Listen History" },
    { icon: "⏯️", label: "Progress Tracking" },
    { icon: "🔍", label: "Search & Filter" },
    { icon: "📊", label: "Analytics Dashboard" },
    { icon: "📱", label: "Progressive Web App" },
    { icon: "⚡", label: "Real-time Data" },
    { icon: "🤖", label: "AI Audio Summaries" },
    { icon: "🛡️", label: "Restricted Admin Permissions" },
    { icon: "📖", label: "Doctrine Campaigns" },
    { icon: "🔔", label: "Notices & Alerts" },
  ],

  backendFunctions: [
    { name: "audio-admin", desc: "Admin audio upload & management" },
    { name: "audio-download-url", desc: "Signed URLs for private audio playback" },
    { name: "public-image", desc: "Public image proxy/serving" },
    { name: "summarize-audio", desc: "AI-generated sermon audio summaries" },
  ],

  supportText: "Found a bug or have a feature request? Open an issue on GitHub, or use the Suggest a Feature page in the app.",
};

// Stored content wins section by section; anything missing falls back to the
// defaults, so a half-edited or older document can never blank the page.
export function mergeDevInfo(stored) {
  const d = DEV_INFO_DEFAULTS;
  const s = stored && typeof stored === "object" ? stored : {};
  const text = (v, fallback) => (typeof v === "string" && v.trim() ? v : fallback);
  const list = (v, fallback) => (Array.isArray(v) ? v : fallback);
  return {
    appName: text(s.appName, d.appName),
    license: text(s.license, d.license),
    githubUrl: text(s.githubUrl, d.githubUrl),
    liveUrl: text(s.liveUrl, d.liveUrl),
    techStack: list(s.techStack, d.techStack),
    features: list(s.features, d.features),
    backendFunctions: list(s.backendFunctions, d.backendFunctions),
    supportText: typeof s.supportText === "string" ? s.supportText : d.supportText,
  };
}
