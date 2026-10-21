////////////////////////////////////////////////////////////////
// NOTICE INPUT TYPES
//
// What a notice can ask the people reading it. One registry used by the
// admin form (AdminNotices.jsx), the public renderer
// (components/NoticeInputForm.jsx) and the admin results view, so adding
// a type means adding one entry here plus its renderer.
//
// Stored on the notice document:
//   inputType     one of INPUT_TYPES[].value  (missing = "text", the original)
//   inputOptions  string[] for poll / multi / prefer
//   inputScaleLow / inputScaleHigh  optional end labels for "scale"
//   inputMessage  the question or prompt shown above the input
//   inputPlaceholder / inputButtonText as before
// `inputEnabled` stays true ONLY for the original text input: the native
// Android app only understands that one, so every newer type is flagged by
// `inputType` alone and Android simply doesn't show it.
////////////////////////////////////////////////////////////////

export const INPUT_TYPES = [
  { value: "text", label: "Short text", icon: "✏️", hint: "One line of text." },
  { value: "longtext", label: "Long text", icon: "📝", hint: "A bigger box for feedback or prayer requests." },
  { value: "phone", label: "Phone number", icon: "📞", hint: "Checks it looks like a real phone number." },
  { value: "email", label: "Email address", icon: "✉️", hint: "Checks it looks like an email address." },
  { value: "poll", label: "Poll (pick one)", icon: "📊", hint: "2–8 options; people pick one." },
  { value: "multi", label: "Multiple choice (pick many)", icon: "☑️", hint: "2–8 options; people can pick several." },
  { value: "prefer", label: "What do you prefer? (this or that)", icon: "⚖️", hint: "Two options side by side; one tap to answer." },
  { value: "rating", label: "Star rating", icon: "⭐", hint: "1 to 5 stars." },
  { value: "scale", label: "Scale 1–10", icon: "🎚️", hint: "Great for \"how likely are you to…\"." },
  { value: "yesno", label: "Yes / No", icon: "👍", hint: "One tap." },
  { value: "emoji", label: "Emoji reaction", icon: "😍", hint: "😍 👍 😐 👎 — one tap." },
  { value: "rsvp", label: "RSVP", icon: "🙋", hint: "Going / Maybe / Can't go — one tap." },
];

export const INPUT_TYPE_BY_VALUE = Object.fromEntries(INPUT_TYPES.map((t) => [t.value, t]));

export const OPTION_TYPES = new Set(["poll", "multi", "prefer"]);
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 8;
export const MAX_OPTION_LENGTH = 80;

export const YESNO_OPTIONS = ["Yes", "No"];
export const EMOJI_OPTIONS = ["😍", "👍", "😐", "👎"];
export const RSVP_OPTIONS = ["Going", "Maybe", "Can't go"];
export const RATING_MAX = 5;
export const SCALE_MAX = 10;

export const MAX_TEXT_LENGTH = 500;
export const MAX_LONGTEXT_LENGTH = 2000;

export function inputTypeOf(notice) {
  return INPUT_TYPE_BY_VALUE[notice?.inputType] ? notice.inputType : "text";
}

// True when a notice asks for any kind of input.
export function noticeHasInput(notice) {
  if (!notice) return false;
  return notice.inputEnabled === true || (!!notice.inputType && notice.inputType !== "none" && !!INPUT_TYPE_BY_VALUE[notice.inputType]);
}

// The fixed answer choices for a type (admin-defined ones come from the notice).
export function choicesFor(notice) {
  switch (inputTypeOf(notice)) {
    case "poll":
    case "multi":
    case "prefer":
      return (notice.inputOptions || []).filter((o) => typeof o === "string" && o.trim());
    case "yesno": return YESNO_OPTIONS;
    case "emoji": return EMOJI_OPTIONS;
    case "rsvp": return RSVP_OPTIONS;
    default: return [];
  }
}

////////////////////////////////////////////////////////////////
// ADMIN FORM
////////////////////////////////////////////////////////////////

export function blankOptions(type) {
  return type === "prefer" ? ["", ""] : ["", "", ""];
}

// Returns an error message, or null when the notice's input setup is valid.
export function validateInputConfig(form) {
  if (!form.inputEnabled) return null;
  const type = form.inputType || "text";
  if (OPTION_TYPES.has(type)) {
    const options = (form.inputOptions || []).map((o) => o.trim()).filter(Boolean);
    const required = type === "prefer" ? 2 : MIN_OPTIONS;
    if (options.length < required) return type === "prefer" ? "Fill in both options for the this-or-that." : `Add at least ${MIN_OPTIONS} options.`;
    if (type === "prefer" && options.length !== 2) return "A this-or-that needs exactly two options.";
    if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return "Each option must be different.";
  }
  return null;
}

// What to write to Firestore for the input part of the form.
export function inputFieldsForSave(form) {
  if (!form.inputEnabled) {
    return { inputEnabled: false, inputType: null, inputOptions: [] };
  }
  const type = form.inputType || "text";
  return {
    // Only the original text input stays "inputEnabled" (see top of file).
    inputEnabled: type === "text",
    inputType: type,
    inputOptions: OPTION_TYPES.has(type) ? (form.inputOptions || []).map((o) => o.trim().slice(0, MAX_OPTION_LENGTH)).filter(Boolean) : [],
    inputScaleLow: type === "scale" ? (form.inputScaleLow || "").trim() : "",
    inputScaleHigh: type === "scale" ? (form.inputScaleHigh || "").trim() : "",
  };
}

// The form's "collect input" checkbox mirrors noticeHasInput.
export function formFromNotice(notice) {
  return {
    inputEnabled: noticeHasInput(notice),
    inputType: noticeHasInput(notice) ? inputTypeOf(notice) : "text",
    inputOptions: notice.inputOptions?.length ? [...notice.inputOptions] : blankOptions(inputTypeOf(notice)),
    inputScaleLow: notice.inputScaleLow || "",
    inputScaleHigh: notice.inputScaleHigh || "",
  };
}

////////////////////////////////////////////////////////////////
// VALIDATION OF ANSWERS
////////////////////////////////////////////////////////////////

// Accepts common ways of typing a phone number: (509) 555-0123, 509-555-0123,
// +1 509 555 0123, 5095550123. Returns { ok, value, error }.
export function normalizePhone(raw) {
  const text = String(raw || "").trim();
  if (!text) return { ok: false, error: "Please enter your phone number." };
  if (!/^[+\d\s().-]+$/.test(text)) return { ok: false, error: "Phone numbers can only have digits, spaces, + ( ) - ." };
  const digits = text.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return { ok: false, error: "That doesn't look like a complete phone number." };
  return { ok: true, value: text };
}

export function normalizeEmail(raw) {
  const text = String(raw || "").trim();
  if (!text) return { ok: false, error: "Please enter your email address." };
  if (text.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text)) return { ok: false, error: "That doesn't look like a valid email address." };
  return { ok: true, value: text };
}

////////////////////////////////////////////////////////////////
// RESULTS (admin)
////////////////////////////////////////////////////////////////

/**
 * Tally submissions for the admin Submissions view.
 * @returns {null | { kind: "choices", rows: Array<{label, count, percent}>, total } | { kind: "average", average, total, max, rows }}
 *   null for free-text types (the raw list is the result).
 */
export function summarizeSubmissions(notice, submissions) {
  const type = inputTypeOf(notice);
  const total = submissions.length;
  if (total === 0) return null;

  if (type === "rating" || type === "scale") {
    const max = type === "rating" ? RATING_MAX : SCALE_MAX;
    const counts = new Array(max).fill(0);
    let sum = 0;
    let n = 0;
    for (const s of submissions) {
      const v = Number(s.value);
      if (Number.isInteger(v) && v >= 1 && v <= max) { counts[v - 1]++; sum += v; n++; }
    }
    if (n === 0) return null;
    return {
      kind: "average",
      average: sum / n,
      total: n,
      max,
      rows: counts.map((count, i) => ({ label: String(i + 1), count, percent: Math.round((count / n) * 100) })).reverse(),
    };
  }

  const choices = choicesFor(notice);
  if (choices.length > 0) {
    const counts = new Map(choices.map((c) => [c, 0]));
    let answered = 0;
    for (const s of submissions) {
      const picked = Array.isArray(s.values) && s.values.length ? s.values : [s.value];
      let counted = false;
      for (const p of picked) if (counts.has(p)) { counts.set(p, counts.get(p) + 1); counted = true; }
      if (counted) answered++;
    }
    if (answered === 0) return null;
    return {
      kind: "choices",
      total: answered,
      rows: [...counts.entries()].map(([label, count]) => ({ label, count, percent: Math.round((count / answered) * 100) })),
    };
  }

  return null;
}
