import { auth } from "../firebase";
import { supabase } from "../supabase";

export async function uploadPrivateAudio(file, onProgress) {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in.");
  const token = await user.getIdToken();

  const { data, error } = await supabase.functions.invoke("audio-admin", {
    headers: { Authorization: `Bearer ${token}` },
    body: { action: "upload", fileName: file.name },
  });
  if (error || !data?.uploadUrl) throw new Error(error?.message || "Could not prepare upload.");

  const sha1 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-1", await file.arrayBuffer())))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // XMLHttpRequest is used here (instead of fetch) specifically because
  // fetch has no way to report upload progress — xhr.upload.onprogress
  // is what lets the UI show a real percentage instead of a fake bar.
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", data.uploadUrl);
    xhr.setRequestHeader("Authorization", data.uploadToken);
    xhr.setRequestHeader("X-Bz-File-Name", encodeURIComponent(data.storageKey));
    xhr.setRequestHeader("Content-Type", file.type || "audio/mpeg");
    xhr.setRequestHeader("X-Bz-Content-Sha1", sha1);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error("Backblaze rejected the audio upload."));
    };

    xhr.onerror = () => reject(new Error("Backblaze rejected the audio upload."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));

    xhr.send(file);
  });

  return data.storageKey;
}

export async function deletePrivateAudio(storageKey) {
  if (!storageKey) return;
  const token = await auth.currentUser?.getIdToken();
  const { error } = await supabase.functions.invoke("audio-admin", { headers: { Authorization: `Bearer ${token}` }, body: { action: "delete", storageKey } });
  if (error) throw new Error(error.message || "Could not delete audio.");
}
