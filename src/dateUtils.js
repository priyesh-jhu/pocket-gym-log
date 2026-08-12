// ─── DATE HELPERS ─────────────────────────────────────────────────────────────
// Every date in this app is a CALENDAR date in the user's own timezone — the day
// you actually trained. It is never an instant in time, so none of this may go
// through toISOString(), which converts to UTC and rolls the day over early.

/** Format a Date as YYYY-MM-DD using its LOCAL calendar day. */
export function localISO(d) {
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}

/** Parse "YYYY-MM-DD" as local midnight. `new Date(str)` would parse it as UTC. */
export function parseLocalDate(s) {
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Shift an ISO date string by n calendar days (DST-safe). */
export function addDaysISO(s, n) {
  const d = parseLocalDate(s);
  d.setDate(d.getDate() + n);
  return localISO(d);
}

/** Today's calendar date where the user is standing. */
export function todayISO(now = new Date()) {
  return localISO(now);
}

const DAY_KEYS = { 1: "MON", 2: "TUE", 3: "WED", 4: "THU", 5: "FRI" };

/** Which training day today maps to. getDay() is already local. */
export function todaysDayKey(now = new Date()) {
  return DAY_KEYS[now.getDay()] || "MON";
}
