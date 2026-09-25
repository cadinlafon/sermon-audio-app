import { dayKey } from "./listenTracker";

// Listening goals: a goal is { id, period: week|month|year, metric, target, seriesType?, createdAt, celebrated }.
//   minutes    total listening minutes in the period
//   recordings recordings you finished in the period
//   doctrine   Doctrine listening minutes in the period
//   series     recordings finished in one category (all time) toward `target`
export const PERIODS = [["week", "This week"], ["month", "This month"], ["year", "This year"]];
export const METRICS = [
  ["minutes", "Listening minutes"],
  ["recordings", "Recordings finished"],
  ["doctrine", "Doctrine minutes"],
  ["series", "Complete a series"],
];
export const SERIES_TYPES = [["sermon", "Sermons"], ["homily", "Homilies"], ["sundayschool", "Sunday School"]];

// Weeks run Sunday → Saturday.
export function periodRange(period, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let end;
  if (period === "week") { start.setDate(start.getDate() - start.getDay()); end = new Date(start); end.setDate(end.getDate() + 7); }
  else if (period === "month") { start.setDate(1); end = new Date(start.getFullYear(), start.getMonth() + 1, 1); }
  else { start.setMonth(0, 1); end = new Date(start.getFullYear() + 1, 0, 1); }
  return { start, end, key: `${period}-${dayKey(start)}` };
}

const inRange = (key, start, end) => key >= dayKey(start) && key < dayKey(end);

export function sumDaily(daily, range, field = "seconds") {
  return Object.entries(daily || {}).reduce((s, [day, v]) => (inRange(day, range.start, range.end) ? s + (Number(v?.[field]) || 0) : s), 0);
}

// Current and longest run of consecutive listening days.
export function computeStreaks(daily, today = new Date()) {
  const days = new Set(Object.entries(daily || {}).filter(([, v]) => Number(v?.seconds) > 0).map(([d]) => d));
  const step = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!days.has(dayKey(cursor))) cursor = step(cursor, -1); // today may not have happened yet
  let current = 0;
  while (days.has(dayKey(cursor))) { current++; cursor = step(cursor, -1); }
  const sorted = [...days].sort();
  let longest = 0; let run = 0; let prev = null;
  for (const d of sorted) {
    run = prev && dayKey(step(prev, 1)) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = new Date(d + "T00:00:00");
  }
  return { current, longest };
}

// { value, target, unit, pct, done, label }
export function goalProgress(goal, { daily, completed, audioTypes, totals }) {
  const range = periodRange(goal.period || "week");
  const inPeriod = (ms) => ms >= range.start.getTime() && ms < range.end.getTime();
  let value = 0; let target = Number(goal.target) || 0; let unit = "min";

  if (goal.metric === "minutes") value = sumDaily(daily, range) / 60;
  else if (goal.metric === "doctrine") value = sumDaily(daily, range, "doctrineSeconds") / 60;
  else if (goal.metric === "recordings") { value = completed.filter((c) => inPeriod(c.at)).length; unit = "recordings"; }
  else if (goal.metric === "series") {
    value = completed.filter((c) => audioTypes[c.audioId] === goal.seriesType).length;
    target = Number(goal.target) || totals?.[goal.seriesType] || 1;
    unit = "recordings";
  }
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  return { value, target, unit, pct, done: target > 0 && value >= target, rangeKey: goal.metric === "series" ? "series" : range.key };
}

export const fmtMinutes = (m) => { const total = Math.round(m); const h = Math.floor(total / 60); return h ? `${h}h ${total % 60}m` : `${total}m`; };
export const asciiBar = (pct, width = 12) => { const n = Math.round((pct / 100) * width); return "█".repeat(n) + "░".repeat(width - n); };
