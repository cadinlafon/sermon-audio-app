// Checks a Cloudflare Turnstile token (the "are you a person?" widget) and
// answers { success: true } if it's genuine. Used by pages that gate on the
// same check as the Contact page — Dev Info and Sign Up. (The Contact page
// has its own function, contact-info, which does this AND returns the
// contact details.) Shares the PF_TURNSTILE_SECRET_KEY secret.
const TURNSTILE_SECRET = Deno.env.get("PF_TURNSTILE_SECRET_KEY");
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

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
  if (!TURNSTILE_SECRET) return json(request, { error: "The security check isn't configured yet." }, 500);

  // deno-lint-ignore no-explicit-any
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json(request, { error: "This request couldn't be read. Please try again." }, 400);
  }

  const token = typeof body?.token === "string" ? body.token : "";
  if (!token || token.length > 4096) return json(request, { error: "Missing verification token." }, 400);

  const remoteIp = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "";
  const form = new URLSearchParams();
  form.set("secret", TURNSTILE_SECRET);
  form.set("response", token);
  if (remoteIp) form.set("remoteip", remoteIp);

  let result: Record<string, unknown>;
  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, { method: "POST", body: form });
    result = await response.json();
  } catch (error) {
    console.error("Turnstile verification failed to run", error);
    return json(request, { error: "We couldn't verify the check right now. Please try again." }, 502);
  }

  if (!result.success) {
    console.warn("Turnstile verification failed", result["error-codes"]);
    return json(request, { error: "Verification failed. Please try the check again." }, 403);
  }

  return json(request, { success: true });
});
