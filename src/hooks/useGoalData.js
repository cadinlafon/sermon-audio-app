import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDocs, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { loadAudioList } from "../utils/audioListCache";
import { computeStreaks } from "../utils/goals";

// Everything goals need: the user's goal list, daily listening totals,
// finished recordings, and each recording's category.
export default function useGoalData() {
  const [user, setUser] = useState(auth.currentUser);
  const [goals, setGoals] = useState([]);
  const [stats, setStats] = useState({ daily: {}, longestSessionSeconds: 0, totalSeconds: 0 });
  const [completed, setCompleted] = useState([]);
  const [audioTypes, setAudioTypes] = useState({});
  const [totals, setTotals] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) { setGoals([]); setLoading(false); return undefined; }
    const unsubs = [];
    unsubs.push(onSnapshot(doc(db, "users", user.uid), (s) => { const g = s.exists() ? s.data().goals : []; setGoals(Array.isArray(g) ? g : []); setLoading(false); }, () => setLoading(false)));
    unsubs.push(onSnapshot(doc(db, "userStats", user.uid), (s) => {
      const d = s.exists() ? s.data() : {};
      setStats({ daily: d.daily || {}, longestSessionSeconds: Number(d.longestSessionSeconds) || 0, totalSeconds: Number(d.totalSeconds) || 0, sermons: d.sermons || {} });
    }, () => {}));
    getDocs(query(collection(db, "listenProgress"), where("userId", "==", user.uid)))
      .then((snap) => setCompleted(snap.docs.map((d) => d.data()).filter((x) => x.status === "completed").map((x) => ({ audioId: x.audioId, at: x.updatedAt?.seconds ? x.updatedAt.seconds * 1000 : 0 }))))
      .catch(() => {});
    loadAudioList(async () => (await getDocs(collection(db, "audio"))).docs.map((d) => ({ id: d.id, ...d.data() })), () => true).then((list) => {
      setAudioTypes(Object.fromEntries(list.map((a) => [a.id, a.type])));
      const t = {}; list.forEach((a) => { t[a.type] = (t[a.type] || 0) + 1; }); setTotals(t);
    }).catch(() => {});
    return () => unsubs.forEach((u) => u());
  }, [user]);

  const saveGoals = async (next) => {
    if (!user) return;
    setGoals(next);
    await updateDoc(doc(db, "users", user.uid), { goals: next });
  };

  return { user, goals, saveGoals, stats, completed, audioTypes, totals, loading, streaks: computeStreaks(stats.daily) };
}
