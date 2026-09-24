import { collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db, auth } from "../firebase";

// Keys are generated in the browser, shown once, and only their SHA-256 hash
// is stored — a leaked database can't reveal a working key.
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const toBase64Url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function generateAgentKey() {
  return `pfa_${toBase64Url(crypto.getRandomValues(new Uint8Array(32)))}`;
}

export async function hashKey(key) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key)));
}

export const agentApiUrl = () => `${import.meta.env.VITE_SUPABASE_URL || "https://YOUR-PROJECT-REF.supabase.co"}/functions/v1/agent-api`;

export async function listAgentKeys() {
  const snap = await getDocs(query(collection(db, "agentKeys"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createAgentKey({ name, provider, scopes, expiresInDays }) {
  const key = generateAgentKey();
  const ref = doc(collection(db, "agentKeys"));
  await setDoc(ref, {
    name,
    provider,
    scopes,
    keyHash: await hashKey(key),
    keyPrefix: key.slice(0, 8),
    revoked: false,
    createdBy: auth.currentUser?.uid || null,
    createdAt: serverTimestamp(),
    lastUsedAt: null,
    expiresAt: expiresInDays ? Timestamp.fromMillis(Date.now() + expiresInDays * 86400000) : null,
  });
  return { id: ref.id, key };
}

// Replaces the secret; the old key stops working immediately.
export async function rotateAgentKey(id) {
  const key = generateAgentKey();
  await updateDoc(doc(db, "agentKeys", id), { keyHash: await hashKey(key), keyPrefix: key.slice(0, 8), rotatedAt: serverTimestamp(), revoked: false });
  return key;
}

export const updateAgentScopes = (id, scopes) => updateDoc(doc(db, "agentKeys", id), { scopes });
export const setAgentRevoked = (id, revoked) => updateDoc(doc(db, "agentKeys", id), { revoked });
export const deleteAgentKey = (id) => deleteDoc(doc(db, "agentKeys", id));
