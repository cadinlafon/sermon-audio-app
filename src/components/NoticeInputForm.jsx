import { useMemo, useState } from "react";
import { db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import {
  fieldsOf,
  fieldChoices,
  validateAnswer,
  TAP_TYPES,
  MAX_TEXT_LENGTH,
  MAX_LONGTEXT_LENGTH,
  RATING_MAX,
  SCALE_MAX,
} from "../utils/noticeInputs";

const SUMMARY_MAX = 900;

export default function NoticeInputForm({ notice, user }) {
  const fields = useMemo(() => fieldsOf(notice), [notice]);
  const single = fields.length === 1;
  const storageKey = `noticeSubmitted:${notice.id}`;

  // field id -> string (text-like, rating, scale) or string[] (choices)
  const [answers, setAnswers] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });
  const [error, setError] = useState("");

  const setAnswer = (id, value) => {
    setAnswers((cur) => ({ ...cur, [id]: value }));
    setFieldErrors((cur) => (cur[id] ? { ...cur, [id]: "" } : cur));
    if (error) setError("");
  };

  const save = async (checked) => {
    if (submitting || submitted) return;
    setError("");
    setSubmitting(true);
    try {
      const payload = { noticeId: notice.id, createdAt: serverTimestamp(), userId: user?.uid || null, userEmail: user?.email || null };
      const list = checked.map(({ field, result }) => ({
        id: field.id,
        label: field.label || "",
        type: field.type,
        value: result.value,
        ...(result.values ? { values: result.values } : {}),
      }));
      payload.answers = list;
      if (single) {
        // Keep the original flat shape too, so older tools reading
        // value/inputType keep working for one-field notices.
        payload.inputType = fields[0].type;
        payload.value = list[0].value;
        if (list[0].values) payload.values = list[0].values;
      } else {
        payload.inputType = "form";
        payload.value = list.map((a) => `${a.label || "Answer"}: ${a.value}`).join(" | ").slice(0, SUMMARY_MAX);
      }
      await addDoc(collection(db, "noticeSubmissions"), payload);
      setSubmitted(true);
      try {
        localStorage.setItem(storageKey, "1");
      } catch {
        // ignore storage errors (private browsing, etc.)
      }
    } catch (err) {
      console.error("Error submitting notice input:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Validate every field; save when all are fine. `override` lets a
  // one-tap answer count before React has stored it.
  const submit = (override = {}) => {
    const merged = { ...answers, ...override };
    const errors = {};
    const checked = [];
    for (const field of fields) {
      const result = validateAnswer(field, merged[field.id]);
      if (!result.ok) errors[field.id] = result.error;
      else if (!result.empty) checked.push({ field, result });
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    if (checked.length === 0) {
      setError("Please fill in at least one field.");
      return;
    }
    save(checked);
  };

  if (submitted) {
    const voted = fields.some((f) => ["poll", "multi", "prefer"].includes(f.type));
    return (
      <div style={successBox}>
        <span>✓</span> {voted && single ? "Thanks — your vote was recorded!" : "Submitted!"}
      </div>
    );
  }

  const tapOnly = single && TAP_TYPES.has(fields[0].type);
  const buttonText = notice.inputButtonText || (single && ["poll", "multi"].includes(fields[0].type) ? "Vote" : "Submit");

  return (
    <div style={wrap}>
      {notice.inputMessage && <p style={message}>{notice.inputMessage}</p>}

      {fields.map((field) => (
        <div key={field.id} style={fieldBlock}>
          {field.label && (
            <label style={fieldLabelStyle}>
              {field.label}
              {field.required === false && <span style={optionalTag}> (optional)</span>}
            </label>
          )}
          <FieldControl
            field={field}
            answer={answers[field.id]}
            onChange={(value) => setAnswer(field.id, value)}
            onTap={tapOnly ? (option) => { setAnswer(field.id, [option]); submit({ [field.id]: [option] }); } : null}
            onEnter={single ? () => submit() : undefined}
            disabled={submitting}
            inline={single && ["text", "phone", "email"].includes(field.type)}
            submitButton={single && !tapOnly ? (
              <button style={submitBtn} onClick={() => submit()} disabled={submitting}>{submitting ? "…" : buttonText}</button>
            ) : null}
          />
          {fieldErrors[field.id] && <p style={errorText} role="alert">{fieldErrors[field.id]}</p>}
        </div>
      ))}

      {!single && (
        <button style={{ ...submitBtn, marginTop: "4px" }} onClick={() => submit()} disabled={submitting}>
          {submitting ? "…" : buttonText}
        </button>
      )}
      {error && <p style={errorText} role="alert">{error}</p>}
    </div>
  );
}

// One field's input. `submitButton` is only passed for single-field notices,
// where it sits beside / under the control like the original layout.
function FieldControl({ field, answer, onChange, onTap, onEnter, disabled, inline, submitButton }) {
  const type = field.type;
  const choices = fieldChoices(field);
  const picked = Array.isArray(answer) ? answer : [];
  const text = typeof answer === "string" ? answer : "";
  const [hoverStar, setHoverStar] = useState(0);

  const choose = (option) => {
    if (onTap) return onTap(option);
    if (type === "multi") onChange(picked.includes(option) ? picked.filter((o) => o !== option) : [...picked, option]);
    else onChange([option]);
  };

  if (type === "longtext") {
    return (
      <>
        <textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || "Type here…"}
          maxLength={MAX_LONGTEXT_LENGTH}
          rows={4}
          style={{ ...input, width: "100%", boxSizing: "border-box", resize: "vertical" }}
          disabled={disabled}
        />
        {submitButton && <div style={{ marginTop: "8px" }}>{submitButton}</div>}
      </>
    );
  }

  if (type === "poll" || type === "multi") {
    return (
      <>
        <div style={choiceList} role={type === "poll" ? "radiogroup" : "group"}>
          {choices.map((option) => {
            const on = picked.includes(option);
            const shape = { borderRadius: type === "poll" ? "50%" : "4px" };
            return (
              <button
                key={option}
                type="button"
                role={type === "poll" ? "radio" : "checkbox"}
                aria-checked={on}
                onClick={() => choose(option)}
                disabled={disabled}
                style={on ? { ...choiceBtn, ...choiceBtnOn } : choiceBtn}
              >
                <span style={on ? { ...mark, ...markOn, ...shape } : { ...mark, ...shape }}>{on ? "✓" : ""}</span>
                {option}
              </button>
            );
          })}
        </div>
        {submitButton && <div style={{ marginTop: "10px" }}>{submitButton}</div>}
      </>
    );
  }

  if (type === "prefer") {
    return (
      <div style={preferRow}>
        {choices.map((option, i) => (
          <button key={option} type="button" onClick={() => choose(option)} disabled={disabled} style={picked.includes(option) ? { ...preferBtn, ...choiceBtnOn } : preferBtn} aria-pressed={picked.includes(option)}>
            <span style={preferLabel}>{i === 0 ? "A" : "B"}</span>
            {option}
          </button>
        ))}
      </div>
    );
  }

  if (type === "yesno" || type === "rsvp") {
    return (
      <div style={pillRow}>
        {choices.map((option) => (
          <button key={option} type="button" onClick={() => choose(option)} disabled={disabled} aria-pressed={picked.includes(option)} style={picked.includes(option) ? { ...pillBtn, ...pillBtnOn } : pillBtn}>{option}</button>
        ))}
      </div>
    );
  }

  if (type === "emoji") {
    return (
      <div style={pillRow}>
        {choices.map((option) => (
          <button key={option} type="button" onClick={() => choose(option)} disabled={disabled} aria-pressed={picked.includes(option)} style={picked.includes(option) ? { ...emojiBtn, ...choiceBtnOn } : emojiBtn} aria-label={`React ${option}`}>{option}</button>
        ))}
      </div>
    );
  }

  if (type === "rating") {
    const shown = hoverStar || Number(text) || 0;
    return (
      <>
        <div style={starRow} role="radiogroup" aria-label={field.label || "Star rating"}>
          {Array.from({ length: RATING_MAX }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={Number(text) === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              onClick={() => onChange(String(n))}
              onMouseEnter={() => setHoverStar(n)}
              onMouseLeave={() => setHoverStar(0)}
              disabled={disabled}
              style={{ ...starBtn, color: n <= shown ? "var(--color-e08930)" : "var(--color-eddfc8)" }}
            >
              ★
            </button>
          ))}
        </div>
        {submitButton && <div style={{ marginTop: "8px" }}>{submitButton}</div>}
      </>
    );
  }

  if (type === "scale") {
    return (
      <>
        <div style={scaleRow} role="radiogroup" aria-label={field.label || "Scale from 1 to 10"}>
          {Array.from({ length: SCALE_MAX }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={Number(text) === n}
              onClick={() => onChange(String(n))}
              disabled={disabled}
              style={Number(text) === n ? { ...scaleBtn, ...scaleBtnOn } : scaleBtn}
            >
              {n}
            </button>
          ))}
        </div>
        {(field.scaleLow || field.scaleHigh) && (
          <div style={scaleLabels}><span>{field.scaleLow}</span><span>{field.scaleHigh}</span></div>
        )}
        {submitButton && <div style={{ marginTop: "8px" }}>{submitButton}</div>}
      </>
    );
  }

  // text / phone / email
  const htmlType = type === "phone" ? "tel" : type === "email" ? "email" : "text";
  return (
    <div style={inline ? row : undefined}>
      <input
        type={htmlType}
        inputMode={type === "phone" ? "tel" : type === "email" ? "email" : undefined}
        autoComplete={type === "phone" ? "tel" : type === "email" ? "email" : "off"}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && onEnter) onEnter(); }}
        placeholder={field.placeholder || (type === "phone" ? "(555) 123-4567" : type === "email" ? "you@email.com" : "Enter value")}
        maxLength={type === "text" ? MAX_TEXT_LENGTH : 254}
        style={inline ? input : { ...input, width: "100%", boxSizing: "border-box" }}
        disabled={disabled}
      />
      {submitButton}
    </div>
  );
}

const wrap = { marginTop: "12px" };
const message = { margin: "0 0 8px", fontSize: "13px", color: "var(--color-6b4c20)", lineHeight: 1.6, fontFamily: "sans-serif" };
const row = { display: "flex", gap: "8px", flexWrap: "wrap" };
const input = { flex: "1 1 180px", padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fffdf9)", fontSize: "14px", fontFamily: "sans-serif", color: "var(--color-3d2200)", outline: "none", minWidth: 0 };
const submitBtn = { padding: "9px 16px", borderRadius: "8px", border: "none", background: "linear-gradient(135deg, var(--color-c97c2e), var(--color-a85e18))", color: "var(--color-fff8ee)", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer", whiteSpace: "nowrap" };
const errorText = { margin: "6px 0 0", fontSize: "12px", color: "var(--color-b91c1c)", fontFamily: "sans-serif" };
const successBox = { marginTop: "12px", display: "flex", alignItems: "center", gap: "6px", padding: "10px 14px", borderRadius: "8px", background: "var(--color-dcfce7)", color: "var(--color-166534)", fontSize: "13px", fontFamily: "sans-serif" };

const choiceList = { display: "flex", flexDirection: "column", gap: "6px" };
const choiceBtn = { display: "flex", alignItems: "center", gap: "10px", textAlign: "left", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)", color: "var(--color-3d2200)", fontSize: "14px", fontFamily: "sans-serif", cursor: "pointer" };
const choiceBtnOn = { borderColor: "var(--color-c97c2e)", background: "var(--color-fef3e2)" };
const mark = { width: "18px", height: "18px", flexShrink: 0, border: "2px solid var(--color-c97c2e)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: "var(--color-fff8ee)", boxSizing: "border-box" };
const markOn = { background: "var(--color-c97c2e)" };

const preferRow = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" };
const preferBtn = { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "6px", minHeight: "86px", padding: "14px 10px", borderRadius: "14px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)", color: "var(--color-3d2200)", fontSize: "15px", fontFamily: "'Georgia', serif", cursor: "pointer", textAlign: "center", lineHeight: 1.3 };
const preferLabel = { width: "24px", height: "24px", borderRadius: "50%", background: "linear-gradient(135deg, var(--color-c97c2e), var(--color-a85e18))", color: "var(--color-fff8ee)", fontSize: "12px", fontWeight: "700", fontFamily: "sans-serif", display: "inline-flex", alignItems: "center", justifyContent: "center" };

const pillRow = { display: "flex", gap: "8px", flexWrap: "wrap" };
const pillBtn = { padding: "9px 20px", borderRadius: "999px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)", color: "var(--color-7a4f10)", fontSize: "14px", fontFamily: "sans-serif", cursor: "pointer" };
const emojiBtn = { width: "52px", height: "52px", borderRadius: "50%", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)", fontSize: "26px", cursor: "pointer", lineHeight: 1 };

const starRow = { display: "flex", gap: "2px" };
const starBtn = { background: "none", border: "none", fontSize: "34px", lineHeight: 1, cursor: "pointer", padding: "0 3px" };

const scaleRow = { display: "grid", gridTemplateColumns: "repeat(10, minmax(0, 1fr))", gap: "4px" };
const scaleBtn = { padding: "9px 0", borderRadius: "8px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)", color: "var(--color-7a4f10)", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
const scaleBtnOn = { background: "linear-gradient(135deg, var(--color-c97c2e), var(--color-a85e18))", color: "var(--color-fff8ee)", borderColor: "transparent" };
const scaleLabels = { display: "flex", justifyContent: "space-between", marginTop: "4px", fontSize: "11px", color: "var(--color-9b7040)", fontFamily: "sans-serif" };
const fieldBlock = { marginBottom: "12px" };
const fieldLabelStyle = { display: "block", margin: "0 0 5px", fontSize: "13px", fontWeight: "600", color: "var(--color-5c3a1e)", fontFamily: "sans-serif" };
const optionalTag = { fontWeight: "normal", color: "var(--color-9b7040)", fontSize: "12px" };
const pillBtnOn = { borderColor: "var(--color-c97c2e)", background: "var(--color-fef3e2)" };
