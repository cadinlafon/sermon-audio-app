////////////////////////////////////////////////////////////////
// LOG DATE RANGE
//
// Turns the Logs page's Date filter into the time window that has to
// be READ from Firestore. Used for the query itself (so the page only
// pays for the range it's showing) and by the on-screen filter, so the
// two can never disagree.
//
// "all" is the only choice with no bounds — it reads the entire logs
// collection, which is why the page asks for confirmation first.
////////////////////////////////////////////////////////////////

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// "YYYY-MM-DD" (an <input type="date"> value) -> local midnight.
// new Date("2026-10-14") would be UTC midnight, which is the previous
// calendar day for anyone west of UTC (e.g. Pacific time).
export function parseLocalDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function sanitizeDays(days) {
  const n = Number(days);
  return Number.isFinite(n) && n > 0 ? n : 7;
}

/**
 * @param {{date: string, days?: number|string, customDate?: string}} filters
 * @returns {{ start: Date|null, end: Date|null, skip: boolean }}
 *   start inclusive, end exclusive; null = unbounded. `skip` means
 *   there's nothing to load yet ("Specific date" with no date chosen),
 *   which must NOT fall back to reading everything.
 */
export function getLogDateRange(filters, now = new Date()) {
  switch (filters.date) {
    case "all":
      return { start: null, end: null, skip: false };

    case "yesterday": {
      const end = startOfLocalDay(now);
      const start = new Date(end);
      start.setDate(start.getDate() - 1);
      return { start, end, skip: false };
    }

    case "lastX": {
      const start = new Date(now);
      start.setDate(start.getDate() - sanitizeDays(filters.days));
      return { start, end: null, skip: false };
    }

    case "custom": {
      const start = parseLocalDate(filters.customDate);
      if (!start) return { start: null, end: null, skip: true };
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return { start, end, skip: false };
    }

    case "today":
    default:
      return { start: startOfLocalDay(now), end: null, skip: false };
  }
}
