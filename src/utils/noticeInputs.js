////////////////////////////////////////////////////////////////
// NOTICE INPUT TYPES
//
// What a notice can ask the people reading it. One registry used by the
// admin form (AdminNotices.jsx), the public renderer
// (components/NoticeInputForm.jsx) and the admin results view, so adding
// a type means adding one entry here plus its renderer.
//
// A notice can ask for ONE OR MORE labeled fields, answered together with a
// single Submit. Stored on the notice document:
//   inputFields   [{ id, label, type, required, placeholder, options,
//                    scaleLow, scaleHigh }]   (type = INPUT_TYPES[].value)
//   inputMessage  intro text shown above the fields
//   inputButtonText  the Submit button's text
// Older notices stored a single unlabeled input in flat fields (inputType,
// inputOptions, inputPlaceholder, inputScaleLow/High, inputEnabled);
// fieldsOf() reads those as a one-field list, so nothing needs migrating.
// `inputEnabled` stays true ONLY when the notice is exactly one plain text
// field: the native Android app only understands that one, so everything
// richer is flagged by `inputFields` alone and Android simply doesn't show it.
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

export const MAX_FIELDS = 10;
export const MAX_LABEL_LENGTH = 100;

export function inputTypeOf(notice) {
  return INPUT_TYPE_BY_VALUE[notice?.inputType] ? notice.inputType : "text";
}

////////////////////////////////////////////////////////////////
// FIELDS
////////////////////////////////////////////////////////////////

let fieldCounter = 0;
function newFieldId() {
  fieldCounter += 1;
  return `f${Date.now().toString(36)}${fieldCounter}${Math.random().toString(36).slice(2, 5)}`;
}

export function blankOptions(type) {
  return type === "prefer" ? ["", ""] : ["", "", ""];
}

export function blankField(type = "text") {
  return {
    id: newFieldId(),
    label: "",
    type,
    required: true,
    placeholder: "",
    options: OPTION_TYPES.has(type) ? blankOptions(type) : [],
    scaleLow: "",
    scaleHigh: "",
  };
}

// The notice's fields — new-style list, or the legacy single input as one field.
export function fieldsOf(notice) {
  if (!notice) return [];
  if (Array.isArray(notice.inputFields) && notice.inputFields.length > 0) {
    return notice.inputFields
      .filter((f) => f && INPUT_TYPE_BY_VALUE[f.type])
      .map((f, i) => ({
        id: f.id || `f${i + 1}`,
        label: f.label || "",
        type: f.type,
        required: f.required !== false,
        placeholder: f.placeholder || "",
        options: Array.isArray(f.options) ? f.options : [],
        scaleLow: f.scaleLow || "",
        scaleHigh: f.scaleHigh || "",
      }));
  }
  const legacy = notice.inputEnabled === true || (!!notice.inputType && !!INPUT_TYPE_BY_VALUE[notice.inputType]);
  if (!legacy) return [];
  return [{
    id: "f1",
    label: "",
    type: inputTypeOf(notice),
    required: true,
    placeholder: notice.inputPlaceholder || "",
    options: Array.isArray(notice.inputOptions) ? notice.inputOptions : [],
    scaleLow: notice.inputScaleLow || "",
    scaleHigh: notice.inputScaleHigh || "",
  }];
}

// True when a notice asks for any kind of input.
export function noticeHasInput(notice) {
  return fieldsOf(notice).length > 0;
}

// The fixed answer choices for a field (admin-defined ones come from the field).
export function fieldChoices(field) {
  switch (field?.type) {
    case "poll":
    case "multi":
    case "prefer":
      return (field.options || []).filter((o) => typeof o === "string" && o.trim());
    case "yesno": return YESNO_OPTIONS;
    case "emoji": return EMOJI_OPTIONS;
    case "rsvp": return RSVP_OPTIONS;
    default: return [];
  }
}

// Answer-by-tap types answer on one tap — but only when they're the notice's
// single field; in a multi-field form everything waits for the shared Submit.
export const TAP_TYPES = new Set(["prefer", "yesno", "emoji", "rsvp"]);

////////////////////////////////////////////////////////////////
// ADMIN FORM
////////////////////////////////////////////////////////////////

// Returns an error message, or null when the notice's input setup is valid.
export function validateInputConfig(form) {
  if (!form.inputEnabled) return null;
  const fields = form.inputFields || [];
  if (fields.length === 0) return "Add at least one field, or turn input off.";
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    const where = `Field ${i + 1}`;
    if (fields.length > 1 && !f.label.trim()) return `${where} needs a label so people know what to answer.`;
    if (OPTION_TYPES.has(f.type)) {
      const options = (f.options || []).map((o) => o.trim()).filter(Boolean);
      if (f.type === "prefer") {
        if (options.length !== 2) return `${where}: fill in both options for the this-or-that.`;
      } else if (options.length < MIN_OPTIONS) {
        return `${where}: add at least ${MIN_OPTIONS} options.`;
      }
      if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return `${where}: each option must be different.`;
    }
  }
  return null;
}

// What to write to Firestore for the input part of the form.
export function inputFieldsForSave(form) {
  const fields = (form.inputFields || []).map((f) => ({
    id: f.id,
    label: (f.label || "").trim().slice(0, MAX_LABEL_LENGTH),
    type: f.type,
    required: f.required !== false,
    placeholder: ["text", "longtext", "phone", "email"].includes(f.type) ? (f.placeholder || "").trim() : "",
    options: OPTION_TYPES.has(f.type) ? (f.options || []).map((o) => o.trim().slice(0, MAX_OPTION_LENGTH)).filter(Boolean) : [],
    scaleLow: f.type === "scale" ? (f.scaleLow || "").trim() : "",
    scaleHigh: f.type === "scale" ? (f.scaleHigh || "").trim() : "",
  }));

  if (!form.inputEnabled || fields.length === 0) {
    return { inputEnabled: false, inputFields: [], inputType: null, inputOptions: [], inputPlaceholder: "" };
  }

  // Exactly one plain text field = the original shape, which Android still shows.
  const legacyText = fields.length === 1 && fields[0].type === "text" && !fields[0].label;
  return {
    inputEnabled: legacyText,
    inputFields: fields,
    inputType: null,
    inputOptions: [],
    inputPlaceholder: legacyText ? fields[0].placeholder : "",
  };
}

// The form's state for an existing notice (or a fresh one).
export function formFromNotice(notice) {
  const fields = fieldsOf(notice);
  return {
    inputEnabled: fields.length > 0,
    inputFields: fields.length > 0 ? fields.map((f) => ({ ...f, options: f.options.length ? [...f.options] : OPTION_TYPES.has(f.type) ? blankOptions(f.type) : [] })) : [blankField("text")],
  };
}

// Change a field's type, keeping or fixing up its options for the new type.
export function withFieldType(field, type) {
  let options = field.options?.length ? [...field.options] : blankOptions(type);
  if (type === "prefer") {
    options = options.slice(0, 2);
    while (options.length < 2) options.push("");
  } else if (OPTION_TYPES.has(type)) {
    while (options.length < MIN_OPTIONS) options.push("");
  } else {
    options = [];
  }
  return { ...field, type, options };
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

/**
 * Check one field's answer. `answer` is a string (text-like, rating, scale)
 * or a string[] (choices). Returns { ok, empty?, value, values?, error? }.
 * An empty optional field is { ok: true, empty: true }.
 */
export function validateAnswer(field, answer) {
  const picked = Array.isArray(answer) ? answer : [];
  const text = typeof answer === "string" ? answer.trim() : "";
  const isChoice = OPTION_TYPES.has(field.type) || ["yesno", "emoji", "rsvp"].includes(field.type);
  const isEmpty = isChoice ? picked.length === 0 : text === "";
  const required = field.required !== false;

  if (isEmpty) {
    if (!required) return { ok: true, empty: true };
    const messages = {
      phone: "Please enter your phone number.",
      email: "Please enter your email address.",
      rating: "Tap a star to rate.",
      scale: "Pick a number from the scale.",
      multi: "Pick at least one option.",
    };
    return { ok: false, error: messages[field.type] || (isChoice ? "Pick an option." : "Please fill this in.") };
  }

  if (field.type === "phone") return normalizePhone(text);
  if (field.type === "email") return normalizeEmail(text);
  if (isChoice) return { ok: true, value: picked.join(", "), values: picked };
  const max = field.type === "longtext" ? MAX_LONGTEXT_LENGTH : MAX_TEXT_LENGTH;
  return { ok: true, value: text.slice(0, max) };
}

////////////////////////////////////////////////////////////////
// RESULTS (admin)
////////////////////////////////////////////////////////////////

// This field's answer from one stored submission ({ value, values } or null).
// New submissions carry `answers: [{ id, value, values }]`; older single-input
// ones carry value/values at the top level.
export function answerFor(submission, field, fields) {
  if (Array.isArray(submission.answers)) {
    const a = submission.answers.find((x) => x.id === field.id);
    return a ? { value: a.value, values: a.values } : null;
  }
  return fields.length === 1 ? { value: submission.value, values: submission.values } : null;
}

/**
 * Tally one field's answers for the admin results view.
 * @param {object} field
 * @param {Array<{value: string, values?: string[]}>} answers
 * @returns {null | { kind: "choices", rows: Array<{label, count, percent}>, total } | { kind: "average", average, total, max, rows }}
 *   null for free-text types (the raw list is the result).
 */
export function summarizeField(field, answers) {
  if (answers.length === 0) return null;

  if (field.type === "rating" || field.type === "scale") {
    const max = field.type === "rating" ? RATING_MAX : SCALE_MAX;
    const counts = new Array(max).fill(0);
    let sum = 0;
    let n = 0;
    for (const a of answers) {
      const v = Number(a.value);
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

  const choices = fieldChoices(field);
  if (choices.length > 0) {
    const counts = new Map(choices.map((c) => [c, 0]));
    let answered = 0;
    for (const a of answers) {
      const picked = Array.isArray(a.values) && a.values.length ? a.values : [a.value];
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
