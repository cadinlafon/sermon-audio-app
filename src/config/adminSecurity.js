// ────────────────────────────────────────────────────────────────
// Admin PIN + Passkey security config.
//
// This is an app-side gate, the same way Restricted Admin permissions
// are (see adminModules.js) — there's no firestore.rules file deployed
// from this repo, so nothing here stops a write at the database level.
// It stops the *app* from letting you trigger a sensitive action
// without the PIN/passkey, which is what was asked for, but someone
// with direct Firestore access (or devtools access to an already
// signed-in admin session) isn't blocked by it.
//
// PINs are never stored in plaintext: they're hashed with PBKDF2-SHA256
// (Web Crypto, built into the browser) with a random salt, and only the
// hash+salt are written to Firestore. There's no "forgot PIN" flow —
// if it's lost, clear appConfig/adminSecurity by hand in the Firebase
// console to reset (the same recovery path already used for rules).
// ────────────────────────────────────────────────────────────────

export const SECURITY_DOC_PATH = ["appConfig", "adminSecurity"];
export const PASSKEYS_COLLECTION_PATH = ["appConfig", "adminSecurity", "passkeys"];

// One entry per gate-able sensitive action. `key` is stored in the
// `requirePinFor` array on the security doc. Add more here any time —
// nothing else needs to change for a new toggle to show up in Security.
export const SENSITIVE_ACTIONS = [
  { key: "adminEntry", label: "Opening the Admin Dashboard", icon: "🔑" },
  { key: "deleteUser", label: "Deleting a User", icon: "🗑️" },
  { key: "roleChange", label: "Making or Removing Admins", icon: "🛡️" },
  { key: "uploadAudio", label: "Uploading Audio", icon: "🎙️" },
  { key: "deleteAudio", label: "Deleting Audio", icon: "🗑️" },
  { key: "appShutdown", label: "Enabling / Disabling the App", icon: "⛔" },
  { key: "agentKey", label: "Creating / Rotating Agent Keys", icon: "🤖" },
];

export const DEFAULT_REQUIRE_PIN_FOR = SENSITIVE_ACTIONS.map((a) => a.key);

// Always required to change Security settings once a PIN exists —
// not a toggle, so a restricted admin granted security:edit still
// can't turn the PIN off without knowing it.
export const SECURITY_CHANGE_ACTION = "securityChange";

export const PIN_UNLOCK_SESSION_KEY = "pfAdminPinUnlocked";

const PBKDF2_ITERATIONS = 150000;

function toBase64(bytes) {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function fromBase64(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function randomSaltBase64() {
  return toBase64(crypto.getRandomValues(new Uint8Array(16)));
}

async function derivePinHash(pin, saltBase64) {
  const enc = new TextEncoder();
  const saltBytes = fromBase64(saltBase64);
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return toBase64(new Uint8Array(bits));
}

export function isValidPin(pin) {
  return /^\d{4,10}$/.test(pin);
}

export async function hashPin(pin) {
  const salt = randomSaltBase64();
  const hash = await derivePinHash(pin, salt);
  return { salt, hash };
}

export async function verifyPinHash(pin, salt, expectedHash) {
  if (!salt || !expectedHash || !pin) return false;
  const hash = await derivePinHash(pin, salt);
  return hash === expectedHash;
}

// ────────────────────────────────────────────────────────────────
// Passkey (WebAuthn) helpers — "device unlock" only, per the chosen
// scope: a successful platform-authenticator ceremony (Face ID /
// Touch ID / Windows Hello) against a registered credential ID counts
// as unlocked. The public key is stored for a possible future upgrade
// to real server-verified signatures, but isn't checked today.
// ────────────────────────────────────────────────────────────────

export function isPasskeySupported() {
  return typeof window !== "undefined" && !!window.PublicKeyCredential;
}

function bufferToBase64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBuffer(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(b64url.length + ((4 - (b64url.length % 4)) % 4), "=");
  return fromBase64(b64).buffer;
}

export async function createPasskey(label) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "Palouse Fellowship Admin" },
      user: { id: userId, name: label || "Admin", displayName: label || "Admin" },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
      timeout: 60000,
      attestation: "none",
    },
  });

  if (!credential) throw new Error("Passkey creation was cancelled.");

  let publicKeyB64 = null;
  try {
    const rawPublicKey = credential.response.getPublicKey?.();
    if (rawPublicKey) publicKeyB64 = bufferToBase64url(rawPublicKey);
  } catch {
    // Some browsers don't expose getPublicKey(); harmless, it's unused today.
  }

  return {
    id: bufferToBase64url(credential.rawId),
    publicKeyB64,
  };
}

export async function verifyPasskey(passkeyIds) {
  if (!passkeyIds || passkeyIds.length === 0) throw new Error("No passkeys registered.");
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: passkeyIds.map((id) => ({ type: "public-key", id: base64urlToBuffer(id) })),
      userVerification: "required",
      timeout: 60000,
    },
  });

  return !!assertion;
}
