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

function firestoreField(document: Record<string, unknown>, name: string) {
  const field = (document.fields as Record<string, { stringValue?: string }> | undefined)?.[name];
  return field?.stringValue;
}

async function getFirestoreAudio(firebaseToken: string, audioId: string) {
  if (!firebaseProjectId || !/^[A-Za-z0-9_-]{1,150}$/.test(audioId)) {
    throw userMessage(400, "invalid_audio", "This audio file cannot be summarized.");
  }
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/audio/${audioId}`,
    { headers: { Authorization: `Bearer ${firebaseToken}` } },
  );
  if (response.status === 404) throw userMessage(404, "audio_not_found", "This audio file is no longer available.");
  if (!response || !response.ok) {
    console.error("Firestore audio read failed", response.status, await response.text());
    throw userMessage(403, "audio_access_denied", "You don't have access to this audio file.");
  }
  return await response.json() as Record<string, unknown>;
}

async function saveFirestoreSummary(firebaseToken: string, audioId: string, summary: string) {
  const url = new URL(`https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/audio/${audioId}`);
  url.searchParams.set("updateMask.fieldPaths", "aiSummary");
  const response = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${firebaseToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: { aiSummary: { stringValue: summary } } }),
  });
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

  let response = await sendTranscriptionRequest(form);
  let failureDetails = response.ok ? "" : await response.text();

  // A few storage providers serve audio to browsers but reject Groq's remote
  // fetch. For files within Groq's multipart limit, retry with a secure server
  // side download. The URL was already checked against the Firestore record.
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
    throw userMessage(502, "transcription_failed", "We couldn't transcribe this audio right now. Please try again.");
  }
  const data = await response.json();
  if (!data.text || typeof data.text !== "string") {
    throw userMessage(502, "transcription_empty", "We couldn't find speech to summarize in this audio.");
  }
  return data.text;
}

async function summarize(transcript: string, audioType: string, title: string) {
  const contentType = audioType === "sundayschool" ? "Sunday School lesson" : audioType;
  const prompt = `Summarize this ${contentType} titled "${title}" for a church listening app.\n\nUse this exact readable plain-text structure:\nMain topic:\nA concise paragraph.\n\nKey points:\n• 3 to 6 concrete points\n\nScripture references:\n• List only references that are actually mentioned; write "Not specifically mentioned" if none are clear.\n\nTakeaway:\nA short, pastoral and practical application.\n\nDo not invent quotations, Bible references, claims, speakers, or details.\n\nTranscript:\n${transcript.slice(0, MAX_TRANSCRIPT_CHARS)}`;
  const response = await fetch(`${GROQ_API_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${groqApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      temperature: 0.2,
      max_completion_tokens: 900,
      messages: [{ role: "system", content: "You create accurate, concise church-audio summaries." }, { role: "user", content: prompt }],
    }),
  });
  if (!response.ok) {
    console.error("Groq summary failed", response.status, await response.text());
    throw userMessage(502, "summary_failed", "We couldn't generate the summary right now. Please try again.");
  }
  const data = await response.json();
  const summary = data.choices?.[0]?.message?.content?.trim();
  if (!summary) throw userMessage(502, "summary_empty", "We couldn't generate the summary right now. Please try again.");
  return summary;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);
  if (!groqApiKey) return json(request, { error: "AI summaries are not configured yet.", code: "missing_groq_key" }, 500);

  try {
    const { token } = await requireFirebaseUser(request);
    const body = await request.json();
    if (!allowedTypes.has(body.audioType)) throw userMessage(400, "invalid_type", "This content type cannot be summarized.");
    const audioId = body.audioId;
    const audioUrl = validateAudioUrl(body.audioUrl);
    const title = typeof body.title === "string" ? body.title.slice(0, 300) : "Untitled audio";
    const audioRecord = await getFirestoreAudio(token, audioId);
    const isB2Audio = Boolean(firestoreField(audioRecord, "audioStorageKey"));
    if ((!isB2Audio && firestoreField(audioRecord, "audioURL") !== audioUrl) || firestoreField(audioRecord, "type") !== body.audioType) {
      throw userMessage(400, "audio_mismatch", "This audio file cannot be summarized.");
    }
    const force = body.force === true;
    const cachedSummary = firestoreField(audioRecord, "aiSummary");
    if (cachedSummary && !force) return json(request, { summary: cachedSummary, cached: true });
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
