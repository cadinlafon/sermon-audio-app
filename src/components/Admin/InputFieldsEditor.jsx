import {
  INPUT_TYPES,
  INPUT_TYPE_BY_VALUE,
  OPTION_TYPES,
  MIN_OPTIONS,
  MAX_OPTIONS,
  MAX_OPTION_LENGTH,
  MAX_FIELDS,
  MAX_LABEL_LENGTH,
  blankField,
  withFieldType,
} from "../../utils/noticeInputs";

// The "collect replies" editor shared by notices and popups: turn input on,
// add labeled fields (text, polls, ratings, RSVP…), reorder them. It edits
// the flat notice-style fields on `form` (inputEnabled, inputFields,
// inputMessage, inputButtonText) and calls setForm with the updated form.
export default function InputFieldsEditor({ form, setForm, toggleLabel = "Input (collect submissions)" }) {
  const updateField = (id, patch) => setForm((cur) => ({ ...cur, inputFields: cur.inputFields.map((fl) => (fl.id === id ? { ...fl, ...patch } : fl)) }));
  const changeFieldType = (id, type) => setForm((cur) => ({ ...cur, inputFields: cur.inputFields.map((fl) => (fl.id === id ? withFieldType(fl, type) : fl)) }));
  const addField = () => setForm((cur) => (cur.inputFields.length >= MAX_FIELDS ? cur : { ...cur, inputFields: [...cur.inputFields, blankField("text")] }));
  const removeField = (id) => setForm((cur) => (cur.inputFields.length <= 1 ? cur : { ...cur, inputFields: cur.inputFields.filter((fl) => fl.id !== id) }));
  const moveField = (id, dir) => setForm((cur) => {
    const i = cur.inputFields.findIndex((fl) => fl.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= cur.inputFields.length) return cur;
    const next = [...cur.inputFields];
    [next[i], next[j]] = [next[j], next[i]];
    return { ...cur, inputFields: next };
  });
  const setFieldOption = (id, i, value) => setForm((cur) => ({ ...cur, inputFields: cur.inputFields.map((fl) => (fl.id === id ? { ...fl, options: fl.options.map((o, j) => (j === i ? value : o)) } : fl)) }));
  const addFieldOption = (id) => setForm((cur) => ({ ...cur, inputFields: cur.inputFields.map((fl) => (fl.id === id && fl.options.length < MAX_OPTIONS ? { ...fl, options: [...fl.options, ""] } : fl)) }));
  const removeFieldOption = (id, i) => setForm((cur) => ({ ...cur, inputFields: cur.inputFields.map((fl) => (fl.id === id && fl.options.length > MIN_OPTIONS ? { ...fl, options: fl.options.filter((_, j) => j !== i) } : fl)) }));

  const f = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  return (
    <>
      <div style={checkRow}>
        <label style={checkLabel}><input type="checkbox" checked={form.inputEnabled} onChange={f("inputEnabled")} /> {toggleLabel}</label>
      </div>

      {form.inputEnabled && (
        <>
          <Field label="Intro Message (optional)">
            <textarea value={form.inputMessage} onChange={f("inputMessage")} style={{ ...input, height: "70px", resize: "vertical" }} placeholder="e.g. Tell us a little about yourself so we can follow up." />
          </Field>

          <div style={fieldEditorList}>
            {form.inputFields.map((fl, idx) => (
              <div key={fl.id} style={fieldEditorCard}>
                <div style={fieldEditorHead}>
                  <strong style={fieldEditorTitle}>Field {idx + 1}</strong>
                  <div style={fieldEditorTools}>
                    <button type="button" style={toolBtn} onClick={() => moveField(fl.id, -1)} disabled={idx === 0} aria-label={`Move field ${idx + 1} up`}>▲</button>
                    <button type="button" style={toolBtn} onClick={() => moveField(fl.id, 1)} disabled={idx === form.inputFields.length - 1} aria-label={`Move field ${idx + 1} down`}>▼</button>
                    {form.inputFields.length > 1 && (
                      <button type="button" style={{ ...toolBtn, color: "var(--color-dc2626)", borderColor: "var(--color-fca5a5)" }} onClick={() => removeField(fl.id)} aria-label={`Remove field ${idx + 1}`}>✕</button>
                    )}
                  </div>
                </div>

                <Field label="Label">
                  <input value={fl.label} onChange={(e) => updateField(fl.id, { label: e.target.value })} maxLength={MAX_LABEL_LENGTH} style={input} placeholder={fieldLabelPlaceholder(fl.type)} />
                </Field>

                <div style={twoCol}>
                  <Field label="Type">
                    <select value={fl.type} onChange={(e) => changeFieldType(fl.id, e.target.value)} style={input}>
                      {INPUT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Required?">
                    <label style={{ ...checkLabel, padding: "9px 0" }}>
                      <input type="checkbox" checked={fl.required !== false} onChange={(e) => updateField(fl.id, { required: e.target.checked })} /> Must be answered
                    </label>
                  </Field>
                </div>
                <span style={typeHint}>{INPUT_TYPE_BY_VALUE[fl.type]?.hint}</span>

                {OPTION_TYPES.has(fl.type) && (
                  <Field label={fl.type === "prefer" ? "The two options" : `Options (${MIN_OPTIONS}–${MAX_OPTIONS})`}>
                    <div style={optionList}>
                      {fl.options.map((opt, i) => (
                        <div key={i} style={optionRow}>
                          <input
                            value={opt}
                            onChange={(e) => setFieldOption(fl.id, i, e.target.value)}
                            maxLength={MAX_OPTION_LENGTH}
                            style={input}
                            placeholder={fl.type === "prefer" ? (i === 0 ? "Option A, e.g. Hymns" : "Option B, e.g. Modern songs") : `Option ${i + 1}`}
                            aria-label={`Field ${idx + 1} option ${i + 1}`}
                          />
                          {fl.type !== "prefer" && fl.options.length > MIN_OPTIONS && (
                            <button type="button" style={removeOptBtn} onClick={() => removeFieldOption(fl.id, i)} aria-label={`Remove option ${i + 1}`}>✕</button>
                          )}
                        </div>
                      ))}
                      {fl.type !== "prefer" && fl.options.length < MAX_OPTIONS && (
                        <button type="button" style={addOptBtn} onClick={() => addFieldOption(fl.id)}>+ Add option</button>
                      )}
                    </div>
                  </Field>
                )}

                {fl.type === "scale" && (
                  <div style={twoCol}>
                    <Field label="Low end label"><input value={fl.scaleLow} onChange={(e) => updateField(fl.id, { scaleLow: e.target.value })} style={input} placeholder="e.g. Not likely" /></Field>
                    <Field label="High end label"><input value={fl.scaleHigh} onChange={(e) => updateField(fl.id, { scaleHigh: e.target.value })} style={input} placeholder="e.g. Very likely" /></Field>
                  </div>
                )}

                {["text", "longtext", "phone", "email"].includes(fl.type) && (
                  <Field label="Placeholder (optional)"><input value={fl.placeholder} onChange={(e) => updateField(fl.id, { placeholder: e.target.value })} style={input} placeholder={fl.type === "phone" ? "e.g. (555) 123-4567" : fl.type === "email" ? "e.g. you@email.com" : "e.g. Type here"} /></Field>
                )}
              </div>
            ))}
            {form.inputFields.length < MAX_FIELDS && (
              <button type="button" style={addFieldBtn} onClick={addField}>+ Add another field</button>
            )}
          </div>

          <Field label="Submit Button Text"><input value={form.inputButtonText} onChange={f("inputButtonText")} style={input} placeholder="e.g. Submit" /></Field>
        </>
      )}

    </>
  );
}

function Field({ label, children }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}><label style={fieldLabel}>{label}</label>{children}</div>;
}

function fieldLabelPlaceholder(type) {
  switch (type) {
    case "poll": return "e.g. What should our next potluck theme be?";
    case "multi": return "e.g. Which topics would you like covered?";
    case "prefer": return "e.g. Which do you prefer on Sunday mornings?";
    case "rating": return "e.g. How would you rate this sermon series?";
    case "scale": return "e.g. How likely are you to invite a friend?";
    case "yesno": return "e.g. Will you join us this Sunday?";
    case "emoji": return "e.g. How did you like the new app update?";
    case "rsvp": return "e.g. Are you coming to the picnic?";
    case "phone": return "e.g. Phone number";
    case "email": return "e.g. Email address";
    case "longtext": return "e.g. Prayer request or feedback";
    default: return "e.g. Your name";
  }
}

const input = { padding: "9px 12px", borderRadius: "10px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)", fontSize: "14px", fontFamily: "sans-serif", color: "var(--color-3d2200)", outline: "none", width: "100%", boxSizing: "border-box" };
const checkRow = { display: "flex", gap: "16px", flexWrap: "wrap" };
const checkLabel = { display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontFamily: "sans-serif", color: "var(--color-5c3a1e)", cursor: "pointer" };
const fieldEditorList = { display: "flex", flexDirection: "column", gap: "12px" };
const fieldEditorCard = { display: "flex", flexDirection: "column", gap: "10px", padding: "14px", borderRadius: "12px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fffdf9)" };
const fieldEditorHead = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" };
const fieldEditorTitle = { fontSize: "13px", color: "var(--color-5c3a1e)", fontFamily: "sans-serif" };
const fieldEditorTools = { display: "flex", gap: "6px" };
const toolBtn = { width: "30px", height: "30px", borderRadius: "8px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)", color: "var(--color-7a4f10)", cursor: "pointer", fontSize: "12px" };
const twoCol = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" };
const typeHint = { fontSize: "12px", color: "var(--color-9b7040)", fontFamily: "sans-serif" };
const optionList = { display: "flex", flexDirection: "column", gap: "8px" };
const optionRow = { display: "flex", gap: "8px", alignItems: "center" };
const removeOptBtn = { width: "34px", height: "34px", flexShrink: 0, borderRadius: "8px", border: "1px solid var(--color-fca5a5)", background: "var(--color-fdf8f3)", color: "var(--color-dc2626)", cursor: "pointer" };
const addOptBtn = { alignSelf: "flex-start", padding: "7px 14px", borderRadius: "999px", border: "1px dashed var(--color-c97c2e)", background: "none", color: "var(--color-7a4f10)", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
const addFieldBtn = { padding: "10px 16px", borderRadius: "12px", border: "1px dashed var(--color-c97c2e)", background: "none", color: "var(--color-7a4f10)", fontSize: "14px", fontFamily: "sans-serif", cursor: "pointer" };
const fieldLabel = { fontSize: "11px", fontFamily: "sans-serif", color: "var(--color-9b7040)", letterSpacing: "0.06em", textTransform: "uppercase" };
