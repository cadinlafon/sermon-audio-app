import { useEffect, useRef, useState } from "react";
import { Card, Field, TextInput, Toggle, Button } from "../ui";
import { uploadOutroAudio, deleteOutroAudio, OUTRO_MAX_BYTES } from "../../../../utils/outroUpload";

// Automatic Audio Outro: one MP3, stored separately in Backblaze B2, that the
// player plays after any sermon, Sunday School or homily finishes. The
// recordings themselves are never touched. Uploading puts the file in B2
// straight away; it only goes live for listeners when you press Save changes.
export default function OutroSection({ playback, upPlayback, savedKey, canEdit }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const fileRef = useRef(null);
  const audioRef = useRef(null);

  const hasOutro = !!playback.outroAudioUrl;
  const unsaved = hasOutro && playback.outroStorageKey !== savedKey;

  const stopPreview = () => {
    const a = audioRef.current;
    if (a) { a.pause(); a.removeAttribute("src"); a.load(); }
    setPreviewing(false);
  };
  // Changing the file, or leaving the page, stops any preview.
  useEffect(() => { stopPreview(); }, [playback.outroAudioUrl]);
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const handleFile = async (file) => {
    if (!file) return;
    setError("");
    setUploading(true);
    setProgress(null);
    try {
      const { url, storageKey, fileName } = await uploadOutroAudio(file, setProgress);
      // Replacing an outro that was uploaded in this session but never saved:
      // that file is now unused, so remove it. (The live, saved outro is only
      // removed after Save, so listeners never lose it mid-way.)
      const old = playback.outroStorageKey;
      if (old && old !== savedKey) deleteOutroAudio(old).catch((e) => console.warn("Couldn't remove the replaced outro", e));
      upPlayback("outroAudioUrl", url);
      upPlayback("outroStorageKey", storageKey);
      upPlayback("outroFileName", fileName);
    } catch (err) {
      console.error(err);
      setError(err?.message || "The outro upload failed.");
    }
    setUploading(false);
    setProgress(null);
  };

  const remove = () => {
    if (!window.confirm("Remove the outro? Recordings will simply end without one once you Save.")) return;
    const old = playback.outroStorageKey;
    if (old && old !== savedKey) deleteOutroAudio(old).catch(() => {});
    upPlayback("outroAudioUrl", "");
    upPlayback("outroStorageKey", "");
    upPlayback("outroFileName", "");
  };

  const preview = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (previewing) { stopPreview(); return; }
    setPreviewError("");
    a.src = playback.outroAudioUrl;
    try {
      await a.play();
      setPreviewing(true);
    } catch (err) {
      console.warn("Outro preview failed", err);
      setPreviewError("Couldn't play the outro. Check your connection, or try uploading it again.");
      stopPreview();
    }
  };

  const status = uploading
    ? `Uploading… ${progress === null ? "" : `${progress}%`}`
    : !hasOutro
      ? "No outro uploaded"
      : unsaved
        ? "Uploaded — press Save changes to publish it"
        : playback.outroEnabled
          ? "Live — playing after every recording"
          : "Saved — the feature is switched off";
  const statusColor = uploading || unsaved ? "var(--color-7a5a10)" : hasOutro && playback.outroEnabled ? "var(--color-2f8a4a)" : "var(--color-9b7040)";

  return (
    <>
      <Card title="Automatic audio outro" hint="After a sermon, Sunday School or homily finishes on its own, the player plays this short recording (for example a thank-you), then stops or moves on to the next queued recording. The original recordings are never changed.">
        <Toggle label="Enable automatic outro" hint={hasOutro ? "Turn off to stop playing the outro without deleting it." : "Upload an outro below first."} checked={playback.outroEnabled} onChange={(v) => upPlayback("outroEnabled", v)} disabled={!canEdit} />
      </Card>

      <Card title="Outro recording">
        <div style={fileBox}>
          <div style={{ minWidth: 0 }}>
            <div style={fileName}>{hasOutro ? `🎵 ${playback.outroFileName || "outro.mp3"}` : "🎵 —"}</div>
            <div style={{ ...statusLine, color: statusColor }} role="status">{status}</div>
          </div>
        </div>
        {uploading && <div style={track}><div style={{ ...fill, width: progress === null ? "40%" : `${progress}%` }} /></div>}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <Button kind={hasOutro ? "default" : "primary"} onClick={() => fileRef.current?.click()} disabled={!canEdit || uploading}>{hasOutro ? "Replace outro" : "Upload outro (MP3)"}</Button>
          <Button onClick={preview} disabled={!hasOutro || uploading}>{previewing ? "⏸ Stop preview" : "▶ Preview outro"}</Button>
          {hasOutro && <Button kind="danger" onClick={remove} disabled={!canEdit || uploading}>Remove</Button>}
        </div>
        {error && <p style={errText} role="alert">{error}</p>}
        {previewError && <p style={errText} role="alert">{previewError}</p>}
        <p style={hint}>MP3 only, up to {OUTRO_MAX_BYTES / 1048576} MB. A short clip works best. Replace it any time — no code changes needed.</p>
        <input ref={fileRef} type="file" accept=".mp3,audio/mpeg" style={{ display: "none" }} onChange={(e) => { handleFile(e.target.files[0]); e.target.value = ""; }} />
        <audio ref={audioRef} preload="none" onEnded={() => setPreviewing(false)} onError={() => { if (audioRef.current?.getAttribute("src")) { setPreviewError("Couldn't play the outro."); setPreviewing(false); } }} />
      </Card>

      <Card title="Player wording">
        <Field label="Title shown while the outro plays" hint="Appears in the mini player, the full player and on the lock screen.">
          <TextInput value={playback.outroTitle} onChange={(v) => upPlayback("outroTitle", v)} maxLength={80} placeholder="Thank You – PF Audio App" disabled={!canEdit} />
        </Field>
        <p style={hint}>The outro doesn't play when a listener pauses, skips to another recording, drags to the end, uses repeat-one, has an end-of-recording sleep timer, or is casting to a TV. If it can't load, the recording simply finishes as normal.</p>
      </Card>
    </>
  );
}

const fileBox = { padding: "12px 14px", borderRadius: "12px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)" };
const fileName = { fontSize: "14px", color: "var(--color-3d2200)", fontFamily: "sans-serif", wordBreak: "break-all" };
const statusLine = { fontSize: "12.5px", fontFamily: "sans-serif", marginTop: "4px" };
const hint = { margin: 0, fontSize: "12px", color: "var(--color-9b7040)", fontFamily: "sans-serif", lineHeight: 1.5 };
const errText = { margin: 0, fontSize: "13px", color: "var(--color-b3432c)", fontFamily: "sans-serif" };
const track = { height: "6px", borderRadius: "999px", background: "var(--color-eddfc8)", overflow: "hidden" };
const fill = { height: "100%", background: "linear-gradient(135deg, var(--color-c97c2e), var(--color-a85e18))", transition: "width 0.2s" };
