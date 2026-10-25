import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.10.0";

// Microsoft Clarity "project live insights" export API.
// Docs: https://learn.microsoft.com/clarity/setup-and-installation/clarity-data-export-api
// Hard limit: 10 requests per day per project, so the admin Analytics page
// caches what this returns in Firestore (appConfig/clarityInsights) and only
// calls here when asked (or when its copy is hours old).
const CLARITY_ENDPOINT = Deno.env.get("PF_CLARITY_ENDPOINT") ?? "https://www.clarity.ms/export-data/api/v1/project-live-insights";

// PF_-prefixed since this Supabase project is shared with other apps.
const firebaseProjectId = Deno.env.get("PF_FIREBASE_PROJECT_ID");
const clarityToken = Deno.env.get("PF_CLARITY_TOKEN");

const firebaseJwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

function corsHeaders(request: Request) {
  return {
    "Access-Control-Allow-Origin": request.headers.get("origin") ?? "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json" },
  });
}

function userMessage(status: number, code: string, message: string) {
  return { status, code, message };
}

// Same retry as audio-admin's identical helper (Firestore REST has a stricter
// per-minute quota than the app's own listeners; a transient 429 must not
// become a false "forbidden").
async function fetchWithRetry(url: string, init?: RequestInit, attempts = 3) {
  let response: Response;
  for (let i = 0; i < attempts; i++) {
    response = await fetch(url, init);
    if (response.status !== 429) return response;
    if (i < attempts - 1) {
      await response.body?.cancel().catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 250 * (i + 1)));
    }
  }
  return response!;
}

// Admin-only: a valid Firebase session whose users/{uid} document has role
// "admin" (checked with the caller's own token).
async function requireAdmin(request: Request) {
  if (!firebaseProjectId) throw userMessage(500, "server_misconfigured", "This feature is not configured yet.");

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw userMessage(401, "authentication_required", "Please sign in.");

  let uid: string;
  try {
    const { payload } = await jwtVerify(token, firebaseJwks, {
      audience: firebaseProjectId,
      issuer: `https://securetoken.google.com/${firebaseProjectId}`,
    });
    if (!payload.sub) throw new Error("Missing Firebase subject");
    uid = payload.sub;
  } catch (error) {
    console.warn("Firebase token verification failed", error);
    throw userMessage(401, "invalid_session", "Your session has expired. Please sign in again.");
  }

  const response = await fetchWithRetry(
    `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/users/${uid}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const record = response.ok ? await response.json() : null;
  if (record?.fields?.role?.stringValue !== "admin") {
    throw userMessage(403, "admin_required", "Admin access required.");
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);
  if (!clarityToken) return json(request, { error: "Clarity isn't connected yet.", code: "missing_clarity_token" }, 500);

  try {
    await requireAdmin(request);

    // deno-lint-ignore no-explicit-any
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // no body — defaults below
    }
    const numOfDays = [1, 2, 3].includes(Number(body?.numOfDays)) ? Number(body.numOfDays) : 3;

    let response: Response;
    try {
      response = await fetch(`${CLARITY_ENDPOINT}?numOfDays=${numOfDays}`, {
        headers: { Authorization: `Bearer ${clarityToken}`, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Clarity request threw", error);
      throw userMessage(502, "clarity_unreachable", "We couldn't reach Microsoft Clarity. Please try again in a moment.");
    }

    if (response.status === 429) {
      throw userMessage(429, "clarity_limit", "Microsoft Clarity's daily limit (10 requests) has been reached. Try again tomorrow.");
    }
    if (response.status === 401 || response.status === 403) {
      console.error("Clarity rejected the token", response.status);
      throw userMessage(502, "clarity_unauthorized", "Microsoft Clarity rejected the access token. It may need to be replaced.");
    }
    if (!response.ok) {
      console.error("Clarity request failed", response.status, await response.text().catch(() => ""));
      throw userMessage(502, "clarity_failed", "Microsoft Clarity couldn't return data right now.");
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw userMessage(502, "clarity_parse_failed", "We couldn't read Microsoft Clarity's response.");
    }
    if (!Array.isArray(data)) throw userMessage(502, "clarity_unexpected", "Microsoft Clarity returned something unexpected.");

    return json(request, { data, numOfDays, fetchedAt: Date.now() });
  } catch (error) {
    if (error && typeof error === "object" && "status" in error) {
      const expected = error as { status: number; code: string; message: string };
      return json(request, { error: expected.message, code: expected.code }, expected.status);
    }
    console.error("Unexpected clarity-insights error", error);
    return json(request, { error: "We couldn't load Clarity data right now.", code: "internal_error" }, 500);
  }
});
