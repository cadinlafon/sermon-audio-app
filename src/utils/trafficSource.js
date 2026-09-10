const STORAGE_KEY = "pf_traffic_source";
const VISITOR_ID_KEY = "pf_visitor_id";

/**
 * Known referral platforms. Add new ones here and they will
 * automatically show up as their own bucket everywhere in the
 * admin (Referrals page, quick links, etc.) with no other changes.
 */
export const PLATFORMS = {
  facebook: { label: "Facebook", icon: "📘", color: "#1877F2" },
  instagram: { label: "Instagram", icon: "📷", color: "#E1306C" },
  youtube: { label: "YouTube", icon: "▶️", color: "#FF0000" },
  tiktok: { label: "TikTok", icon: "🎵", color: "#111111" },
  chatgpt: { label: "ChatGPT", icon: "🤖", color: "#10A37F" },
  claude: { label: "Claude", icon: "✳️", color: "#D97757" },
  google: { label: "Google", icon: "🔍", color: "#4285F4" },
  email: { label: "Email", icon: "✉️", color: "#7a4f10" },
  sms: { label: "Text Message", icon: "💬", color: "#34c759" },
  qr: { label: "QR Code", icon: "🔳", color: "#3d2200" },
  bulletin: { label: "Church Bulletin", icon: "📰", color: "#8a5a2a" },
  other: { label: "Other", icon: "🔹", color: "#a85e18" },
  direct: { label: "Direct / Unknown", icon: "🔗", color: "#9b7040" },
};

function textIncludesAny(text, needles) {
  return needles.some((needle) => text.includes(needle));
}

/**
 * Maps a raw utm_source value and/or a referring domain to one of
 * our known platform keys. Case-insensitive and forgiving of
 * common shorthand (fb, ig, yt) so links don't need to be exact.
 */
export function normalizePlatform(rawSource, referrerHost) {
  const s = (rawSource || "").toLowerCase().trim();
  const r = (referrerHost || "").toLowerCase().trim();

  if (textIncludesAny(s, ["facebook", "fb"]) || textIncludesAny(r, ["facebook.com", "fb.com", "l.facebook.com"])) return "facebook";
  if (textIncludesAny(s, ["instagram", "ig"]) || textIncludesAny(r, ["instagram.com", "l.instagram.com"])) return "instagram";
  if (textIncludesAny(s, ["youtube", "yt"]) || textIncludesAny(r, ["youtube.com", "youtu.be"])) return "youtube";
  if (textIncludesAny(s, ["tiktok"]) || textIncludesAny(r, ["tiktok.com"])) return "tiktok";
  if (textIncludesAny(s, ["chatgpt", "openai"]) || textIncludesAny(r, ["chatgpt.com", "chat.openai.com", "openai.com"])) return "chatgpt";
  if (textIncludesAny(s, ["claude", "anthropic"]) || textIncludesAny(r, ["claude.ai", "anthropic.com"])) return "claude";
  if (textIncludesAny(s, ["google"]) || textIncludesAny(r, ["google.com", "google.co"])) return "google";
  if (textIncludesAny(s, ["email", "newsletter", "mailchimp"])) return "email";
  if (textIncludesAny(s, ["sms", "text"])) return "sms";
  if (textIncludesAny(s, ["qr"])) return "qr";
  if (textIncludesAny(s, ["bulletin", "flyer", "print"])) return "bulletin";

  if (!s && !r) return "direct";

  return "other";
}

/**
 * Returns the visitor's persistent anonymous ID.
 * This is NOT a Firebase user ID.
 */
export function getVisitorId() {
  let visitorId = localStorage.getItem(VISITOR_ID_KEY);

  if (!visitorId) {
    visitorId = crypto.randomUUID();
    localStorage.setItem(VISITOR_ID_KEY, visitorId);
  }

  return visitorId;
}

/**
 * Reads standard UTM parameters from the current URL. If none are
 * present, falls back to the browser's referrer domain so that
 * organic links shared inside apps like ChatGPT, Claude, or social
 * feeds (which usually don't carry UTM params) still get attributed
 * instead of silently counting as "direct".
 */
export function getCurrentTrafficSource() {
  const params = new URLSearchParams(window.location.search);

  const source = params.get("utm_source");
  const medium = params.get("utm_medium");
  const campaign = params.get("utm_campaign");
  const content = params.get("utm_content");
  const term = params.get("utm_term");
  const id = params.get("utm_id");

  if (source || medium || campaign || content || term || id) {
    return {
      source: source || null,
      medium: medium || null,
      campaign: campaign || null,
      content: content || null,
      term: term || null,
      id: id || null,
      platform: normalizePlatform(source, null),
      capturedAt: new Date().toISOString(),
    };
  }

  // No UTM parameters — fall back to the referrer domain.
  let referrerHost = null;
  try {
    if (document.referrer) {
      referrerHost = new URL(document.referrer).hostname;
    }
  } catch {
    referrerHost = null;
  }

  if (referrerHost && referrerHost !== window.location.hostname) {
    const platform = normalizePlatform(null, referrerHost);

    if (platform !== "direct") {
      return {
        source: referrerHost,
        medium: "referral",
        campaign: null,
        content: null,
        term: null,
        id: null,
        platform,
        capturedAt: new Date().toISOString(),
      };
    }
  }

  return null;
}

/**
 * Reads the stored attribution.
 */
export function getStoredTrafficSource() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) return null;

    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Saves a traffic source. We keep both firstTouch (never
 * overwritten once set) and latestTouch (always the newest).
 */
export function saveTrafficSource(source) {
  if (!source) return null;

  const existing = getStoredTrafficSource();

  const updated = {
    firstTouch: existing?.firstTouch || source,
    latestTouch: source,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

  return updated;
}

/**
 * Captures UTM/referrer attribution from the current page load.
 * If there's nothing new to capture, preserves whatever attribution
 * is already stored rather than overwriting it with "direct".
 *
 * IMPORTANT: this must run before any event is logged, or the very
 * first event for a new visitor will have no attribution attached.
 * It's called synchronously during render in App.jsx (not inside a
 * useEffect) specifically to guarantee that ordering.
 */
export function captureTrafficSource() {
  const current = getCurrentTrafficSource();

  if (current) {
    return saveTrafficSource(current);
  }

  return getStoredTrafficSource();
}

/**
 * Returns the attribution that should be attached to analytics
 * events and to a new user's signup record.
 */
export function getTrafficData() {
  const attribution = getStoredTrafficSource();

  const firstPlatform = attribution?.firstTouch
    ? attribution.firstTouch.platform || normalizePlatform(attribution.firstTouch.source, null)
    : "direct";

  const latestPlatform = attribution?.latestTouch
    ? attribution.latestTouch.platform || normalizePlatform(attribution.latestTouch.source, null)
    : "direct";

  return {
    visitorId: getVisitorId(),

    firstTrafficSource: attribution?.firstTouch?.source || null,
    firstTrafficMedium: attribution?.firstTouch?.medium || null,
    firstTrafficCampaign: attribution?.firstTouch?.campaign || null,
    firstPlatform,

    latestTrafficSource: attribution?.latestTouch?.source || null,
    latestTrafficMedium: attribution?.latestTouch?.medium || null,
    latestTrafficCampaign: attribution?.latestTouch?.campaign || null,
    latestPlatform,

    trafficCapturedAt: attribution?.latestTouch?.capturedAt || null,
  };
}