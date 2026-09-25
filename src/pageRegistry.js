////////////////////////////////////////////////////////////////
// PAGE REGISTRY
//
// The single source of truth for which application pages are
// managed by the admin Page Manager. Firestore ("pages/{id}")
// only ever stores *overrides* on top of these defaults, so a
// page that has never been touched in Page Manager still works
// exactly as it always has.
//
// navSlot:
//   "primary" -> shown as an icon tab in the bottom nav bar
//   "more"    -> shown inside the bottom nav "More" sheet
//   "account" -> shown in the top bar account dropdown only
//   null      -> not shown in navigation at all (e.g. Home)
////////////////////////////////////////////////////////////////

export const PAGE_REGISTRY = [
  {
    id: "home",
    route: "/",
    defaultName: "Home",
    defaultIcon: "/navigation/home.png",
    defaultDescription: "The main landing page with notices and quick links.",
    navSlot: "primary",
    defaultOrder: 0,
  },
  {
    id: "doctrine",
    route: "/doctrine",
    defaultName: "Doctrine",
    defaultIcon: "📖",
    defaultDescription: "Weekly memorization, recordings, and doctrine campaign info.",
    navSlot: "primary",
    defaultOrder: 1,
  },
  {
    id: "sermons",
    route: "/sermons",
    defaultName: "Sermons",
    defaultIcon: "/navigation/sermons.png",
    defaultDescription: "Browse and listen to sermon recordings.",
    navSlot: "primary",
    defaultOrder: 2,
  },
  {
    id: "sundayschool",
    route: "/sundayschool",
    defaultName: "Sunday School",
    defaultIcon: "/navigation/sundayschool.png",
    defaultDescription: "Sunday school recordings and materials.",
    navSlot: "primary",
    defaultOrder: 3,
  },
  {
    id: "about",
    route: "/about",
    defaultName: "About",
    defaultIcon: "ℹ️",
    defaultDescription: "About the app and Palouse Fellowship.",
    navSlot: "more",
    defaultOrder: 0,
  },
  {
    id: "feedback",
    route: "/feedback",
    defaultName: "Feedback",
    defaultIcon: "💬",
    defaultDescription: "Send feedback about the app.",
    navSlot: "more",
    defaultOrder: 1,
  },
  {
    id: "contact",
    route: "/contact",
    defaultName: "Contact",
    defaultIcon: "✉️",
    defaultDescription: "Contact information for the church.",
    navSlot: "more",
    defaultOrder: 2,
  },
  {
    id: "resources",
    route: "/resources",
    defaultName: "Resources",
    defaultIcon: "📚",
    defaultDescription: "A library of sermons, studies, and helpful content.",
    navSlot: "more",
    defaultOrder: 3,
  },
  {
    id: "your-listens",
    route: "/your-listens",
    defaultName: "Your Listens",
    defaultIcon: "🎧",
    defaultDescription: "A history of what you've listened to.",
    navSlot: "account",
    defaultOrder: 0,
    defaultRequireLogin: true,
  },
  {
    id: "saved",
    route: "/saved",
    defaultName: "Liked Sermons",
    defaultIcon: "❤️",
    defaultDescription: "Sermons and recordings you've liked.",
    navSlot: "account",
    defaultOrder: 1,
    defaultRequireLogin: true,
  },
  {
    id: "notes",
    route: "/notes",
    defaultName: "Notes",
    defaultIcon: "📝",
    defaultDescription: "Everything you've written while listening.",
    navSlot: "account",
    defaultOrder: 2,
    defaultRequireLogin: true,
  },
  {
    id: "bookmarks",
    route: "/bookmarks",
    defaultName: "Bookmarks",
    defaultIcon: "🔖",
    defaultDescription: "Moments you've saved in recordings.",
    navSlot: "account",
    defaultOrder: 2,
    defaultRequireLogin: true,
  },
  {
    id: "playlists",
    route: "/playlists",
    defaultName: "Playlists",
    defaultIcon: "🎶",
    defaultDescription: "Your own collections of recordings.",
    navSlot: "account",
    defaultOrder: 2,
    defaultRequireLogin: true,
  },
  {
    id: "downloads",
    route: "/downloads",
    defaultName: "Downloads",
    defaultIcon: "⬇️",
    defaultDescription: "Audio saved on this device for offline listening.",
    navSlot: "account",
    defaultOrder: 2,
    defaultRequireLogin: true,
  },
  {
    id: "stats",
    route: "/stats",
    defaultName: "Stats",
    defaultIcon: "📊",
    defaultDescription: "Your personal listening stats.",
    navSlot: "account",
    defaultOrder: 2,
    defaultRequireLogin: true,
  },
  {
    id: "suggest",
    route: "/suggest",
    defaultName: "Suggest Feature",
    defaultIcon: "💡",
    defaultDescription: "Suggest a new feature for the app.",
    navSlot: "account",
    defaultOrder: 3,
    defaultRequireLogin: true,
  },
  {
    id: "settings",
    route: "/settings",
    defaultName: "Settings",
    defaultIcon: "⚙️",
    defaultDescription: "Account and app settings.",
    navSlot: "account",
    defaultOrder: 4,
    defaultRequireLogin: true,
  },
];

export function getRegistryEntry(id) {
  return PAGE_REGISTRY.find((p) => p.id === id) || null;
}
