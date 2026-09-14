import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, setDoc, updateDoc, collection, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import {
  DEFAULT_REQUIRE_PIN_FOR,
  hashPin,
  verifyPinHash,
  createPasskey,
  verifyPasskey,
} from "../config/adminSecurity";

const securityRef = doc(db, "appConfig", "adminSecurity");
const passkeysRef = collection(db, "appConfig", "adminSecurity", "passkeys");

// Live view of the admin security config, plus every mutation it
// supports. One doc for the whole app (see adminSecurity.js for why:
// the owner asked for one shared PIN, not per-account PINs).
export function useAdminSecurity() {
  const [config, setConfig] = useState(null);
  const [passkeys, setPasskeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [passkeysLoaded, setPasskeysLoaded] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      securityRef,
      (snap) => {
        setConfig(snap.exists() ? snap.data() : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      passkeysRef,
      (snap) => {
        setPasskeys(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setPasskeysLoaded(true);
      },
      () => setPasskeysLoaded(true)
    );
    return unsub;
  }, []);

  const pinEnabled = !!(config?.pinEnabled && config?.pinHash);
  const hasOwnerPin = !!config?.pinHash;
  const hasRestrictedPin = !!config?.restrictedPinHash;
  const requirePinFor = useMemo(
    () => new Set(config?.requirePinFor || DEFAULT_REQUIRE_PIN_FOR),
    [config?.requirePinFor]
  );

  async function ensureDocExists() {
    // updateDoc throws if the doc has never been created; setDoc with
    // merge covers both "doesn't exist yet" and "exists" in one call.
    return setDoc(securityRef, {}, { merge: true });
  }

  async function setOwnerPin(pin) {
    const { salt, hash } = await hashPin(pin);
    await ensureDocExists();
    await updateDoc(securityRef, { pinSalt: salt, pinHash: hash, updatedAt: serverTimestamp() });
  }

  async function setRestrictedPin(pin) {
    const { salt, hash } = await hashPin(pin);
    await ensureDocExists();
    await updateDoc(securityRef, { restrictedPinSalt: salt, restrictedPinHash: hash, updatedAt: serverTimestamp() });
  }

  async function removeOwnerPin() {
    await updateDoc(securityRef, { pinHash: null, pinSalt: null, pinEnabled: false, updatedAt: serverTimestamp() });
  }

  async function removeRestrictedPin() {
    await updateDoc(securityRef, { restrictedPinHash: null, restrictedPinSalt: null, updatedAt: serverTimestamp() });
  }

  async function setPinEnabled(enabled) {
    await ensureDocExists();
    await updateDoc(securityRef, { pinEnabled: enabled, updatedAt: serverTimestamp() });
  }

  async function setRequirePinFor(keys) {
    await updateDoc(securityRef, { requirePinFor: keys, updatedAt: serverTimestamp() });
  }

  async function verifyOwnerPin(pin) {
    return verifyPinHash(pin, config?.pinSalt, config?.pinHash);
  }

  async function verifyRestrictedPin(pin) {
    return verifyPinHash(pin, config?.restrictedPinSalt, config?.restrictedPinHash);
  }

  async function addPasskey(label) {
    const { id, publicKeyB64 } = await createPasskey(label);
    await setDoc(doc(passkeysRef, id), {
      label: label || "Passkey",
      publicKeyB64,
      createdAt: serverTimestamp(),
    });
    return id;
  }

  async function removePasskey(id) {
    await deleteDoc(doc(passkeysRef, id));
  }

  async function verifyOwnerPasskey() {
    return verifyPasskey(passkeys.map((p) => p.id));
  }

  return {
    loading: loading || !passkeysLoaded,
    pinEnabled,
    hasOwnerPin,
    hasRestrictedPin,
    requirePinFor,
    passkeys,
    setOwnerPin,
    setRestrictedPin,
    removeOwnerPin,
    removeRestrictedPin,
    setPinEnabled,
    setRequirePinFor,
    verifyOwnerPin,
    verifyRestrictedPin,
    addPasskey,
    removePasskey,
    verifyOwnerPasskey,
  };
}
