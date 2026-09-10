import { auth } from "../firebase";
import { supabase } from "../supabase";

// Public images (e.g. a doctrine week's header photo) live in the same
// private Backblaze bucket as audio, just under an "images/" prefix.
// Uploads go through audio-admin (admin-only, same as audio); reads go
// through the public-image function, which needs no login since these
// images are meant to be visible on public pages — it redirects to a
// freshly-signed B2 URL on every request, so the link this returns
// (pointing at Supabase, not Backblaze) is permanent even though the
// underlying signed URL it redirects to expires.
export async function uploadPublicImage(file, onProgress) {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in.");
  const token = await user.getIdToken();

  const { data, error } = await supabase.functions.invoke("audio-admin", {
    headers: { Authorization: `Bearer ${token}` },
    body: { action: "upload", fileName: file.name, mediaType: "image" },
  });
  if (error || !data?.uploadUrl) throw new Error(error?.message || "Could not prepare upload.");

  const sha1 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-1", await file.arrayBuffer())))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", data.uploadUrl);
    xhr.setRequestHeader("Authorization", data.uploadToken);
    xhr.setRequestHeader("X-Bz-File-Name", encodeURIComponent(data.storageKey));
    xhr.setRequestHeader("Content-Type", file.type || "image/jpeg");
    xhr.setRequestHeader("X-Bz-Content-Sha1", sha1);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error("Backblaze rejected the image upload."));
    };

    xhr.onerror = () => reject(new Error("Backblaze rejected the image upload."));
    xhr.send(file);
  });

  return {
    storageKey: data.storageKey,
    url: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-image?key=${encodeURIComponent(data.storageKey)}`,
  };
}

export async function deletePublicImage(storageKey) {
  if (!storageKey) return;
  const token = await auth.currentUser?.getIdToken();
  const { error } = await supabase.functions.invoke("audio-admin", {
    headers: { Authorization: `Bearer ${token}` },
    body: { action: "delete", storageKey },
  });
  if (error) throw new Error(error.message || "Could not delete image.");
}
