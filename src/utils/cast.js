// Google Cast (Chromecast) sender SDK loader. The SDK only works in Chrome /
// Edge-family browsers; elsewhere it reports unavailable and the UI says so.
const SDK_URL = "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";
let sdkPromise = null;

export function loadCastSdk() {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("Cast isn't available here."));
    if (window.cast?.framework && window.chrome?.cast) return resolve(true);
    const timer = setTimeout(() => reject(new Error("Cast took too long to load.")), 10000);
    window.__onGCastApiAvailable = (ok) => {
      clearTimeout(timer);
      if (ok) resolve(true);
      else reject(new Error("Chromecast isn't supported in this browser. Use Chrome or Edge, or try TV mode."));
    };
    const s = document.createElement("script");
    s.src = SDK_URL;
    s.async = true;
    s.onerror = () => { clearTimeout(timer); reject(new Error("Couldn't load Chromecast support. Check your connection.")); };
    document.head.appendChild(s);
  });
  sdkPromise.catch(() => { sdkPromise = null; });
  return sdkPromise;
}

const TYPES = { mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav", ogg: "audio/ogg", flac: "audio/flac", mp4: "audio/mp4" };
export function guessContentType(sermon) {
  const ext = String(sermon?.audioStorageKey || sermon?.transcribeStorageKey || "").split("?")[0].split(".").pop().toLowerCase();
  return TYPES[ext] || "audio/mpeg";
}
