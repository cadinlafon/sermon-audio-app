// Serves images out of the (private) Backblaze bucket without requiring
// login — used for things like doctrine week header images, which need
// to be visible to anyone visiting a public page. It works by getting a
// short-lived B2 download authorization on every request and redirecting
// to it; the *this* URL (?key=images/...) is what's stored permanently
// in Firestore and never expires, even though the underlying B2 link does.
// PF_-prefixed since this Supabase project is shared with other apps —
// generic names like BACKBLAZE_KEY_ID would collide with their secrets.
const bucketId = Deno.env.get("PF_BACKBLAZE_BUCKET_ID");
const bucketName = Deno.env.get("PF_BACKBLAZE_BUCKET_NAME");
const keyId = Deno.env.get("PF_BACKBLAZE_KEY_ID");
const applicationKey = Deno.env.get("PF_BACKBLAZE_APPLICATION_KEY");

const validKey = (key: unknown) =>
  typeof key === "string" && /^images\/[A-Za-z0-9._/-]{1,500}$/.test(key) && !key.includes("..");

async function authorize() {
  if (!keyId || !applicationKey || !bucketId || !bucketName) throw new Error("unconfigured");
  const r = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", {
    headers: { Authorization: `Basic ${btoa(`${keyId}:${applicationKey}`)}` },
  });
  if (!r.ok) throw new Error("storage");
  return await r.json();
}

Deno.serve(async (request) => {
  try {
    const url = new URL(request.url);
    const key = url.searchParams.get("key");
    if (!validKey(key)) return new Response("Not found", { status: 404 });

    const account = await authorize();
    const apiUrl = account.apiInfo.storageApi.apiUrl;
    const downloadUrl = account.apiInfo.storageApi.downloadUrl;

    const tokenResponse = await fetch(`${apiUrl}/b2api/v3/b2_get_download_authorization`, {
      method: "POST",
      headers: { Authorization: account.authorizationToken, "Content-Type": "application/json" },
      body: JSON.stringify({ bucketId, fileNamePrefix: key, validDurationInSeconds: 3600 }),
    });
    if (!tokenResponse.ok) return new Response("Storage unavailable", { status: 503 });
    const tokenData = await tokenResponse.json();

    const encodedKey = (key as string).split("/").map(encodeURIComponent).join("/");
    const signedUrl = `${downloadUrl}/file/${encodeURIComponent(bucketName!)}/${encodedKey}?Authorization=${encodeURIComponent(tokenData.authorizationToken)}`;

    return Response.redirect(signedUrl, 302);
  } catch {
    return new Response("Storage unavailable", { status: 503 });
  }
});
