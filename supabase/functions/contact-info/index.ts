// Verifies a Cloudflare Turnstile token and, only on success, returns
// the actual contact details. The point of gating this at all is to
// keep phone/email off the page (and out of the client JS bundle)
// until a real visitor has passed the challenge — so the values live
// only here, never in the React source, and are handed back exactly
// once verification succeeds.

const TURNSTILE_SECRET = Deno.env.get("PF_TURNSTILE_SECRET_KEY");
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const CONTACTS = {
  church: {
    name: "Jonathan Mcintosh",
    email: "jonathan@palousefellowship.com",
    phone: "208-596-0938",
  },
  support: {
    name: "Cadin LaFon",
    email: "Cadinlafon@gmail.com",
    phone: "208-874-3729",
  },
};

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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);
  if (!TURNSTILE_SECRET) return json(request, { error: "Contact reveal isn't configured yet." }, 500);

  // deno-lint-ignore no-explicit-any
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json(request, { error: "This request couldn't be read. Please try again." }, 400);
  }

  const token = typeof body.token === "string" ? body.token : "";
  if (!token) return json(request, { error: "Missing verification token." }, 400);

  const remoteIp = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "";

  const form = new URLSearchParams();
  form.set("secret", TURNSTILE_SECRET);
  form.set("response", token);
  if (remoteIp) form.set("remoteip", remoteIp);

  let verifyResponse: Response;
  try {
    verifyResponse = await fetch(TURNSTILE_VERIFY_URL, { method: "POST", body: form });
  } catch (error) {
    console.error("Turnstile verification request threw", error);
    return json(request, { error: "We couldn't verify the challenge right now. Please try again." }, 502);
  }

  let result: Record<string, unknown>;
  try {
    result = await verifyResponse.json();
  } catch (error) {
    console.error("Turnstile response wasn't valid JSON", error);
    return json(request, { error: "We couldn't verify the challenge right now. Please try again." }, 502);
  }

  if (!result.success) {
    console.warn("Turnstile verification failed", result["error-codes"]);
    return json(request, { error: "Verification failed. Please try the challenge again." }, 403);
  }

  return json(request, { success: true, contacts: CONTACTS });
});
