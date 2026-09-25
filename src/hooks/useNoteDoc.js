import { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { fetchNoteDoc, saveBookmarks, saveEntries, saveNote } from "../utils/notes";

// The signed-in user's notes for one recording: general note (debounced
// autosave), timestamped entries, and bookmarks.
export default function useNoteDoc(audio) {
  const [user, setUser] = useState(auth.currentUser);
  const [data, setData] = useState({ text: "", entries: [], bookmarks: [] });
  const [status, setStatus] = useState("");
  const timer = useRef(null);
  const audioRef = useRef(audio);
  audioRef.current = audio;

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    clearTimeout(timer.current);
    setStatus("");
    if (!user || !audio?.id) { setData({ text: "", entries: [], bookmarks: [] }); return undefined; }
    let cancelled = false;
    fetchNoteDoc(user.uid, audio.id).then((d) => { if (!cancelled) setData(d); });
    return () => { cancelled = true; };
  }, [user, audio?.id]);

  const flash = useCallback((text) => { setStatus(text); setTimeout(() => setStatus(""), 1500); }, []);

  const setText = useCallback((text) => {
    setData((d) => ({ ...d, text }));
    setStatus("");
    clearTimeout(timer.current);
    const uid = user?.uid; const a = audioRef.current;
    timer.current = setTimeout(async () => {
      if (!uid || !a?.id) return;
      await saveNote(uid, a.id, text, a);
      flash("Saved");
    }, 800);
  }, [user, flash]);

  const setEntries = useCallback((entries) => {
    setData((d) => ({ ...d, entries }));
    if (user && audioRef.current?.id) saveEntries(user.uid, audioRef.current.id, entries, audioRef.current).then(() => flash("Saved"));
  }, [user, flash]);

  const setBookmarks = useCallback((bookmarks) => {
    setData((d) => ({ ...d, bookmarks }));
    if (user && audioRef.current?.id) saveBookmarks(user.uid, audioRef.current.id, bookmarks, audioRef.current);
  }, [user]);

  return { ...data, status, signedIn: !!user, setText, setEntries, setBookmarks };
}
