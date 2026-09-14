import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.10.0";

const GROQ_API_URL = "https://api.groq.com/openai/v1";
const MAX_TRANSCRIPT_CHARS = 110_000;
const MAX_FALLBACK_UPLOAD_BYTES = 25 * 1024 * 1024;
const allowedTypes = new Set(["sermon", "homily", "sundayschool"]);

// PF_-prefixed since this Supabase project is shared with other apps —
// generic names like GROQ_API_KEY would collide with their secrets.
const firebaseProjectId = Deno.env.get("PF_FIREBASE_PROJECT_ID");
const firebaseStorageBucket = Deno.env.get("PF_FIREBASE_STORAGE_BUCKET");
const b2DownloadHostSuffix = ".backblazeb2.com";
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
    throw userMessage(500, "server_misconfigured", "AI summaries are not configured yet.");
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    throw userMessage(401, "authentication_required", "Please sign in to summarize audio.");
  }

  try {
    const { payload } = await jwtVerify(token, firebaseJwks, {
      audience: firebaseProjectId,
      issuer: `https://securetoken.google.com/${firebaseProjectId}`,
    });
    if (!payload.sub) throw new Error("Missing Firebase subject");
    return { payload, token };
  } catch (error) {
    console.warn("Firebase token verification failed", error);
    throw userMessage(401, "invalid_session", "Your session has expired. Please sign in again.");
  }
}

// Firestore's REST API (used here instead of the client SDK) enforces a
// separate, stricter per-minute quota than the gRPC/WebChannel protocol the
// app's own listeners use — a short burst of requests can trip a transient
// 429 that has nothing to do with real access. Retry those before treating
// the read as failed (see audio-download-url's identical helper).
async function fetchWithRetry(url: string | URL, init?: RequestInit, attempts = 3) {
  let response: Response;
  for (let i = 0; i < attempts; i++) {
    response = await fetch(url, init);
    if (response.status !== 429) return response;
    // Only discard the body when another attempt is actually coming — the
    // final attempt's response (429 or not) is returned to the caller,
    // whose own error handling reads its body. Cancelling it here first
    // left that read throwing "Body already consumed".
    if (i < attempts - 1) {
      await response.body?.cancel().catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 250 * (i + 1)));
    }
  }
  return response!;
}

async function saveFirestoreSummary(firebaseToken: string, audioId: string, summary: string) {
  const url = new URL(`https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/audio/${audioId}`);
  url.searchParams.set("updateMask.fieldPaths", "aiSummary");
  let response: Response;
  try {
    response = await fetchWithRetry(url, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${firebaseToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { aiSummary: { stringValue: summary } } }),
    });
  } catch (error) {
    console.error("Firestore summary save threw", error);
    throw userMessage(500, "summary_save_failed", "The summary was created but couldn't be saved. Please try again.");
  }
  if (!response || !response.ok) {
    console.error("Firestore summary save failed", response.status, await response.text());
    throw userMessage(500, "summary_save_failed", "The summary was created but couldn't be saved. Please try again.");
  }
}

function validateAudioUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2_048) {
    throw userMessage(400, "invalid_audio", "This audio file cannot be summarized.");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw userMessage(400, "invalid_audio", "This audio file cannot be summarized.");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const isSupabaseAudio = Boolean(
    supabaseUrl &&
      url.origin === new URL(supabaseUrl).origin &&
      url.pathname.startsWith("/storage/v1/object/public/audio/"),
  );
  const isFirebaseAudio = Boolean(
    firebaseStorageBucket &&
      url.hostname === "firebasestorage.googleapis.com" &&
      url.pathname.startsWith(`/v0/b/${firebaseStorageBucket}/o/`),
  );
  const isBackblazeAudio = url.hostname.endsWith(b2DownloadHostSuffix);

  if (url.protocol !== "https:" || (!isSupabaseAudio && !isFirebaseAudio && !isBackblazeAudio)) {
    throw userMessage(400, "untrusted_audio_url", "Only audio published by this app can be summarized.");
  }
  return url.toString();
}

async function sendTranscriptionRequest(form: FormData) {
  return await fetch(`${GROQ_API_URL}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${groqApiKey}` },
    body: form,
  });
}

function audioFileName(audioUrl: string) {
  const pathname = decodeURIComponent(new URL(audioUrl).pathname);
  return pathname.split("/").pop()?.replace(/[^a-zA-Z0-9._-]/g, "_") || "recording.mp3";
}

async function transcribe(audioUrl: string) {
  const form = new FormData();
  // Groq's current transcription API supports a URL, avoiding an unnecessary
  // download/re-upload through the Edge Function.
  form.append("url", audioUrl);
  form.append("model", "whisper-large-v3-turbo");
  form.append("language", "en");
  form.append("temperature", "0");
  form.append("response_format", "json");

  let response: Response;
  try {
    response = await sendTranscriptionRequest(form);
  } catch (error) {
    // A raw fetch() rejection (DNS blip, reset connection, timeout) isn't an
    // HTTP error response — left unhandled it falls through to the generic
    // 500 catch-all below with no useful message for the user or the logs.
    console.error("Groq transcription request threw", error);
    throw userMessage(502, "transcription_unreachable", "We couldn't reach the transcription service. Please try again in a moment.");
  }
  let failureDetails = response.ok ? "" : await response.text();

  // A few storage providers serve audio to browsers but reject Groq's remote
  // fetch. For files within Groq's multipart limit, retry with a secure server
  // side download. The URL was already restricted to this app's own storage
  // domains by validateAudioUrl.
  if (!response.ok) {
    try {
      const audioResponse = await fetch(audioUrl, { redirect: "error" });
      const size = Number(audioResponse.headers.get("content-length") ?? 0);
      if (audioResponse.ok && (!size || size <= MAX_FALLBACK_UPLOAD_BYTES)) {
        const audioBlob = await audioResponse.blob();
        if (audioBlob.size <= MAX_FALLBACK_UPLOAD_BYTES) {
          const uploadForm = new FormData();
          uploadForm.append("file", new File([audioBlob], audioFileName(audioUrl), { type: audioBlob.type || "audio/mpeg" }));
          uploadForm.append("model", "whisper-large-v3-turbo");
          uploadForm.append("language", "en");
          uploadForm.append("temperature", "0");
          uploadForm.append("response_format", "json");
          response = await sendTranscriptionRequest(uploadForm);
          failureDetails = response.ok ? "" : await response.text();
        }
      }
    } catch (error) {
      console.warn("Audio download fallback failed", error);
    }
  }
  if (!response.ok) {
    console.error("Groq transcription failed", response.status, failureDetails);
    // Groq's transcription API rejects files over 25MB outright (its own
    // hard limit) — worth its own message, since "try again" would never
    // help and the file itself isn't broken.
    if (failureDetails.includes("media_too_large")) {
      throw userMessage(413, "audio_too_large", "This recording is too long to summarize automatically — it's over the 25MB limit for AI transcription.");
    }
    throw userMessage(502, "transcription_failed", "We couldn't transcribe this audio right now. Please try again.");
  }
  let data: Record<string, unknown>;
  try {
    data = await response.json();
  } catch (error) {
    // A 2xx status doesn't guarantee a parseable body — a proxy timeout or
    // truncated response can still return non-JSON. Left unguarded this
    // throws raw and falls through to the generic catch-all.
    console.error("Groq transcription response wasn't valid JSON", error);
    throw userMessage(502, "transcription_parse_failed", "We couldn't read the transcription result. Please try again.");
  }
  if (!data.text || typeof data.text !== "string") {
    throw userMessage(502, "transcription_empty", "We couldn't find speech to summarize in this audio.");
  }
  return data.text;
}

async function summarize(transcript: string, audioType: string, title: string) {
  const contentType = audioType === "sundayschool" ? "Sunday School lesson" : audioType;
  const prompt = `Summarize this ${contentType} titled "${title}" for a church listening app.\n\nUse this exact readable plain-text structure:\nMain topic:\nA concise paragraph.\n\nKey points:\n• 3 to 6 concrete points\n\nScripture references:\n• List only references that are actually mentioned; write "Not specifically mentioned" if none are clear.\n\nTakeaway:\nA short, pastoral and practical application.\n\nDo not invent quotations, Bible references, claims, speakers, or details.\n\nTranscript:\n${transcript.slice(0, MAX_TRANSCRIPT_CHARS)}`;
  let response: Response;
  try {
    response = await fetch(`${GROQ_API_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${groqApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        temperature: 0.2,
        max_completion_tokens: 900,
        messages: [{ role: "system", content: "You create accurate, concise church-audio summaries." }, { role: "user", content: prompt }],
      }),
    });
  } catch (error) {
    console.error("Groq summary request threw", error);
    throw userMessage(502, "summary_unreachable", "We couldn't reach the summary service. Please try again in a moment.");
  }
  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    console.error("Groq summary failed", response.status, bodyText);
    throw userMessage(502, "summary_failed", "We couldn't generate the summary right now. Please try again.");
  }
  let data: Record<string, unknown>;
  try {
    data = await response.json();
  } catch (error) {
    console.error("Groq summary response wasn't valid JSON", error);
    throw userMessage(502, "summary_parse_failed", "We couldn't read the summary result. Please try again.");
  }
  const choices = data.choices as Array<{ message?: { content?: string } }> | undefined;
  const summary = choices?.[0]?.message?.content?.trim();
  if (!summary) throw userMessage(502, "summary_empty", "We couldn't generate the summary right now. Please try again.");
  return summary;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);
  if (!groqApiKey) return json(request, { error: "AI summaries are not configured yet.", code: "missing_groq_key" }, 500);

  try {
    const { token } = await requireFirebaseUser(request);
    // deno-lint-ignore no-explicit-any
    let body: any;
    try {
      body = await request.json();
    } catch {
      throw userMessage(400, "invalid_request", "This request couldn't be read. Please try again.");
    }
    if (!allowedTypes.has(body.audioType)) throw userMessage(400, "invalid_type", "This content type cannot be summarized.");
    const audioId = body.audioId;
    // The audioId is only used as the Firestore doc id to save the finished
    // summary to — it isn't looked up first (see fetchWithRetry's comment:
    // that redundant read was the actual source of every quota failure in
    // this function). validateAudioUrl below is what keeps this from being
    // pointed at an arbitrary URL; the client already had legitimate read
    // access to audioType/audioUrl from its own Firestore read of this doc.
    if (typeof audioId !== "string" || !/^[A-Za-z0-9_-]{1,150}$/.test(audioId)) {
      throw userMessage(400, "invalid_audio", "This audio file cannot be summarized.");
    }
    const audioUrl = validateAudioUrl(body.audioUrl);
    const title = typeof body.title === "string" ? body.title.slice(0, 300) : "Untitled audio";
    const transcript = await transcribe(audioUrl);
    const summary = await summarize(transcript, body.audioType, title);
    await saveFirestoreSummary(token, audioId, summary);
    return json(request, { summary, cached: false });
  } catch (error) {
    if (error && typeof error === "object" && "status" in error) {
      const expected = error as { status: number; code: string; message: string };
      return json(request, { error: expected.message, code: expected.code }, expected.status);
    }
    console.error("Unexpected summarize-audio error", error);
    return json(request, { error: "We couldn't generate the summary right now. Please try again.", code: "internal_error" }, 500);
  }
});
