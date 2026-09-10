import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.10.0";

// PF_-prefixed since this Supabase project is shared with other apps —
// generic names like BACKBLAZE_KEY_ID would collide with their secrets.
const projectId = Deno.env.get("PF_FIREBASE_PROJECT_ID");
const bucketId = Deno.env.get("PF_BACKBLAZE_BUCKET_ID");
const keyId = Deno.env.get("PF_BACKBLAZE_ADMIN_KEY_ID");
const applicationKey = Deno.env.get("PF_BACKBLAZE_ADMIN_APPLICATION_KEY");
const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
const cors = (r: Request) => ({ "Access-Control-Allow-Origin": r.headers.get("origin") ?? "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin" });
const json = (r: Request, b: Record<string, unknown>, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors(r), "Content-Type": "application/json" } });

async function requireAdmin(r: Request) {
  const token = r.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || !projectId) throw new Error("unauthorized");
  const { payload } = await jwtVerify(token, jwks, { audience: projectId, issuer: `https://securetoken.google.com/${projectId}` });
  const user = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${payload.sub}`, { headers: { Authorization: `Bearer ${token}` } });
  const record = user.ok ? await user.json() : null;
  if (record?.fields?.role?.stringValue !== "admin") throw new Error("forbidden");
}
async function authorize() {
  if (!keyId || !applicationKey || !bucketId) throw new Error("unconfigured");
  const r = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", {
    headers: { Authorization: `Basic ${btoa(`${keyId}:${applicationKey}`)}` },
  });
  if (!r.ok) throw new Error("storage");
  return await r.json();
}
const validKey = (key: unknown) => typeof key === "string" && /^(audio|images)\/[A-Za-z0-9._/-]{1,500}$/.test(key) && !key.includes("..");

Deno.serve(async (r) => {
  if (r.method === "OPTIONS") return new Response("ok", { headers: cors(r) });
  if (r.method !== "POST") return json(r, { error: "Method not allowed" }, 405);
  try {
    await requireAdmin(r);
    const body = await r.json();
    const account = await authorize();
    const apiUrl = account.apiInfo.storageApi.apiUrl;
    if (body.action === "upload") {
      const mediaType = body.mediaType === "image" ? "image" : "audio";
      const prefix = mediaType === "image" ? "images" : "audio";
      const fallbackName = mediaType === "image" ? "image.jpg" : "audio.mp3";
      const name = typeof body.fileName === "string" ? body.fileName.replace(/[^A-Za-z0-9._-]/g, "_").slice(-160) : fallbackName;
      const storageKey = `${prefix}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${name}`;
      const upload = await fetch(`${apiUrl}/b2api/v3/b2_get_upload_url`, { method: "POST", headers: { Authorization: account.authorizationToken, "Content-Type": "application/json" }, body: JSON.stringify({ bucketId }) });
      const data = await upload.json();
      if (!upload.ok) throw new Error("storage");
      return json(r, { storageKey, uploadUrl: data.uploadUrl, uploadToken: data.authorizationToken });
    }
    if (body.action === "delete" && validKey(body.storageKey)) {
      const listed = await fetch(`${apiUrl}/b2api/v3/b2_list_file_versions`, { method: "POST", headers: { Authorization: account.authorizationToken, "Content-Type": "application/json" }, body: JSON.stringify({ bucketId, startFileName: body.storageKey, maxFileCount: 100 }) });
      const data = await listed.json();
      for (const file of data.files ?? []) {
        if (file.fileName !== body.storageKey) break;
        await fetch(`${apiUrl}/b2api/v3/b2_delete_file_version`, { method: "POST", headers: { Authorization: account.authorizationToken, "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.fileName, fileId: file.fileId }) });
      }
      return json(r, { deleted: true });
    }
    return json(r, { error: "Invalid request" }, 400);
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    return json(r, { error: message === "forbidden" ? "Admin access required." : message === "unauthorized" ? "Please sign in." : "Storage is unavailable." }, message === "forbidden" ? 403 : message === "unauthorized" ? 401 : 503);
  }
});
