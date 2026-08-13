// ─── TRAINING STATS ────────────────────────────────────────────────────────────
// Pure, total functions for the training-overview dashboard. All volume figures
// are computed in LB internally; convert to the display unit at the render layer.
// Dates follow the same LOCAL-calendar-date rules as dateUtils.js — never
// toISOString() for a training date.
import { parseLocalDate, addDaysISO, localISO, todayISO } from "./dateUtils.js";
import { formGuide } from "./data/formGuide.js";

export const MUSCLE_GROUPS = {
  chest: "Chest",
  lats: "Back", traps: "Back", midBack: "Back", lowerBack: "Back",
  frontDelts: "Shoulders", sideDelts: "Shoulders", rearDelts: "Shoulders",
  biceps: "Arms", triceps: "Arms", forearms: "Arms",
  glutes: "Legs", quads: "Legs", hamstrings: "Legs", calves: "Legs", adductors: "Legs",
  abs: "Core", obliques: "Core",
};

const KG_TO_LB = 2.20462;

/** Parse a weight string in the given unit and return it in lb. 0 for blank/NaN. */
export function toLb(weight, unit) {
  const n = parseFloat(weight);
  if (isNaN(n)) return 0;
  return unit === "kg" ? n * KG_TO_LB : n;
}

/** The unit ("lb"/"kg") used by the most logged sets across all sessions. */
export function dominantUnit(sessions) {
  const counts = { lb: 0, kg: 0 };
  for (const s of Array.isArray(sessions) ? sessions : []) {
    for (const ex of Array.isArray(s?.exercises) ? s.exercises : []) {
      for (const set of Array.isArray(ex?.sets) ? ex.sets : []) {
        const u = set?.unit === "kg" ? "kg" : "lb";
        counts[u]++;
      }
    }
  }
  return counts.kg > counts.lb ? "kg" : "lb";
}

/** Volume of a single set, in lb. 0 if weight or reps is blank/NaN. */
export function setVolume(set) {
  const reps = parseFloat(set?.reps);
  if (isNaN(reps)) return 0;
  return toLb(set?.weight, set?.unit) * reps;
}

/** Total volume of a session, in lb, across all exercises' sets. */
export function sessionVolume(session) {
  let total = 0;
  for (const ex of Array.isArray(session?.exercises) ? session.exercises : []) {
    for (const set of Array.isArray(ex?.sets) ? ex.sets : []) {
      total += setVolume(set);
    }
  }
  return total;
}

/** The Monday ("YYYY-MM-DD") of the Mon→Sun week containing the given local date. */
export function weekStartISO(iso) {
  const d = parseLocalDate(iso);
  const dow = d.getDay(); // 0=Sun..6=Sat
  const offsetFromMonday = dow === 0 ? 6 : dow - 1;
  return addDaysISO(localISO(d), -offsetFromMonday);
}

function shortLabel(iso) {
  const d = parseLocalDate(iso);
  return (d.getMonth() + 1) + "/" + d.getDate();
}

/**
 * Last `weeks` Mon→Sun buckets ending with the week containing `todayIso`,
 * oldest first. Always exactly `weeks` entries — zero-activity weeks included.
 */
export function weeklyVolume(sessions, weeks = 12, todayIso = todayISO()) {
  const list = Array.isArray(sessions) ? sessions : [];
  const currentWeekStart = weekStartISO(todayIso);
  const buckets = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = addDaysISO(currentWeekStart, -7 * i);
    buckets.push({ weekStart, label: shortLabel(weekStart), volume: 0, sessions: 0 });
  }
  const byStart = new Map(buckets.map(b => [b.weekStart, b]));
  for (const s of list) {
    if (!s?.date) continue;
    const bucket = byStart.get(weekStartISO(s.date));
    if (!bucket) continue;
    bucket.volume += sessionVolume(s);
    bucket.sessions += 1;
  }
  return buckets;
}

/** Current Mon→Sun week vs the previous one. deltaPct is null if prevVolume is 0. */
export function weekSummary(sessions, todayIso = todayISO()) {
  const list = Array.isArray(sessions) ? sessions : [];
  const currentStart = weekStartISO(todayIso);
  const prevStart = addDaysISO(currentStart, -7);
  let sessionsCount = 0, volume = 0, prevVolume = 0;
  for (const s of list) {
    if (!s?.date) continue;
    const ws = weekStartISO(s.date);
    if (ws === currentStart) {
      sessionsCount += 1;
      volume += sessionVolume(s);
    } else if (ws === prevStart) {
      prevVolume += sessionVolume(s);
    }
  }
  const deltaPct = prevVolume > 0 ? Math.round(((volume - prevVolume) / prevVolume) * 100) : null;
  return { sessions: sessionsCount, volume, prevVolume, deltaPct };
}

/**
 * Muscle-group share of volume over the last `weeks` weeks, sorted descending.
 * Exercises without a formGuide entry are skipped for attribution (but still
 * count toward volume elsewhere). Volume is split evenly across the deduped
 * groups implied by the exercise's primary muscles.
 */
export function muscleBalance(sessions, weeks = 4, todayIso = todayISO()) {
  const list = Array.isArray(sessions) ? sessions : [];
  const currentStart = weekStartISO(todayIso);
  const cutoffStart = addDaysISO(currentStart, -7 * (weeks - 1));
  const totals = {};

  for (const s of list) {
    if (!s?.date) continue;
    const ws = weekStartISO(s.date);
    if (ws < cutoffStart || ws > currentStart) continue;
    for (const ex of Array.isArray(s.exercises) ? s.exercises : []) {
      const guide = formGuide[ex?.name];
      if (!guide || !Array.isArray(guide.primary) || guide.primary.length === 0) continue;
      const exVolume = (Array.isArray(ex.sets) ? ex.sets : []).reduce((sum, set) => sum + setVolume(set), 0);
      if (exVolume <= 0) continue;
      const groups = [...new Set(guide.primary.map(m => MUSCLE_GROUPS[m]).filter(Boolean))];
      if (groups.length === 0) continue;
      const share = exVolume / groups.length;
      for (const g of groups) totals[g] = (totals[g] || 0) + share;
    }
  }

  const total = Object.values(totals).reduce((a, b) => a + b, 0);
  if (total <= 0) return [];

  return Object.entries(totals)
    .map(([group, volume]) => ({ group, volume, pct: Math.round((volume / total) * 100) }))
    .sort((a, b) => b.volume - a.volume);
}
