import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { getDownloadedMeta } from "../utils/offlineDownloads";

// Per-user facts the filters need: listen status, liked, downloaded.
// Everything is best-effort — a failed lookup just means that filter has
// nothing to match, it never breaks the list.
export default function useUserAudioState() {
  const [user, setUser] = useState(auth.currentUser);
  const [state, setState] = useState({ status: {}, liked: new Set(), downloaded: new Set() });

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user) { if (!cancelled) setState({ status: {}, liked: new Set(), downloaded: new Set() }); return; }
      const next = { status: {}, liked: new Set(), downloaded: new Set() };
      await Promise.all([
        getDocs(query(collection(db, "listenProgress"), where("userId", "==", user.uid)))
          .then((snap) => snap.forEach((d) => { const x = d.data(); if (x.audioId) next.status[x.audioId] = x.status; }))
          .catch(() => {}),
        getDocs(query(collection(db, "saved"), where("userId", "==", user.uid)))
          .then((snap) => snap.forEach((d) => { const x = d.data(); const id = x.sermonId || x.audioId; if (id) next.liked.add(id); }))
          .catch(() => {}),
        getDownloadedMeta(user.uid).then((list) => list.forEach((m) => next.downloaded.add(m.id))).catch(() => {}),
      ]);
      if (!cancelled) setState(next);
    };
    load();
    const onChange = () => load();
    window.addEventListener("downloads-changed", onChange);
    return () => { cancelled = true; window.removeEventListener("downloads-changed", onChange); };
  }, [user]);

  return state;
}
