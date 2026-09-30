////////////////////////////////////////////////////////////////
// WHAT'S NEW — the /whats-new page's content.
//
// Add a new entry here every time a user-facing update ships.
// Newest entry goes FIRST (the page renders this list top to
// bottom, unsorted) — everything else is cosmetic.
//
// Shape of one entry:
//   id:      unique, stable string (never reused/changed once shipped)
//   date:    "YYYY-MM-DD"
//   title:   short, user-facing headline (not a commit message)
//   details: 1-3 sentences, plain language, what changed and why
//            a user would care
//   minor:   optional array of short strings — smaller things that
//            shipped alongside the headline feature, shown behind
//            a "N smaller updates" toggle. Leave as [] if there
//            aren't any worth calling out.
////////////////////////////////////////////////////////////////

export const WHATS_NEW = [
  {
    id: "nav-discoverability-2026-09-29",
    date: "2026-09-29",
    title: "Playlists, Downloads, and More Are Easier to Find",
    details:
      "Your account menu (tap your profile circle, top right) now lists every page available to you — Playlists, Downloads, Notes, Bookmarks, Goals, and Year in Review included. No more digging for pages that were there all along.",
    minor: [],
  },
  {
    id: "cast-to-tv-2026-09-25",
    date: "2026-09-25",
    title: "Cast Sermons to Your TV",
    details:
      "Sermons and Sunday School recordings can now cast straight to a Chromecast, or pull up a QR code from the new Play on TV sheet to keep listening on a bigger screen.",
    minor: [],
  },
  {
    id: "goals-year-in-review-2026-09-25",
    date: "2026-09-25",
    title: "Listening Goals, Streaks & Your Year in Review",
    details:
      "Set a listening goal, build a streak, and celebrate hitting it. At year's end, get a shareable Year in Review card summarizing everything you've listened to.",
    minor: [],
  },
  {
    id: "search-transcripts-2026-09-25",
    date: "2026-09-25",
    title: "Search Everything, Including Full Transcripts",
    details:
      "One search bar (top right) now covers sermons, Doctrine, resources, videos, documents, notes, and Scripture references. Sermons also got full searchable transcripts — jump to any moment, highlight Scripture, and export the text.",
    minor: [],
  },
  {
    id: "notes-bookmarks-2026-09-25",
    date: "2026-09-25",
    title: "Notes & Bookmarks, Reimagined",
    details:
      "Notes are now timestamped and categorized, support markdown and checklists, and stay visible while you keep listening. New Notes and Bookmarks pages let you browse everything you've saved in one place.",
    minor: [],
  },
  {
    id: "playlists-2026-09-25",
    date: "2026-09-25",
    title: "Playlists",
    details:
      "Build your own collections of recordings — create, rename, reorder, share, and even download an entire playlist for offline listening. Add to a playlist right from any recording's card.",
    minor: [],
  },
  {
    id: "downloads-page-2026-09-25",
    date: "2026-09-25",
    title: "A Dedicated Downloads Page",
    details:
      "See exactly what you've downloaded, how much space it's using, and when you saved it. Download several recordings at once, queue downloads for later, and undo an accidental delete.",
    minor: [
      "Fixed a bug where your lists showed empty while offline instead of your cached and downloaded recordings",
      "Search, filter, and sort got faster across every list, with toast confirmations and loading skeletons",
    ],
  },
  {
    id: "driving-mode-2026-09-25",
    date: "2026-09-25",
    title: "Driving Mode & Smarter Playback",
    details:
      "A new driving mode plus richer lock-screen controls make playback easier to manage without looking at your phone, and audio now auto-resumes when your car or Bluetooth reconnects.",
    minor: [
      "Player settings overlay, a previous-track button, queue upgrades, in-player bookmarks, and automatic retry if a recording fails to load",
      "A Weekly Topic slider added to the Doctrine Campaign page, with admin-managed weeks and a default week",
    ],
  },
  {
    id: "offline-downloads-2026-09-16",
    date: "2026-09-16",
    title: "Download Sermons for Offline Listening",
    details:
      "Save up to 5 recordings right on your device so you can listen with no connection at all — on a flight, at camp, wherever.",
    minor: [
      "An offline/online indicator plus a global \"Back to Top\" button",
      "New and Duration badges, one-tap deep links, and copy/share on every recording",
    ],
  },
  {
    id: "liked-sermons-2026-09-16",
    date: "2026-09-16",
    title: "Liked Sermons",
    details:
      "\"Saved\" is now \"Liked Sermons,\" with a heart icon instead of a save button — same feature, easier to recognize.",
    minor: [],
  },
  {
    id: "auto-resume-2026-09-16",
    date: "2026-09-16",
    title: "Pick Up Right Where You Left Off",
    details:
      "Open the app and it automatically resumes whatever you were last listening to. (Requires being signed in, since that's how the app remembers your spot.)",
    minor: [],
  },
  {
    id: "player-overhaul-2026-09-14",
    date: "2026-09-14",
    title: "A Smarter Audio Player",
    details:
      "A full overhaul of the player: a real queue, a sleep timer, a mini player that follows you around the app, and the ability to choose your playback device.",
    minor: [
      "Completed / Resume / Not Started status shown right on each recording's card",
      "A \"Related\" section on the player page that finds similar sermons via AI summary matching",
    ],
  },
  {
    id: "ai-summaries-2026-09-14",
    date: "2026-09-14",
    title: "AI-Generated Sermon Summaries",
    details:
      "The first time a sermon is played, the app generates a short AI summary automatically — no admin work required.",
    minor: [],
  },
  {
    id: "launch-2026-03-31",
    date: "2026-03-31",
    title: "Palouse Fellowship Sermons App Launches!",
    details:
      "The first public release of the app — browse and stream sermons and Sunday School recordings, right from your phone or computer.",
    minor: ["Continued design refinements and new pages added in the weeks that followed"],
  },
];
