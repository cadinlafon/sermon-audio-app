import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.10.0";

const GROQ_API_URL = "https://api.groq.com/openai/v1";
const MAX_DIGEST_CHARS = 30_000;

// PF_-prefixed since this Supabase project is shared with other apps —
// generic names like GROQ_API_KEY would collide with their secrets.
const firebaseProjectId = Deno.env.get("PF_FIREBASE_PROJECT_ID");
const groqApiKey = Deno.env.get("PF_GROQ_API_KEY");

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

// Same retry as audio-admin's identical helper: Firestore's REST API has a
// stricter per-minute quota than the app's own listeners, and a transient
// 429 must not turn into a false "forbidden".
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

// This summary contains user names and what they did in the app, so unlike
// the public AI features it is admin-only: a valid Firebase session whose
// users/{uid} document has role "admin" (checked with the caller's own token).
async function requireAdmin(request: Request) {
  if (!firebaseProjectId) {
    throw userMessage(500, "server_misconfigured", "This feature is not configured yet.");
  }

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

function buildPrompt(periodLabel: string, digest: unknown) {
  return `You are writing a plain-language activity report for the admin of a church sermon-audio app (Palouse Fellowship). The data below is everything that happened ${periodLabel}.

Write it as a short, friendly narrative — like an assistant telling the admin what happened. Style example: "Today, 1 user signed up. Their name is Jane Doe. Cadin LaFon was active today, playing the sermon 'Cain Kills Abel' and visiting the Dev Info page."

Rules:
- Use ONLY the facts in the data. Never invent names, sermons, pages, numbers, or events.
- Start with new sign-ups (names), then each active user and what they did (sermons they played, pages they visited, notable actions), then signed-out visitors and overall listening (total plays, most-played sermons).
- Group a quiet or repetitive user into one short sentence. Skip sections that have nothing in them.
- Mention a user's repeat counts naturally (for example "three times") when the data shows "(x3)".
- If nothing happened, say so in one sentence.
- Plain text only: short paragraphs, no markdown symbols, no headings, no lists. Keep it under 250 words.

DATA (JSON):
${JSON.stringify(digest)}`;
}

async function askGroq(periodLabel: string, digest: unknown) {
  let response: Response;
  try {
    response = await fetch(`${GROQ_API_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${groqApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        temperature: 0.3,
        // gpt-oss-120b is a reasoning model: thinking tokens count against
        // this budget, so leave plenty of room beyond the ~300-token answer.
        max_completion_tokens: 2000,
        messages: [
          { role: "system", content: "You write accurate, concise activity reports from structured data and never invent facts." },
          { role: "user", content: buildPrompt(periodLabel, digest) },
        ],
      }),
    });
  } catch (error) {
    console.error("Groq activity-summary request threw", error);
    throw userMessage(502, "summary_unreachable", "We couldn't reach the AI service. Please try again in a moment.");
  }

  if (!response.ok) {
    console.error("Groq activity-summary request failed", response.status, await response.text().catch(() => ""));
    throw userMessage(502, "summary_failed", "The AI service couldn't write the summary right now.");
  }

  let data: Record<string, unknown>;
  try {
    data = await response.json();
  } catch (error) {
    console.error("Groq activity-summary response wasn't valid JSON", error);
    throw userMessage(502, "summary_parse_failed", "We couldn't read the AI's answer.");
  }

  const choices = data.choices as Array<{ message?: { content?: string } }> | undefined;
  const text = choices?.[0]?.message?.content?.trim();
  if (!text) throw userMessage(502, "summary_empty", "The AI returned an empty summary. Please try again.");
  return text;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);
  if (!groqApiKey) return json(request, { error: "This feature is not configured yet.", code: "missing_groq_key" }, 500);

  try {
    await requireAdmin(request);

    // deno-lint-ignore no-explicit-any
    let body: any;
    try {
      body = await request.json();
    } catch {
      throw userMessage(400, "invalid_request", "This request couldn't be read. Please try again.");
    }

    const period = body?.period === "week" ? "week" : "today";
    const periodLabel = period === "week" ? "this week (since Sunday)" : "today";

    const digestText = JSON.stringify(body?.digest ?? null);
    if (!body?.digest || typeof body.digest !== "object") throw userMessage(400, "invalid_request", "No activity data to summarize.");
    if (digestText.length > MAX_DIGEST_CHARS) throw userMessage(413, "too_large", "There is too much activity to summarize at once.");

    const summary = await askGroq(periodLabel, body.digest);
    return json(request, { summary });
  } catch (error) {
    if (error && typeof error === "object" && "status" in error) {
      const expected = error as { status: number; code: string; message: string };
      return json(request, { error: expected.message, code: expected.code }, expected.status);
    }
    console.error("Unexpected admin-activity-summary error", error);
    return json(request, { error: "We couldn't write the summary right now.", code: "internal_error" }, 500);
  }
});
