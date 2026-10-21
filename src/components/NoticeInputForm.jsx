import { useState } from "react";
import { db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import {
  inputTypeOf,
  choicesFor,
  normalizePhone,
  normalizeEmail,
  MAX_TEXT_LENGTH,
  MAX_LONGTEXT_LENGTH,
  RATING_MAX,
  SCALE_MAX,
} from "../utils/noticeInputs";

// Types answered with a single tap (no separate Submit button).
const TAP_TO_ANSWER = new Set(["prefer", "yesno", "emoji", "rsvp"]);

export default function NoticeInputForm({ notice, user }) {
  const type = inputTypeOf(notice);
  const choices = choicesFor(notice);
  const storageKey = `noticeSubmitted:${notice.id}`;

  const [value, setValue] = useState("");          // text-like answers, rating, scale
  const [picked, setPicked] = useState([]);        // choice answers
  const [hoverStar, setHoverStar] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });
  const [error, setError] = useState("");

  const save = async (payload) => {
    if (submitting || submitted) return;
    setError("");
    setSubmitting(true);
    try {
      await addDoc(collection(db, "noticeSubmissions"), {
        noticeId: notice.id,
        inputType: type,
        ...payload,
        createdAt: serverTimestamp(),
        userId: user?.uid || null,
        userEmail: user?.email || null,
      });
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

  const handleSubmit = () => {
    if (type === "phone") {
      const r = normalizePhone(value);
      if (!r.ok) return setError(r.error);
      return save({ value: r.value });
    }
    if (type === "email") {
      const r = normalizeEmail(value);
      if (!r.ok) return setError(r.error);
      return save({ value: r.value });
    }
    if (type === "rating" || type === "scale") {
      if (!value) return setError(type === "rating" ? "Tap a star to rate." : "Pick a number from the scale.");
      return save({ value: String(value) });
    }
    if (type === "poll" || type === "multi") {
      if (picked.length === 0) return setError(type === "multi" ? "Pick at least one option." : "Pick an option.");
      return save({ value: picked.join(", "), values: picked });
    }
    const trimmed = value.trim();
    if (!trimmed) return setError("Please enter a value.");
    return save({ value: trimmed.slice(0, type === "longtext" ? MAX_LONGTEXT_LENGTH : MAX_TEXT_LENGTH) });
  };

  const choose = (option) => {
    setError("");
    if (TAP_TO_ANSWER.has(type)) {
      setPicked([option]);
      save({ value: option, values: [option] });
    } else if (type === "multi") {
      setPicked((cur) => (cur.includes(option) ? cur.filter((o) => o !== option) : [...cur, option]));
    } else {
      setPicked([option]);
    }
  };

  if (submitted) {
    return (
      <div style={successBox}>
        <span>✓</span> {type === "poll" || type === "prefer" || type === "multi" ? "Thanks — your vote was recorded!" : "Submitted!"}
      </div>
    );
  }

  const needsSubmitButton = !TAP_TO_ANSWER.has(type);
  const buttonText = notice.inputButtonText || (type === "poll" || type === "multi" ? "Vote" : "Submit");
  const submitButton = needsSubmitButton && (
    <button style={submitBtn} onClick={handleSubmit} disabled={submitting}>
      {submitting ? "…" : buttonText}
    </button>
  );

  let body;
  if (type === "longtext") {
    body = (
      <>
        <textarea
          value={value}
          onChange={(e) => { setValue(e.target.value); if (error) setError(""); }}
          placeholder={notice.inputPlaceholder || "Type here…"}
          maxLength={MAX_LONGTEXT_LENGTH}
          rows={4}
          style={{ ...input, width: "100%", boxSizing: "border-box", resize: "vertical" }}
          disabled={submitting}
        />
        <div style={{ marginTop: "8px" }}>{submitButton}</div>
      </>
    );
  } else if (type === "poll" || type === "multi") {
    body = (
      <>
        <div style={choiceList} role={type === "poll" ? "radiogroup" : "group"}>
          {choices.map((option) => {
            const on = picked.includes(option);
            return (
              <button
                key={option}
                type="button"
                role={type === "poll" ? "radio" : "checkbox"}
                aria-checked={on}
                onClick={() => choose(option)}
                disabled={submitting}
                style={on ? { ...choiceBtn, ...choiceBtnOn } : choiceBtn}
              >
                <span style={on ? { ...mark, ...markOn, borderRadius: type === "poll" ? "50%" : "4px" } : { ...mark, borderRadius: type === "poll" ? "50%" : "4px" }}>{on ? "✓" : ""}</span>
                {option}
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: "10px" }}>{submitButton}</div>
      </>
    );
  } else if (type === "prefer") {
    body = (
      <div style={preferRow}>
        {choices.map((option, i) => (
          <button key={option} type="button" onClick={() => choose(option)} disabled={submitting} style={preferBtn}>
            <span style={preferLabel}>{i === 0 ? "A" : "B"}</span>
            {option}
          </button>
        ))}
      </div>
    );
  } else if (type === "yesno" || type === "rsvp") {
    body = (
      <div style={pillRow}>
        {choices.map((option) => (
          <button key={option} type="button" onClick={() => choose(option)} disabled={submitting} style={pillBtn}>{option}</button>
        ))}
      </div>
    );
  } else if (type === "emoji") {
    body = (
      <div style={pillRow}>
        {choices.map((option) => (
          <button key={option} type="button" onClick={() => choose(option)} disabled={submitting} style={emojiBtn} aria-label={`React ${option}`}>{option}</button>
        ))}
      </div>
    );
  } else if (type === "rating") {
    const shown = hoverStar || Number(value) || 0;
    body = (
      <>
        <div style={starRow} role="radiogroup" aria-label="Star rating">
          {Array.from({ length: RATING_MAX }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={Number(value) === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              onClick={() => { setValue(String(n)); setError(""); }}
              onMouseEnter={() => setHoverStar(n)}
              onMouseLeave={() => setHoverStar(0)}
              disabled={submitting}
              style={{ ...starBtn, color: n <= shown ? "var(--color-e08930)" : "var(--color-eddfc8)" }}
            >
              ★
            </button>
          ))}
        </div>
        <div style={{ marginTop: "8px" }}>{submitButton}</div>
      </>
    );
  } else if (type === "scale") {
    body = (
      <>
        <div style={scaleRow} role="radiogroup" aria-label="Scale from 1 to 10">
          {Array.from({ length: SCALE_MAX }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={Number(value) === n}
              onClick={() => { setValue(String(n)); setError(""); }}
              disabled={submitting}
              style={Number(value) === n ? { ...scaleBtn, ...scaleBtnOn } : scaleBtn}
            >
              {n}
            </button>
          ))}
        </div>
        {(notice.inputScaleLow || notice.inputScaleHigh) && (
          <div style={scaleLabels}><span>{notice.inputScaleLow}</span><span>{notice.inputScaleHigh}</span></div>
        )}
        <div style={{ marginTop: "8px" }}>{submitButton}</div>
      </>
    );
  } else {
    // text / phone / email
    const htmlType = type === "phone" ? "tel" : type === "email" ? "email" : "text";
    body = (
      <div style={row}>
        <input
          type={htmlType}
          inputMode={type === "phone" ? "tel" : type === "email" ? "email" : undefined}
          autoComplete={type === "phone" ? "tel" : type === "email" ? "email" : "off"}
          value={value}
          onChange={(e) => { setValue(e.target.value); if (error) setError(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          placeholder={notice.inputPlaceholder || (type === "phone" ? "(555) 123-4567" : type === "email" ? "you@email.com" : "Enter value")}
          maxLength={type === "text" ? MAX_TEXT_LENGTH : 254}
          style={input}
          disabled={submitting}
        />
        {submitButton}
      </div>
    );
  }

  return (
    <div style={wrap}>
      {notice.inputMessage && <p style={message}>{notice.inputMessage}</p>}
      {body}
      {error && <p style={errorText} role="alert">{error}</p>}
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
