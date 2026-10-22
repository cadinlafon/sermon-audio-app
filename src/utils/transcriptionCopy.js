import { auth, db } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { supabase } from "../supabase";
import { uploadPrivateAudio } from "./privateAudioUpload";
import { createTranscriptionCopy } from "./transcodeForTranscription";

////////////////////////////////////////////////////////////////
// TRANSCRIPTION COPY
//
// AI transcription (Groq) rejects any file over 25MB. Recordings uploaded
// before the small speech-optimized copy existed (see
// transcodeForTranscription.js) only have their original, which is often
// too big. This builds that copy on demand: download the original, shrink
// it in the browser (mono 16kHz MP3, bitrate backed off for long
// recordings), upload it, and remember it on the audio document — after
// which transcription and AI summaries use it automatically.
//
// Admin only (it uploads and edits the audio document).
////////////////////////////////////////////////////////////////

/**
 * Returns the audio object with `transcribeStorageKey` set, creating the
 * compressed copy first if it doesn't have one. A recording that already
 * has one is returned untouched. Throws if the copy can't be made.
 * @param {object} audio  audio document ({ id, title, audioStorageKey, transcribeStorageKey? })
 * @param {(stage: string) => void} [onStage]  progress text for the UI
 */
export async function ensureTranscriptionCopy(audio, onStage) {
  if (audio.transcribeStorageKey || !audio.audioStorageKey) return audio;

  const user = auth.currentUser;
  if (!user) throw new Error("Sign in again to prepare this recording.");

  onStage?.("Fetching original…");
  const token = await user.getIdToken();
  const { data: access, error: accessError } = await supabase.functions.invoke("audio-download-url", {
    headers: { Authorization: `Bearer ${token}` },
    body: { storageKey: audio.audioStorageKey },
  });
  if (accessError || !access?.url) throw new Error(accessError?.message || "Couldn't get a download URL for the original audio.");

  const response = await fetch(access.url);
  if (!response.ok) throw new Error("Couldn't download the original audio.");
  const blob = await response.blob();
  const file = new File([blob], audio.title || "audio", { type: blob.type || "audio/mpeg" });

  const copy = await createTranscriptionCopy(file, (p) => onStage?.(`Compressing for AI… ${Math.round(p * 100)}%`));

  onStage?.("Uploading…");
  const transcribeStorageKey = await uploadPrivateAudio(copy, () => {});
  await updateDoc(doc(db, "audio", audio.id), { transcribeStorageKey });
  return { ...audio, transcribeStorageKey };
}
