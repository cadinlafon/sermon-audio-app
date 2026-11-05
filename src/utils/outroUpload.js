import { uploadPublicImage, deletePublicImage } from "./imageUpload";

// The automatic audio outro is one small MP3 stored in the same private
// Backblaze bucket as everything else, through the same admin-only upload
// path the page banners use (audio-admin → B2 upload URL). It lives under the
// bucket's "images/" prefix because that is the prefix the existing public
// `public-image` function serves WITHOUT a login — which the outro needs,
// since guests listen too. Nothing about the recordings themselves is touched.
export const OUTRO_MAX_BYTES = 15 * 1024 * 1024;

// A real MP3 starts with an "ID3" tag or an MPEG frame sync (0xFFEx).
async function looksLikeMp3(file) {
  const head = new Uint8Array(await file.slice(0, 3).arrayBuffer());
  const id3 = head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33;
  const frame = head[0] === 0xff && (head[1] & 0xe0) === 0xe0;
  return id3 || frame;
}

export async function validateOutroFile(file) {
  if (!file) return "Please choose an MP3 file.";
  const nameOk = /\.mp3$/i.test(file.name);
  const typeOk = !file.type || file.type === "audio/mpeg" || file.type === "audio/mp3";
  if (!nameOk || !typeOk) return "The outro must be an MP3 file (.mp3).";
  if (file.size === 0) return "That file is empty.";
  if (file.size > OUTRO_MAX_BYTES) return `That file is too large (${(file.size / 1048576).toFixed(1)} MB). Keep the outro under ${OUTRO_MAX_BYTES / 1048576} MB.`;
  if (!(await looksLikeMp3(file))) return "That file doesn't look like a valid MP3.";
  return "";
}

// Uploads the MP3 and returns { url, storageKey, fileName }. Throws with a
// readable message on an invalid file or a failed upload.
export async function uploadOutroAudio(file, onProgress) {
  const problem = await validateOutroFile(file);
  if (problem) throw new Error(problem);
  const typed = file.type ? file : new File([file], file.name, { type: "audio/mpeg" });
  const { url, storageKey } = await uploadPublicImage(typed, onProgress);
  return { url, storageKey, fileName: file.name };
}

export const deleteOutroAudio = (storageKey) => deletePublicImage(storageKey);
