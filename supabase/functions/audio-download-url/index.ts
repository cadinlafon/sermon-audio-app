import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.10.0";

// PF_-prefixed since this Supabase project is shared with other apps —
// generic names like BACKBLAZE_KEY_ID would collide with their secrets.
const firebaseProjectId = Deno.env.get("PF_FIREBASE_PROJECT_ID");
// Firebase Web API keys are meant to be public (they're shipped in every
// client bundle) — using it on unauthenticated Firestore reads routes
// them through the project's own quota instead of the much stricter
// shared "fully anonymous" abuse-prevention bucket.
const firebaseApiKey = Deno.env.get("PF_FIREBASE_API_KEY");
const b2KeyId = Deno.env.get("PF_BACKBLAZE_KEY_ID");
const b2ApplicationKey = Deno.env.get("PF_BACKBLAZE_APPLICATION_KEY");
const b2BucketId = Deno.env.get("PF_BACKBLAZE_BUCKET_ID");
const b2BucketName = Deno.env.get("PF_BACKBLAZE_BUCKET_NAME");
const firebaseJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
const ALLOWED_COLLECTIONS = new Set(["audio", "doctrineWeeks", "resources"]);

function cors(request: Request) {
  return { "Access-Control-Allow-Origin": request.headers.get("origin") ?? "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin" };
}
function respond(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(request), "Content-Type": "application/json" } });
}
// Listening doesn't require an account — the Sermons/Sunday School pages
// already show titles to anyone, so gating playback behind login would be
// inconsistent. If a token IS sent (a logged-in user), it's verified and
// used for the Firestore read; if not (or it's invalid/stale), we fall
// back to an anonymous Firestore read rather than failing the request —
// the same collections are already publicly readable from the client SDK.
async function optionalFirebaseToken(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!firebaseProjectId || !token) return null;
  try {
    await jwtVerify(token, firebaseJwks, { audience: firebaseProjectId, issuer: `https://securetoken.google.com/${firebaseProjectId}` });
    return token;
  } catch (err) {
    console.error("Firebase token verification failed, continuing as anonymous:", err instanceof Error ? err.message : err);
    return null;
  }
}
function textField(document: Record<string, unknown>, name: string) {
  return (document.fields as Record<string, { stringValue?: string }> | undefined)?.[name]?.stringValue;
}

async function fetchWithRetry(url: string, init?: RequestInit, attempts = 3) {
  let lastResponse: Response | null = null;
  for (let i = 0; i < attempts; i++) {
    const response = await fetch(url, init);
    if (response.status !== 429) return response;
    lastResponse = response;
    await response.body?.cancel().catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 250 * (i + 1)));
  }
  return lastResponse!;
}
async function createDownloadUrl(key: string) {
  if (!b2KeyId || !b2ApplicationKey || !b2BucketId || !b2BucketName) throw new Error("storage_unconfigured");
  const authorization = `Basic ${btoa(`${b2KeyId}:${b2ApplicationKey}`)}`;
  const account = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", { headers: { Authorization: authorization } });
  const accountData = await account.json();
  if (!account.ok) throw new Error("storage_unavailable");
  const apiUrl = accountData.apiInfo.storageApi.apiUrl;
  const downloadUrl = accountData.apiInfo.storageApi.downloadUrl;
  const tokenResponse = await fetch(`${apiUrl}/b2api/v3/b2_get_download_authorization`, {
    method: "POST", headers: { Authorization: accountData.authorizationToken, "Content-Type": "application/json" },
    body: JSON.stringify({ bucketId: b2BucketId, fileNamePrefix: key, validDurationInSeconds: 14400 }),
  });
  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok) throw new Error("storage_unavailable");
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `${downloadUrl}/file/${encodeURIComponent(b2BucketName)}/${encodedKey}?Authorization=${encodeURIComponent(tokenData.authorizationToken)}`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors(request) });
  if (request.method !== "POST") return respond(request, { error: "Method not allowed" }, 405);
  try {
    const body = await request.json();
    const { audioId, collection, storageKey: directStorageKey } = body;

    // Preferred path: the client already legitimately read this document
    // (it rendered the title/etc. from it) and can hand us the storage
    // key directly, skipping a redundant server-side Firestore lookup
    // entirely. This isn't a security downgrade — the old lookup never
    // did any access-control beyond "does this doc exist," so the client
    // already had equivalent access to this same field.
    if (typeof directStorageKey === "string" && /^audio\/[A-Za-z0-9._/-]{1,500}$/.test(directStorageKey) && !directStorageKey.includes("..")) {
      return respond(request, { url: await createDownloadUrl(directStorageKey), expiresIn: 14400 });
    }

    // Fallback path: look the storage key up via Firestore, for any
    // caller that only has an id (e.g. older clients, direct API use).
    const token = await optionalFirebaseToken(request);
    const col = typeof collection === "string" && ALLOWED_COLLECTIONS.has(collection) ? collection : "audio";
    if (typeof audioId !== "string" || !/^[A-Za-z0-9_-]{1,150}$/.test(audioId)) return respond(request, { error: "Invalid audio." }, 400);
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/${col}/${audioId}` +
      (!token && firebaseApiKey ? `?key=${encodeURIComponent(firebaseApiKey)}` : "");
    const record = await fetchWithRetry(
      firestoreUrl,
      token ? { headers: { Authorization: `Bearer ${token}` } } : {}
    );
    if (!record.ok) {
      console.error(`Firestore lookup failed for ${col}/${audioId}:`, record.status, await record.text().catch(() => ""));
      return respond(request, { error: "Audio not found." }, record.status === 404 ? 404 : 403);
    }
    const storageKey = textField(await record.json(), "audioStorageKey");
    if (!storageKey || !storageKey.startsWith("audio/")) return respond(request, { error: "This recording has not been migrated to private storage yet." }, 409);
    return respond(request, { url: await createDownloadUrl(storageKey), expiresIn: 14400 });
  } catch (error) {
    console.error("audio-download-url failed:", error);
    return respond(request, { error: "Audio storage is temporarily unavailable." }, 503);
  }
});
