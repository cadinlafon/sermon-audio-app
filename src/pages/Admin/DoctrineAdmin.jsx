import { useEffect, useRef, useState } from "react";
import { db } from "../../firebase";
import { doc, getDoc, setDoc, serverTimestamp, deleteField } from "firebase/firestore";
import { uploadPrivateAudio, deletePrivateAudio } from "../../utils/privateAudioUpload";
import { uploadPublicImage, deletePublicImage } from "../../utils/imageUpload";

const DOC_ID = "current";

const blankForm = {
  title: "",
  speaker: "",
  details: "",
  docsLink: "",
  memorization: "",
  notes: "",
  audioFiles: [],
  imageURL: "",
  imageStorageKey: "",
  questions: [],
};

export default function DoctrineAdmin() {
  const [form, setForm] = useState(blankForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const originalAudioKeys = useRef([]);
  const originalImageKey = useRef("");

  const [uploadingAudioId, setUploadingAudioId] = useState(null);
  const [audioProgress, setAudioProgress] = useState(null);
  const audioInputRef = useRef();
  const pendingUploadId = useRef(null);

  const [imageUploading, setImageUploading] = useState(false);
  const [imageProgress, setImageProgress] = useState(null);
  const imageInputRef = useRef();

  useEffect(() => {
    async function load() {
      const snap = await getDoc(doc(db, "doctrineWeeks", DOC_ID));
      if (snap.exists()) {
        // A stray "id" data field was saved by mistake in the past —
        // strip it so it can never shadow the real document id again.
        // Legacy docs also carried a single audioStorageKey/audioFileName
        // pair instead of the audioFiles list — migrate that into the new
        // shape rather than dropping it.
        const { id: _staleId, audioStorageKey: legacyKey, audioFileName: legacyName, ...rest } = snap.data();
        void _staleId;
        let audioFiles = Array.isArray(rest.audioFiles) ? rest.audioFiles : [];
        if (audioFiles.length === 0 && legacyKey) {
          audioFiles = [{ id: crypto.randomUUID(), label: legacyName || "", audioStorageKey: legacyKey, audioFileName: legacyName || "" }];
        }
        const data = { ...blankForm, ...rest, questions: rest.questions || [], audioFiles };
        setForm(data);
        originalAudioKeys.current = audioFiles.map((a) => a.audioStorageKey).filter(Boolean);
        originalImageKey.current = data.imageStorageKey || "";
      }
      setLoading(false);
    }
    load();
  }, []);

  const showToast = (message, isError) => {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 3000);
  };

  //////////////////////////////////////////////////
  // AUDIO (multiple files)
  //////////////////////////////////////////////////
  const addAudioFile = () => {
    setForm((f) => ({
      ...f,
      audioFiles: [...f.audioFiles, { id: crypto.randomUUID(), label: "", audioStorageKey: "", audioFileName: "" }],
    }));
  };

  const updateAudioLabel = (id, value) => {
    setForm((f) => ({
      ...f,
      audioFiles: f.audioFiles.map((a) => (a.id === id ? { ...a, label: value } : a)),
    }));
  };

  const triggerAudioUpload = (id) => {
    pendingUploadId.current = id;
    audioInputRef.current.click();
  };

  const handleAudioSelect = async (id, file) => {
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      alert("Please choose an audio file.");
      return;
    }

    setUploadingAudioId(id);
    setAudioProgress(null);
    try {
      const audioStorageKey = await uploadPrivateAudio(file, setAudioProgress);
      setForm((f) => ({
        ...f,
        audioFiles: f.audioFiles.map((a) => (a.id === id ? { ...a, audioStorageKey, audioFileName: file.name } : a)),
      }));
    } catch (err) {
      console.error(err);
      alert("Audio upload failed.");
    }
    setUploadingAudioId(null);
    setAudioProgress(null);
  };

  const removeAudioFile = (id) => {
    setForm((f) => ({ ...f, audioFiles: f.audioFiles.filter((a) => a.id !== id) }));
  };

  const moveAudioFile = (id, direction) => {
    setForm((f) => {
      const index = f.audioFiles.findIndex((a) => a.id === id);
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= f.audioFiles.length) return f;
      const audioFiles = [...f.audioFiles];
      [audioFiles[index], audioFiles[newIndex]] = [audioFiles[newIndex], audioFiles[index]];
      return { ...f, audioFiles };
    });
  };

  //////////////////////////////////////////////////
  // IMAGE
  //////////////////////////////////////////////////
  const handleImageSelect = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      return;
    }

    setImageUploading(true);
    setImageProgress(null);
    try {
      const { url, storageKey } = await uploadPublicImage(file, setImageProgress);
      setForm((f) => ({ ...f, imageURL: url, imageStorageKey: storageKey }));
    } catch (err) {
      console.error(err);
      alert("Image upload failed.");
    }
    setImageUploading(false);
    setImageProgress(null);
  };

  const handleImageRemove = () => {
    setForm((f) => ({ ...f, imageURL: "", imageStorageKey: "" }));
  };

  //////////////////////////////////////////////////
  // QUESTIONS
  //////////////////////////////////////////////////
  const addQuestion = () => {
    setForm((f) => ({ ...f, questions: [...f.questions, ""] }));
  };

  const updateQuestion = (index, value) => {
    setForm((f) => ({
      ...f,
      questions: f.questions.map((q, i) => (i === index ? value : q)),
    }));
  };

  const removeQuestion = (index) => {
    setForm((f) => ({ ...f, questions: f.questions.filter((_, i) => i !== index) }));
  };

  //////////////////////////////////////////////////
  // SAVE
  //////////////////////////////////////////////////
  const handleSave = async () => {
    if (!form.title.trim()) {
      showToast("Title is required.", true);
      return;
    }

    setSaving(true);
    try {
      // Never write an "id" data field — the document's real id is
      // DOC_ID, and a stray "id" field previously caused a real bug.
      const { id: _ignoredId, ...formWithoutId } = form;
      void _ignoredId;
      // Drop entries that were added but never finished uploading, and
      // never write the old single-audio fields back — audioFiles is the
      // only shape going forward (see the migration in the load effect).
      const audioFiles = form.audioFiles.filter((a) => a.audioStorageKey);
      const payload = {
        ...formWithoutId,
        audioFiles,
        audioStorageKey: deleteField(),
        audioFileName: deleteField(),
        questions: form.questions.map((q) => q.trim()).filter(Boolean),
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "doctrineWeeks", DOC_ID), payload, { merge: true });

      const currentAudioKeys = audioFiles.map((a) => a.audioStorageKey);
      const removedAudioKeys = originalAudioKeys.current.filter((k) => !currentAudioKeys.includes(k));
      removedAudioKeys.forEach((key) => {
        deletePrivateAudio(key).catch((err) => console.error("Couldn't delete old doctrine audio:", err));
      });
      if (originalImageKey.current && originalImageKey.current !== form.imageStorageKey) {
        deletePublicImage(originalImageKey.current).catch((err) => console.error("Couldn't delete old doctrine image:", err));
      }
      originalAudioKeys.current = currentAudioKeys;
      originalImageKey.current = form.imageStorageKey || "";

      showToast("Saved successfully.");
    } catch (err) {
      console.error(err);
      showToast("Couldn't save. Please try again.", true);
    }
    setSaving(false);
  };

  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (loading) {
    return <p style={hintText}>Loading…</p>;
  }

  return (
    <div style={page}>
      <div style={topRow}>
        <h1 style={pageTitle}>Doctrine Campaign</h1>
        <p style={pageSubtitle}>
          Manage the single Doctrine Campaign page — title, recording, and info shown to visitors.
        </p>
      </div>

      <div style={card}>
        <Field label="Speaker">
          <input
            value={form.speaker}
            onChange={f("speaker")}
            style={input}
            placeholder="Speaker name"
          />
        </Field>

        <Field label="Title">
          <input
            value={form.title}
            onChange={f("title")}
            style={input}
            placeholder="Page title"
          />
        </Field>

        <Field label="Image">
          {form.imageURL ? (
            <div>
              <img src={form.imageURL} alt="" style={imagePreview} />
              <div style={rowActions}>
                <button type="button" style={smallBtn} onClick={() => imageInputRef.current.click()} disabled={imageUploading}>
                  Replace
                </button>
                <button type="button" style={{ ...smallBtn, color: "#dc2626", borderColor: "#fca5a5" }} onClick={handleImageRemove} disabled={imageUploading}>
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button type="button" style={uploadBtn} onClick={() => imageInputRef.current.click()} disabled={imageUploading}>
              {imageUploading ? "Uploading…" : "🖼️ Upload Image"}
            </button>
          )}

          {imageUploading && (
            <div style={progressTrack}>
              <div
                style={{
                  ...progressFill,
                  width: imageProgress === null ? "40%" : `${imageProgress}%`,
                  ...(imageProgress === null ? { animation: "uploadSlide 1.1s ease-in-out infinite" } : {}),
                }}
              />
            </div>
          )}

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => { handleImageSelect(e.target.files[0]); e.target.value = ""; }}
          />
        </Field>

        <Field label="Long Details">
          <textarea
            value={form.details}
            onChange={f("details")}
            style={{ ...input, height: "100px", resize: "vertical" }}
            placeholder="Description…"
          />
        </Field>

        <Field label="Questions">
          <div style={questionsStack}>
            {form.questions.map((q, i) => (
              <div key={i} style={questionRow}>
                <span style={questionNumber}>{i + 1}.</span>
                <input
                  value={q}
                  onChange={(e) => updateQuestion(i, e.target.value)}
                  style={input}
                  placeholder={`Question ${i + 1}`}
                />
                <button type="button" style={questionRemoveBtn} onClick={() => removeQuestion(i)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button type="button" style={addQuestionBtn} onClick={addQuestion}>
            + Add Another Question
          </button>
        </Field>

        <Field label="Docs Link">
          <input
            value={form.docsLink}
            onChange={f("docsLink")}
            style={input}
            placeholder="https://…"
          />
        </Field>

        <Field label="Audio Files">
          <div style={audioFilesStack}>
            {form.audioFiles.map((a, i) => {
              const isUploading = uploadingAudioId === a.id;
              return (
                <div key={a.id} style={audioFileCard}>
                  <div style={audioFileHeader}>
                    <span style={audioFileIndex}>{i + 1}.</span>
                    <input
                      value={a.label}
                      onChange={(e) => updateAudioLabel(a.id, e.target.value)}
                      style={input}
                      placeholder='Label (e.g. "Session 1")'
                    />
                  </div>

                  {a.audioStorageKey ? (
                    <div style={fileRow}>
                      <span style={fileRowName}>🎵 {a.audioFileName || "Audio file"}</span>
                    </div>
                  ) : (
                    <p style={hintText}>No file uploaded yet.</p>
                  )}

                  {isUploading && (
                    <div style={progressTrack}>
                      <div
                        style={{
                          ...progressFill,
                          width: audioProgress === null ? "40%" : `${audioProgress}%`,
                          ...(audioProgress === null ? { animation: "uploadSlide 1.1s ease-in-out infinite" } : {}),
                        }}
                      />
                    </div>
                  )}

                  <div style={rowActions}>
                    <button type="button" style={smallBtn} onClick={() => triggerAudioUpload(a.id)} disabled={isUploading}>
                      {isUploading ? "Uploading…" : a.audioStorageKey ? "Replace" : "Upload"}
                    </button>
                    <button type="button" style={smallBtn} onClick={() => moveAudioFile(a.id, -1)} disabled={i === 0}>↑</button>
                    <button type="button" style={smallBtn} onClick={() => moveAudioFile(a.id, 1)} disabled={i === form.audioFiles.length - 1}>↓</button>
                    <button type="button" style={{ ...smallBtn, color: "#dc2626", borderColor: "#fca5a5" }} onClick={() => removeAudioFile(a.id)} disabled={isUploading}>
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <button type="button" style={addQuestionBtn} onClick={addAudioFile}>
            + Add Audio File
          </button>

          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files[0];
              e.target.value = "";
              if (pendingUploadId.current) handleAudioSelect(pendingUploadId.current, file);
            }}
          />
        </Field>

        <Field label="Weekly Memorization">
          <textarea
            value={form.memorization}
            onChange={f("memorization")}
            style={{ ...input, height: "80px", resize: "vertical" }}
            placeholder="Verse or memorization content…"
          />
        </Field>

        <Field label="Notes">
          <textarea
            value={form.notes}
            onChange={f("notes")}
            style={{ ...input, height: "80px", resize: "vertical" }}
            placeholder="Additional notes…"
          />
        </Field>

        <button style={saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>

      {toast && (
        <div style={toast.isError ? { ...toastBox, ...toastError } : toastBox}>{toast.message}</div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <label style={fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

const page = { maxWidth: "640px" };
const topRow = { marginBottom: "24px" };
const pageTitle = { fontSize: "26px", fontWeight: "normal", color: "#3d2200", margin: "0 0 4px", fontFamily: "'Georgia', serif" };
const pageSubtitle = { fontSize: "14px", color: "#9b7040", fontFamily: "sans-serif", margin: 0 };

const card = {
  background: "#fffdf9",
  border: "1px solid #eddfc8",
  borderRadius: "18px",
  padding: "28px",
  boxShadow: "0 2px 14px rgba(160,100,40,0.07)",
  display: "flex",
  flexDirection: "column",
  gap: "18px",
};

const fieldLabel = { fontSize: "11px", fontFamily: "sans-serif", color: "#9b7040", letterSpacing: "0.06em", textTransform: "uppercase" };
const input = { padding: "9px 12px", borderRadius: "10px", border: "1px solid #eddfc8", background: "#fdf8f3", fontSize: "14px", fontFamily: "sans-serif", color: "#3d2200", outline: "none", width: "100%", boxSizing: "border-box" };

const uploadBtn = { padding: "10px 14px", borderRadius: "10px", border: "1px dashed #eddfc8", background: "#fdf8f3", color: "#7a4f10", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer", textAlign: "center" };
const fileRow = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "10px", border: "1px solid #eddfc8", background: "#fdf8f3", flexWrap: "wrap" };
const fileRowName = { fontSize: "13px", fontFamily: "sans-serif", color: "#3d2200", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const rowActions = { display: "flex", gap: "6px", flexShrink: 0, marginTop: "8px" };
const smallBtn = { padding: "5px 10px", borderRadius: "8px", border: "1px solid #eddfc8", background: "#fffdf9", color: "#5c3a1e", fontSize: "11px", fontFamily: "sans-serif", cursor: "pointer" };
const progressTrack = { height: "6px", background: "#eddfc8", borderRadius: "999px", overflow: "hidden", marginTop: "8px" };
const progressFill = { height: "100%", background: "linear-gradient(to right, #e08930, #c97c2e)", borderRadius: "999px", transition: "width 0.2s ease-out" };

const imagePreview = { width: "100%", height: "160px", objectFit: "cover", borderRadius: "10px", border: "1px solid #eddfc8", marginBottom: "8px", display: "block" };

const audioFilesStack = { display: "flex", flexDirection: "column", gap: "10px", marginBottom: "10px" };
const audioFileCard = { display: "flex", flexDirection: "column", gap: "8px", padding: "12px", borderRadius: "12px", border: "1px solid #eddfc8", background: "#fdf8f3" };
const audioFileHeader = { display: "flex", alignItems: "center", gap: "8px" };
const audioFileIndex = { fontSize: "13px", fontFamily: "sans-serif", color: "#9b7040", flexShrink: 0, width: "16px", textAlign: "right" };

const questionsStack = { display: "flex", flexDirection: "column", gap: "8px", marginBottom: "8px" };
const questionRow = { display: "flex", alignItems: "center", gap: "8px" };
const questionNumber = { fontSize: "13px", fontFamily: "sans-serif", color: "#9b7040", flexShrink: 0, width: "18px", textAlign: "right" };
const questionRemoveBtn = { border: "none", background: "transparent", color: "#b3432c", fontSize: "13px", cursor: "pointer", padding: "4px 6px", flexShrink: 0 };
const addQuestionBtn = { padding: "8px 14px", borderRadius: "10px", border: "1px dashed #eddfc8", background: "#fdf8f3", color: "#7a4f10", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer", alignSelf: "flex-start" };

const saveBtn = { padding: "13px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)", color: "#fff8ee", fontSize: "15px", fontFamily: "sans-serif", cursor: "pointer", boxShadow: "0 3px 12px rgba(160,80,20,0.28)" };

const hintText = { fontSize: "13px", color: "#b08050", fontFamily: "sans-serif" };

const toastBox = { position: "fixed", bottom: "24px", right: "24px", background: "#166534", color: "#fff", padding: "12px 18px", borderRadius: "10px", fontSize: "13px", fontFamily: "sans-serif", boxShadow: "0 4px 16px rgba(0,0,0,0.2)", zIndex: 4000 };
const toastError = { background: "#991b1b" };
