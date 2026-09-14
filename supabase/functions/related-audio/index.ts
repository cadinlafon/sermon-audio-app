import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.10.0";

const GROQ_API_URL = "https://api.groq.com/openai/v1";
const MAX_CANDIDATES = 60;
const MAX_SUMMARY_CHARS = 400;
const RESULT_COUNT = 5;

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

async function requireFirebaseUser(request: Request) {
  if (!firebaseProjectId) {
    throw userMessage(500, "server_misconfigured", "This feature is not configured yet.");
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    throw userMessage(401, "authentication_required", "Please sign in to see related content.");
  }

  try {
    const { payload } = await jwtVerify(token, firebaseJwks, {
      audience: firebaseProjectId,
      issuer: `https://securetoken.google.com/${firebaseProjectId}`,
    });
    if (!payload.sub) throw new Error("Missing Firebase subject");
  } catch (error) {
    console.warn("Firebase token verification failed", error);
    throw userMessage(401, "invalid_session", "Your session has expired. Please sign in again.");
  }
}

function sanitizeText(value: unknown, max: number) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function sanitizeId(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,150}$/.test(value) ? value : null;
}

type Candidate = { id: string; title: string; summary: string };

async function askGroqForRelated(currentTitle: string, currentSummary: string, candidates: Candidate[]) {
  const list = candidates
    .map((c, i) => `${i + 1}. id="${c.id}" title="${c.title}"\nsummary: ${c.summary}`)
    .join("\n\n");

  const prompt = `You are matching related church audio content by topic and theme, using each item's AI-generated summary.

Current content:
title="${currentTitle}"
summary: ${currentSummary}

Candidate content:
${list}

Pick up to ${RESULT_COUNT} candidates whose topic/themes are most related to the current content. Respond with ONLY a JSON array of the chosen candidate "id" strings, most related first — e.g. ["id3","id7"]. If nothing is meaningfully related, respond with [].`;

  let response: Response;
  try {
    response = await fetch(`${GROQ_API_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${groqApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        temperature: 0.1,
        max_completion_tokens: 200,
        messages: [
          { role: "system", content: "You return only valid JSON, nothing else — no prose, no markdown fences." },
          { role: "user", content: prompt },
        ],
      }),
    });
  } catch (error) {
    console.error("Groq related-audio request threw", error);
    throw userMessage(502, "related_unreachable", "We couldn't reach the related-content service. Please try again in a moment.");
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    console.error("Groq related-audio request failed", response.status, bodyText);
    throw userMessage(502, "related_failed", "We couldn't find related content right now.");
  }

  let data: Record<string, unknown>;
  try {
    data = await response.json();
  } catch (error) {
    console.error("Groq related-audio response wasn't valid JSON", error);
    throw userMessage(502, "related_parse_failed", "We couldn't read the related-content result.");
  }

  const choices = data.choices as Array<{ message?: { content?: string } }> | undefined;
  const content = choices?.[0]?.message?.content?.trim() || "[]";
  const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

  let ids: unknown;
  try {
    ids = JSON.parse(cleaned);
  } catch {
    // The model occasionally wraps the array in prose despite instructions —
    // fall back to scanning quoted ids out of whatever text came back.
    ids = [...cleaned.matchAll(/"([A-Za-z0-9_-]{1,150})"/g)].map((m) => m[1]);
  }

  if (!Array.isArray(ids)) return [];
  const validIds = new Set(candidates.map((c) => c.id));
  return ids.filter((id): id is string => typeof id === "string" && validIds.has(id)).slice(0, RESULT_COUNT);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);
  if (!groqApiKey) return json(request, { error: "This feature is not configured yet.", code: "missing_groq_key" }, 500);

  try {
    await requireFirebaseUser(request);

    // deno-lint-ignore no-explicit-any
    let body: any;
    try {
      body = await request.json();
    } catch {
      throw userMessage(400, "invalid_request", "This request couldn't be read. Please try again.");
    }

    const currentTitle = sanitizeText(body.currentTitle, 300);
    const currentSummary = sanitizeText(body.currentSummary, 2000);
    if (!currentSummary) throw userMessage(400, "invalid_request", "No summary to match against.");

    const rawCandidates = Array.isArray(body.candidates) ? body.candidates : [];
    const candidates: Candidate[] = rawCandidates
      // deno-lint-ignore no-explicit-any
      .map((c: any) => {
        const id = sanitizeId(c?.id);
        const summary = sanitizeText(c?.summary, MAX_SUMMARY_CHARS);
        if (!id || !summary) return null;
        return { id, title: sanitizeText(c?.title, 300), summary };
      })
      .filter((c: Candidate | null): c is Candidate => c !== null)
      .slice(0, MAX_CANDIDATES);

    if (candidates.length === 0) return json(request, { relatedIds: [] });

    const relatedIds = await askGroqForRelated(currentTitle, currentSummary, candidates);
    return json(request, { relatedIds });
  } catch (error) {
    if (error && typeof error === "object" && "status" in error) {
      const expected = error as { status: number; code: string; message: string };
      return json(request, { error: expected.message, code: expected.code }, expected.status);
    }
    console.error("Unexpected related-audio error", error);
    return json(request, { error: "We couldn't find related content right now.", code: "internal_error" }, 500);
  }
});
