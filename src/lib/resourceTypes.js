////////////////////////////////////////////////////////////////
// RESOURCES — type registry
//
// One `resources` Firestore collection holds every resource type;
// this file is the single source of truth for what each type looks
// like (icon, form fields, card behavior) so adding a new type later
// means adding one entry here rather than touching every component.
////////////////////////////////////////////////////////////////

export const RESOURCE_TYPES = [
  "audio",
  "youtube",
  "spotify",
  "document",
  "website",
  "podcast",
  "book",
  "article",
  "image",
  "presentation",
  "download",
  "scripture",
  "course",
  "playlist",
];

export const RESOURCE_TYPE_META = {
  audio: { label: "Audio", icon: "🎧", actionLabel: "Play Audio" },
  youtube: { label: "YouTube Video", icon: "▶️", actionLabel: "Watch Video" },
  spotify: { label: "Spotify Podcast", icon: "🎵", actionLabel: "Listen on Spotify" },
  document: { label: "Document", icon: "📄", actionLabel: "Open Document" },
  website: { label: "Website / Web Link", icon: "🌐", actionLabel: "Visit Website" },
  podcast: { label: "Podcast", icon: "🎙️", actionLabel: "Listen" },
  book: { label: "Book", icon: "📖", actionLabel: "View Book" },
  article: { label: "Article", icon: "📰", actionLabel: "Read Article" },
  image: { label: "Image / Gallery", icon: "🖼️", actionLabel: "View Image" },
  presentation: { label: "Presentation", icon: "📊", actionLabel: "Open Presentation" },
  download: { label: "Download", icon: "⬇️", actionLabel: "Download" },
  scripture: { label: "Scripture / Bible Study", icon: "📖", actionLabel: "Open" },
  course: { label: "Course / Study", icon: "🎓", actionLabel: "Start Course" },
  playlist: { label: "Playlist", icon: "📋", actionLabel: "Open Playlist" },
};

export const DOWNLOAD_FILE_TYPES = ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "zip", "txt"];

export const FILE_TYPE_ICON = {
  pdf: "📕", doc: "📘", docx: "📘", ppt: "📊", pptx: "📊",
  xls: "📗", xlsx: "📗", zip: "🗜️", txt: "📃",
};

// Types whose "main content" is an external/openable link rather than
// something rendered inline (used to decide when to show the
// external-link indicator on a card).
export const EXTERNAL_LINK_TYPES = new Set(["website", "book", "article", "presentation"]);

// Types that contain other resources rather than being one themselves.
export const COLLECTION_TYPES = new Set(["playlist", "course"]);

export function getTypeMeta(type) {
  return RESOURCE_TYPE_META[type] || RESOURCE_TYPE_META.document;
}

////////////////////////////////////////////////////////////////
// FORM FIELD VISIBILITY
//
// Drives which fields ResourceForm shows for a given type. Fields
// not listed here are always shown (title, description, category,
// thumbnail, author, date, featured, published).
////////////////////////////////////////////////////////////////

export const TYPE_FIELDS = {
  audio: ["url", "uploadAudio", "duration"],
  youtube: ["url"],
  spotify: ["url", "episodeNumber"],
  document: ["url", "fileType"],
  website: ["url", "siteName"],
  podcast: ["url", "episodeNumber"],
  book: ["url", "publisher"],
  article: ["url"],
  image: ["images"],
  presentation: ["url"],
  download: ["url", "fileType"],
  scripture: ["scriptureReference", "url", "uploadAudio"],
  course: ["url", "items"],
  playlist: ["items"],
};

export function typeUsesField(type, field) {
  return (TYPE_FIELDS[type] || []).includes(field);
}

////////////////////////////////////////////////////////////////
// YOUTUBE
////////////////////////////////////////////////////////////////

export function extractYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function youTubeThumbnail(url) {
  const id = extractYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

export function youTubeEmbedUrl(url) {
  const id = extractYouTubeId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}

////////////////////////////////////////////////////////////////
// SPOTIFY
////////////////////////////////////////////////////////////////

// Matches open.spotify.com/{episode|show|track|album|playlist}/{id},
// with or without a leading "intl-xx/" locale segment or a "?si=..."
// share suffix, and the spotify:episode:{id} URI form too.
export function parseSpotifyLink(url) {
  if (!url) return null;

  const uriMatch = url.match(/spotify:(episode|show|track|album|playlist):([A-Za-z0-9]+)/);
  if (uriMatch) return { kind: uriMatch[1], id: uriMatch[2] };

  const urlMatch = url.match(
    /open\.spotify\.com\/(?:intl-[a-z-]+\/)?(episode|show|track|album|playlist)\/([A-Za-z0-9]+)/
  );
  if (urlMatch) return { kind: urlMatch[1], id: urlMatch[2] };

  return null;
}

export function spotifyEmbedUrl(url) {
  const parsed = parseSpotifyLink(url);
  return parsed ? `https://open.spotify.com/embed/${parsed.kind}/${parsed.id}` : null;
}

////////////////////////////////////////////////////////////////
// DEFAULTS
////////////////////////////////////////////////////////////////

export function blankResource(type = "audio") {
  return {
    type,
    title: "",
    description: "",
    url: "",
    thumbnailUrl: "",
    thumbnailStorageKey: "",
    categoryId: "",
    sectionIds: [],
    author: "",
    date: "",
    featured: false,
    published: true,
    order: 0,
    duration: null,
    audioStorageKey: "",
    audioFileName: "",
    episodeNumber: "",
    publisher: "",
    siteName: "",
    fileType: "",
    scriptureReference: "",
    images: [],
    items: [],
  };
}

////////////////////////////////////////////////////////////////
// SORT / FORMAT HELPERS
////////////////////////////////////////////////////////////////

export function formatResourceDate(value) {
  if (!value) return "";
  // Stored as a plain "YYYY-MM-DD" string (matches DoctrineAdmin's date fields).
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return "";
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "title", label: "Title (A–Z)" },
  { value: "type", label: "Resource Type" },
];

export function sortResources(list, sortBy) {
  const sorted = [...list];
  switch (sortBy) {
    case "oldest":
      return sorted.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    case "title":
      return sorted.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    case "type":
      return sorted.sort((a, b) => (a.type || "").localeCompare(b.type || ""));
    case "newest":
    default:
      return sorted.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }
}
