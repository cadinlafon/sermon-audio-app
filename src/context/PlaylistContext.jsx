import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { slimTrack } from "../utils/playerSettings";

// A user's playlists live on their own user doc (users/{uid}.playlists), so
// private playlists need no extra Firestore rules. Making one public also
// writes a read-only copy to playlists/{id} so it can be shared by link.
const PlaylistContext = createContext(null);
export const usePlaylists = () => useContext(PlaylistContext);

export const COVER_EMOJIS = ["🎧", "📖", "☀️", "🌙", "🚗", "❤️", "🙏", "⭐", "🎶", "🕊️"];
export const COVER_COLORS = [
  ["#c97c2e", "#a85e18"], ["#3b6ea8", "#274b78"], ["#4f8a5b", "#35633f"], ["#8a4f8a", "#663866"], ["#b3432c", "#8f2e1a"], ["#4a4a4a", "#2b2b2b"],
];
export const STARTER_NAMES = ["Sunday listening", "Morning sermons", "Doctrine study", "Favorites", "Bible study", "Listen while driving"];

const newId = () => Math.random().toString(36).slice(2, 10);
const totalSeconds = (pl) => pl.items.reduce((s, i) => s + (Number(i.duration) || 0), 0);
export const playlistDuration = (pl) => {
  const s = totalSeconds(pl);
  if (!s) return "";
  const h = Math.floor(s / 3600); const m = Math.round((s % 3600) / 60);
  return `${h ? `${h}h ` : ""}${m}m`;
};

export function PlaylistProvider({ children }) {
  const [user, setUser] = useState(auth.currentUser);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef(playlists);
  ref.current = playlists;

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) { setPlaylists([]); setLoading(false); return undefined; }
    setLoading(true);
    return onSnapshot(doc(db, "users", user.uid), (snap) => {
      const list = snap.exists() ? snap.data().playlists : [];
      setPlaylists(Array.isArray(list) ? list : []);
      setLoading(false);
    }, () => setLoading(false));
  }, [user]);

  const save = useCallback(async (next) => {
    if (!auth.currentUser) throw new Error("Sign in to use playlists.");
    setPlaylists(next);
    await updateDoc(doc(db, "users", auth.currentUser.uid), { playlists: next });
  }, []);

  // Keeps the public copy in step with the private one.
  const syncPublic = useCallback(async (pl) => {
    const u = auth.currentUser;
    if (!u) return;
    const ref = doc(db, "playlists", pl.id);
    if (pl.public) {
      await setDoc(ref, { ownerId: u.uid, ownerName: u.displayName || u.email?.split("@")[0] || "", name: pl.name, description: pl.description || "", cover: pl.cover, items: pl.items, public: true, updatedAt: serverTimestamp() });
    } else {
      await deleteDoc(ref).catch(() => {});
    }
  }, []);

  const mutate = useCallback(async (id, fn) => {
    const next = ref.current.map((p) => (p.id === id ? { ...fn(p), updatedAt: Date.now() } : p));
    await save(next);
    const pl = next.find((p) => p.id === id);
    if (pl?.public) await syncPublic(pl).catch((e) => console.warn("Couldn't update the shared copy", e));
  }, [save, syncPublic]);

  const api = useMemo(() => ({
    playlists, loading, user,
    async create(name, description = "") {
      const pl = { id: newId(), name: name.trim() || "New playlist", description, cover: { emoji: "🎧", color: 0 }, items: [], public: false, createdAt: Date.now(), updatedAt: Date.now() };
      await save([pl, ...ref.current]);
      return pl;
    },
    update: (id, patch) => mutate(id, (p) => ({ ...p, ...patch })),
    async remove(id) {
      const pl = ref.current.find((p) => p.id === id);
      await save(ref.current.filter((p) => p.id !== id));
      if (pl?.public) await deleteDoc(doc(db, "playlists", id)).catch(() => {});
      return pl;
    },
    async restore(pl) {
      await save([pl, ...ref.current.filter((p) => p.id !== pl.id)]);
      if (pl.public) await syncPublic(pl).catch(() => {});
    },
    addItems: (id, audios) => mutate(id, (p) => {
      const have = new Set(p.items.map((i) => i.id));
      return { ...p, items: [...p.items, ...audios.filter((a) => a?.id && !have.has(a.id)).map((a) => ({ ...slimTrack(a), addedAt: Date.now() }))] };
    }),
    removeItem: (id, audioId) => mutate(id, (p) => ({ ...p, items: p.items.filter((i) => i.id !== audioId) })),
    insertItem: (id, item, index) => mutate(id, (p) => { const items = [...p.items.filter((i) => i.id !== item.id)]; items.splice(Math.min(index, items.length), 0, item); return { ...p, items }; }),
    move: (id, from, to) => mutate(id, (p) => {
      if (from === to || from < 0 || to < 0 || from >= p.items.length || to >= p.items.length) return p;
      const items = [...p.items]; const [it] = items.splice(from, 1); items.splice(to, 0, it); return { ...p, items };
    }),
    async setPublic(id, value) {
      await mutate(id, (p) => ({ ...p, public: value }));
      if (!value) await deleteDoc(doc(db, "playlists", id)).catch(() => {});
    },
  }), [playlists, loading, user, save, mutate, syncPublic]);

  return <PlaylistContext.Provider value={api}>{children}</PlaylistContext.Provider>;
}
