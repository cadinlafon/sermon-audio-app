import { useEffect, useRef } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import useGoalData from "../hooks/useGoalData";
import { goalProgress, fmtMinutes } from "../utils/goals";
import { useToast } from "../context/ToastContext";
import { celebrate } from "./Confetti";

// Watches your goals in the background: when one is reached, shows a
// celebration (and a system notification if you've allowed them), once per period.
export default function GoalWatcher() {
  const { user, goals, stats, completed, audioTypes, totals } = useGoalData();
  const { toast } = useToast();
  const busy = useRef(false);

  useEffect(() => {
    if (!user || busy.current || goals.length === 0) return;
    const reached = goals
      .map((g) => ({ g, p: goalProgress(g, { daily: stats.daily, completed, audioTypes, totals }) }))
      .filter(({ g, p }) => p.done && g.celebrated !== p.rangeKey);
    if (reached.length === 0) return;

    busy.current = true;
    const next = goals.map((g) => {
      const hit = reached.find((r) => r.g.id === g.id);
      return hit ? { ...g, celebrated: hit.p.rangeKey } : g;
    });
    updateDoc(doc(db, "users", user.uid), { goals: next }).catch(() => {}).finally(() => { busy.current = false; });

    for (const { g, p } of reached) {
      const what = g.metric === "series" || g.metric === "recordings" ? `${Math.round(p.value)} recordings` : fmtMinutes(p.value);
      toast(`🎉 Goal reached: ${what}!`, { type: "success", duration: 7000 });
      celebrate();
      try {
        if ("Notification" in window && Notification.permission === "granted") new Notification("Goal reached 🎉", { body: `You hit your goal — ${what}. Nice work!`, icon: "/icons/icon-192.png" });
      } catch { /* notifications unavailable */ }
    }
  }, [user, goals, stats, completed, audioTypes, totals, toast]);

  return null;
}
