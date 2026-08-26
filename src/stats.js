// ─── TRAINING STATS ────────────────────────────────────────────────────────────
// Pure, total functions for the training-overview dashboard. All volume figures
// are computed in LB internally; convert to the display unit at the render layer.
// Dates follow the same LOCAL-calendar-date rules as dateUtils.js — never
// toISOString() for a training date.
import { parseLocalDate, addDaysISO, localISO, todayISO } from "./dateUtils.js";
import { MUSCLES, formGuide } from "./data/formGuide.js";

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

const UNILATERAL_RE = /\b(single[- ]arm|one[- ]arm|unilateral)\b/i;

/**
 * True if an exercise name refers to a two-handed dumbbell variant
 * ("Dumbbell ...", "DB ..."). Single-arm/unilateral variants are excluded
 * since those are logged and lifted with only one dumbbell.
 */
export function isDumbbellExercise(name) {
  const text = String(name ?? "");
  return /\b(dumbbell|db)\b/i.test(text) && !UNILATERAL_RE.test(text);
}

/**
 * Volume of a single set, in lb. 0 if weight or reps is blank/NaN.
 * Dumbbell exercises are logged as the weight of ONE dumbbell, so volume is
 * doubled for them to reflect the load of both implements.
 */
export function setVolume(set, exerciseName) {
  const reps = parseFloat(set?.reps);
  if (isNaN(reps)) return 0;
  const multiplier = isDumbbellExercise(exerciseName) ? 2 : 1;
  return toLb(set?.weight, set?.unit) * reps * multiplier;
}

/** Total volume of a session, in lb, across all exercises' sets. */
export function sessionVolume(session) {
  let total = 0;
  for (const ex of Array.isArray(session?.exercises) ? session.exercises : []) {
    for (const set of Array.isArray(ex?.sets) ? ex.sets : []) {
      total += setVolume(set, ex?.name);
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
    buckets.push({ weekStart, label: shortLabel(weekStart), volume: 0, sessions: 0, sets: 0, dates: new Set() });
  }
  const byStart = new Map(buckets.map(b => [b.weekStart, b]));
  for (const s of list) {
    if (!s?.date) continue;
    const bucket = byStart.get(weekStartISO(s.date));
    if (!bucket) continue;
    bucket.volume += sessionVolume(s);
    bucket.sets += (s.exercises || []).reduce((n, ex) => n + (ex.sets?.length || 0), 0);
    bucket.dates.add(s.date);
  }
  // "sessions" counts distinct training days, not raw records — a single
  // training day is sometimes saved as several session records sharing one
  // date (e.g. saving one exercise at a time), see lastSameDaySummary.
  return buckets.map(({ dates, ...bucket }) => ({ ...bucket, sessions: dates.size }));
}

function shiftMonthKey(key, offset) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString([], { month: "short", year: "2-digit" });
}

/**
 * Last `months` calendar-month buckets ending with the month containing
 * `todayIso`, oldest first. Always exactly `months` entries — zero-activity
 * months included. Mirrors weeklyVolume's shape at month granularity.
 */
export function monthlyVolume(sessions, months = 12, todayIso = todayISO()) {
  const list = Array.isArray(sessions) ? sessions : [];
  const currentKey = monthKey(todayIso);
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const key = shiftMonthKey(currentKey, -i);
    buckets.push({ monthStart: key, label: monthLabel(key), volume: 0, sessions: 0, sets: 0, dates: new Set() });
  }
  const byKey = new Map(buckets.map(b => [b.monthStart, b]));
  for (const s of list) {
    if (!s?.date) continue;
    const bucket = byKey.get(monthKey(s.date));
    if (!bucket) continue;
    bucket.volume += sessionVolume(s);
    bucket.sets += (s.exercises || []).reduce((n, ex) => n + (ex.sets?.length || 0), 0);
    bucket.dates.add(s.date);
  }
  // "sessions" counts distinct training days, not raw records — see the
  // matching comment in weeklyVolume.
  return buckets.map(({ dates, ...bucket }) => ({ ...bucket, sessions: dates.size }));
}

const EXERCISE_TYPE_MUSCLES = {
  Push: ["chest", "frontDelts", "sideDelts", "triceps"],
  Pull: ["lats", "traps", "midBack", "lowerBack", "rearDelts", "biceps", "forearms"],
  Legs: ["glutes", "quads", "hamstrings", "calves", "adductors"],
  Core: ["abs", "obliques"],
};
const EXERCISE_TYPES = Object.keys(EXERCISE_TYPE_MUSCLES);
const MUSCLE_TO_EXERCISE_TYPE = Object.fromEntries(
  EXERCISE_TYPES.flatMap(type => EXERCISE_TYPE_MUSCLES[type].map(muscle => [muscle, type]))
);

/** Push/Pull/Legs/Core for an exercise, by majority vote of its primary muscles. Null if unclassifiable. */
function exerciseType(name) {
  const primary = formGuide[name]?.primary || [];
  const tally = {};
  for (const muscle of primary) {
    const type = MUSCLE_TO_EXERCISE_TYPE[muscle];
    if (type) tally[type] = (tally[type] || 0) + 1;
  }
  let best = null;
  for (const type of EXERCISE_TYPES) if (tally[type] && (!best || tally[type] > tally[best])) best = type;
  return best;
}

/**
 * Groups sessions into distinct training days (same date — a single
 * training day is not always one session record, see lastSameDaySummary),
 * classifies each by whichever exercise type (Push/Pull/Legs/Core, from the
 * app's muscle guide) makes up most of its sets, then compares those types
 * against each other across successive occurrences of each — independent of
 * whatever free-text `day` label the session itself was saved under. A
 * training day with no classifiable exercises (e.g. only custom exercises
 * without a muscle guide entry) is excluded rather than lumped into a
 * misleading catch-all bucket. Returns the exercise types with at least one
 * occurrence and one row per occurrence number, each row holding that
 * occurrence's value per type (a type with fewer occurrences than others
 * simply has no key for the later occurrence numbers).
 */
export function dayTypeTrend(sessions, { param = "volume" } = {}) {
  const byDate = new Map();
  for (const session of Array.isArray(sessions) ? sessions : []) {
    if (!session?.date) continue;
    const entry = byDate.get(session.date) || {
      date: session.date, volume: 0, totalSets: 0,
      setsByType: Object.fromEntries(EXERCISE_TYPES.map(type => [type, 0])),
    };
    for (const exercise of Array.isArray(session.exercises) ? session.exercises : []) {
      const type = exerciseType(exercise?.name);
      const sets = Array.isArray(exercise?.sets) ? exercise.sets : [];
      entry.totalSets += sets.length;
      if (type) entry.setsByType[type] += sets.length;
      for (const set of sets) entry.volume += setVolume(set, exercise?.name);
    }
    byDate.set(session.date, entry);
  }

  const trainingDays = [...byDate.values()]
    .map(day => {
      let type = null, best = 0;
      for (const candidate of EXERCISE_TYPES) if (day.setsByType[candidate] > best) { best = day.setsByType[candidate]; type = candidate; }
      return type ? { date: day.date, type, volume: day.volume, sets: day.totalSets } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));

  const dayTypes = EXERCISE_TYPES.filter(type => trainingDays.some(day => day.type === type));

  const occurrence = new Map(dayTypes.map(type => [type, 0]));
  const rows = [];
  for (const trainingDay of trainingDays) {
    const index = (occurrence.get(trainingDay.type) || 0) + 1;
    occurrence.set(trainingDay.type, index);
    const row = rows[index - 1] || (rows[index - 1] = { occurrence: index });
    row[trainingDay.type] = Math.round(param === "sets" ? trainingDay.sets : trainingDay.volume);
  }

  return { dayTypes, data: rows.filter(Boolean) };
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

/** Home hero data: current-week volume and its change from the previous week. */
export function weekVolumeDelta(sessions, todayIso = todayISO()) {
  const summary = weekSummary(sessions, todayIso);
  const direction = summary.deltaPct === null || summary.deltaPct === 0
    ? "flat"
    : summary.deltaPct > 0 ? "up" : "down";
  return { ...summary, direction };
}

function monthKey(iso) { return iso.slice(0, 7); }

function prevMonthKey(iso) {
  const [year, month] = iso.slice(0, 7).split("-").map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Current calendar month vs the immediately preceding one. deltaPct is null if prevVolume is 0. */
export function monthSummary(sessions, todayIso = todayISO()) {
  const list = Array.isArray(sessions) ? sessions : [];
  const currentKey = monthKey(todayIso);
  const prevKey = prevMonthKey(todayIso);
  let sessionsCount = 0, volume = 0, prevVolume = 0;
  for (const s of list) {
    if (!s?.date) continue;
    const key = monthKey(s.date);
    if (key === currentKey) {
      sessionsCount += 1;
      volume += sessionVolume(s);
    } else if (key === prevKey) {
      prevVolume += sessionVolume(s);
    }
  }
  const deltaPct = prevVolume > 0 ? Math.round(((volume - prevVolume) / prevVolume) * 100) : null;
  return { sessions: sessionsCount, volume, prevVolume, deltaPct };
}

/** The heaviest set in an exercise, in lb, or null if none. */
export function topSetForExercise(exercise) {
  let best = null;
  for (const set of Array.isArray(exercise?.sets) ? exercise.sets : []) {
    const weightLb = toLb(set?.weight, set?.unit);
    if (weightLb <= 0) continue;
    if (!best || weightLb > best.weightLb) {
      best = { weightLb, weight: Number(set.weight), unit: set.unit === "kg" ? "kg" : "lb", reps: Number(set?.reps) || 0 };
    }
  }
  return best;
}

/**
 * The most recent prior date sharing `day`, strictly before `beforeDate`,
 * aggregated across every session record stored for that date — a single
 * training day is not always one session record (e.g. saving one exercise
 * at a time creates several same-date records for what is really one
 * workout), so volume is summed and each exercise's best set is taken
 * across all of that date's records, not just the first one found.
 */
export function lastSameDaySummary(sessions, day, beforeDate) {
  const list = Array.isArray(sessions) ? sessions : [];
  let targetDate = null;
  for (const session of list) {
    if (!session?.date || session.day !== day || session.date >= beforeDate) continue;
    if (!targetDate || session.date > targetDate) targetDate = session.date;
  }
  if (!targetDate) return null;

  const sameDaySessions = list.filter(session => session?.date === targetDate && session.day === day);
  const volume = Math.round(sameDaySessions.reduce((total, session) => total + sessionVolume(session), 0));

  const bestByName = new Map();
  for (const session of sameDaySessions) {
    for (const exercise of Array.isArray(session.exercises) ? session.exercises : []) {
      const best = topSetForExercise(exercise);
      if (!best) continue;
      const existing = bestByName.get(exercise.name);
      if (!existing || best.weightLb > existing.weightLb) {
        bestByName.set(exercise.name, { name: exercise.name, weight: best.weight, unit: best.unit, reps: best.reps, weightLb: best.weightLb });
      }
    }
  }

  return { date: targetDate, volume, exercises: [...bestByName.values()] };
}

/** Consecutive unique training days ending today or yesterday, plus the all-time best. */
export function currentStreak(sessions, todayIso = todayISO()) {
  const dates = [...new Set((Array.isArray(sessions) ? sessions : [])
    .map(session => session?.date)
    .filter(date => date && date <= todayIso))].sort();
  if (dates.length === 0) return { current: 0, longest: 0 };

  let longest = 1, run = 1;
  for (let index = 1; index < dates.length; index++) {
    if (dates[index] === addDaysISO(dates[index - 1], 1)) run += 1;
    else run = 1;
    longest = Math.max(longest, run);
  }

  const latest = dates.at(-1);
  if (latest !== todayIso && latest !== addDaysISO(todayIso, -1)) return { current: 0, longest };
  let current = 1;
  for (let index = dates.length - 1; index > 0; index--) {
    if (dates[index - 1] !== addDaysISO(dates[index], -1)) break;
    current += 1;
  }
  return { current, longest };
}

/** Epley estimated one-rep max in the same unit as the input weight. */
export function estimated1RM(weight, reps) {
  const load = Number(weight), count = Number(reps);
  if (!Number.isFinite(load) || !Number.isFinite(count) || load <= 0 || count <= 0) return 0;
  return count === 1 ? load : load * (1 + count / 30);
}

/** Best estimated 1RM per training date for an exercise, oldest first, in lb. */
export function exerciseE1RMSeries(sessions, name) {
  const byDate = new Map();
  for (const session of Array.isArray(sessions) ? sessions : []) {
    if (!session?.date) continue;
    for (const exercise of Array.isArray(session.exercises) ? session.exercises : []) {
      if (exercise?.name !== name) continue;
      for (const set of Array.isArray(exercise.sets) ? exercise.sets : []) {
        const value = estimated1RM(toLb(set?.weight, set?.unit), set?.reps);
        if (value > (byDate.get(session.date) || 0)) byDate.set(session.date, value);
      }
    }
  }
  return [...byDate].sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value: Math.round(value * 10) / 10 }));
}

/** Recent all-time load records, newest first. Equal loads do not create another record. */
export function personalRecords(sessions, limit = 5) {
  const best = new Map(), records = [];
  const ordered = [...(Array.isArray(sessions) ? sessions : [])]
    .filter(session => session?.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const session of ordered) {
    for (const exercise of Array.isArray(session.exercises) ? session.exercises : []) {
      let candidate = null;
      for (const set of Array.isArray(exercise?.sets) ? exercise.sets : []) {
        const weightLb = toLb(set?.weight, set?.unit);
        if (weightLb > 0 && (!candidate || weightLb > candidate.weightLb)) candidate = { weightLb, set };
      }
      if (!candidate || candidate.weightLb <= (best.get(exercise.name) || 0)) continue;
      best.set(exercise.name, candidate.weightLb);
      records.push({ date: session.date, name: exercise.name, weight: Number(candidate.set.weight), unit: candidate.set.unit === "kg" ? "kg" : "lb", reps: Number(candidate.set.reps) || 0 });
    }
  }
  return records.sort((a, b) => b.date.localeCompare(a.date)).slice(0, Math.max(0, limit));
}

/** Readiness heuristic: 100 after 4+ rest days, falling with recent hard-set exposure. */
export function muscleFreshness(sessions, todayIso = todayISO()) {
  const recent = muscleSetVolume(sessions, 14, todayIso);
  return Object.fromEntries(Object.keys(MUSCLES).map(muscle => {
    const last = recent.lastTrained[muscle];
    if (!last) return [muscle, 100];
    const days = Math.round((parseLocalDate(todayIso) - parseLocalDate(last)) / 86400000);
    const recovery = Math.min(100, Math.max(0, days * 30));
    const loadPenalty = Math.min(25, Math.max(0, recent.sets[muscle] - 6) * 2.5);
    return [muscle, Math.round(Math.max(0, recovery - loadPenalty))];
  }));
}

/** Push vs pull hard-set share across a rolling day window. */
export function pushPullRatio(sessions, days = 28, todayIso = todayISO()) {
  const start = addDaysISO(todayIso, -Math.max(1, days) + 1);
  let push = 0, pull = 0;
  for (const session of Array.isArray(sessions) ? sessions : []) {
    if (!session?.date || session.date < start || session.date > todayIso) continue;
    for (const exercise of Array.isArray(session.exercises) ? session.exercises : []) {
      const count = Array.isArray(exercise?.sets) ? exercise.sets.length : 0;
      const primary = formGuide[exercise?.name]?.primary || [];
      if (primary.some(muscle => ["chest", "frontDelts", "sideDelts", "triceps", "quads"].includes(muscle))) push += count;
      if (primary.some(muscle => ["lats", "traps", "midBack", "lowerBack", "rearDelts", "biceps", "hamstrings"].includes(muscle))) pull += count;
    }
  }
  const total = push + pull;
  return { push, pull, pushPct: total ? Math.round(push / total * 100) : 0, pullPct: total ? Math.round(pull / total * 100) : 0 };
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
      const exVolume = (Array.isArray(ex.sets) ? ex.sets : []).reduce((sum, set) => sum + setVolume(set, ex.name), 0);
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

/**
 * Twelve-week Monday→Sunday activity grid. Each inner array is one week.
 * `level` (0-4) buckets each day's total volume relative to the busiest day
 * in the window, so the heatmap reflects how much was actually lifted that
 * day rather than merely whether a session was logged — a day with one light
 * session and a day with three heavy ones should not render identically.
 */
export function activityCalendar(sessions, weeks = 12, todayIso = todayISO()) {
  const countByDate = new Map();
  const volumeByDate = new Map();
  for (const session of Array.isArray(sessions) ? sessions : []) {
    if (!session?.date || session.date > todayIso) continue;
    countByDate.set(session.date, (countByDate.get(session.date) || 0) + 1);
    volumeByDate.set(session.date, (volumeByDate.get(session.date) || 0) + sessionVolume(session));
  }
  const firstMonday = addDaysISO(weekStartISO(todayIso), -7*(weeks-1));
  const maxVolume = Math.max(0, ...volumeByDate.values());
  const levelFor = volume => {
    if (!volume) return 0;
    if (!maxVolume) return 1;
    const ratio = volume / maxVolume;
    return ratio >= 0.75 ? 4 : ratio >= 0.5 ? 3 : ratio >= 0.25 ? 2 : 1;
  };
  return Array.from({length:weeks}, (_,week) => Array.from({length:7}, (_,day) => {
    const date = addDaysISO(firstMonday, week*7+day);
    const volume = volumeByDate.get(date) || 0;
    return { date, count:countByDate.get(date) || 0, volume, level:levelFor(volume), future:date>todayIso };
  }));
}

/** Adherence summary for the rolling last four weeks, against a five-day plan. */
export function consistencySummary(sessions, todayIso = todayISO()) {
  const start = addDaysISO(todayIso, -27);
  const dates = new Set((Array.isArray(sessions) ? sessions : [])
    .map(session => session?.date)
    .filter(date => date && date>=start && date<=todayIso));
  const activeWeeks = new Set([...dates].map(weekStartISO)).size;
  return {
    workouts:dates.size,
    activeWeeks,
    goalPct:Math.min(100, Math.round((dates.size/20)*100)),
  };
}

/**
 * Muscle groups trained in one or fewer of the last completed `weeks` weeks.
 * This is presence-based, not volume-based, so unweighted core work counts.
 * The current partial week is deliberately excluded to avoid premature alerts.
 */
export function muscleCoverageGaps(sessions, weeks = 4, todayIso = todayISO()) {
  const completedWeekStarts=Array.from({length:weeks},(_,index)=>addDaysISO(weekStartISO(todayIso),-7*(index+1)));
  const groups=Object.values(MUSCLE_GROUPS).filter((group,index,all)=>all.indexOf(group)===index);
  const activeByGroup=new Map(groups.map(group=>[group,new Set()]));
  const completedSet=new Set(completedWeekStarts);
  const observedWeeks=new Set();

  for(const session of Array.isArray(sessions)?sessions:[]) {
    if(!session?.date) continue;
    const week=weekStartISO(session.date);
    if(!completedSet.has(week)) continue;
    observedWeeks.add(week);
    for(const exercise of session.exercises||[]) {
      if(!Array.isArray(exercise?.sets)||exercise.sets.length===0) continue;
      const guide=formGuide[exercise?.name];
      const exerciseGroups=new Set((guide?.primary||[]).map(muscle=>MUSCLE_GROUPS[muscle]).filter(Boolean));
      for(const group of exerciseGroups) activeByGroup.get(group)?.add(week);
    }
  }

  // Avoid calling a pattern "consistent" before there is enough history.
  if(observedWeeks.size<3) return [];

  return groups.map(group=>{
    const activeWeeks=activeByGroup.get(group).size;
    return {group,activeWeeks,missedWeeks:weeks-activeWeeks,weeks};
  }).filter(item=>item.activeWeeks<=1).sort((a,b)=>b.missedWeeks-a.missedWeeks||a.group.localeCompare(b.group));
}

/** Individual-muscle coverage for a rolling day range ending today. */
export function muscleHeatmapCoverage(sessions, days = 7, todayIso = todayISO()) {
  const start=addDaysISO(todayIso,-Math.max(1,days)+1);
  const scores=Object.fromEntries(Object.keys(MUSCLES).map(muscle=>[muscle,0]));
  for(const session of Array.isArray(sessions)?sessions:[]) {
    if(!session?.date||session.date<start||session.date>todayIso) continue;
    for(const exercise of session.exercises||[]) {
      if(!Array.isArray(exercise?.sets)||exercise.sets.length===0) continue;
      const guide=formGuide[exercise?.name];
      for(const muscle of new Set(guide?.primary||[])) if(muscle in scores) scores[muscle]+=1;
      for(const muscle of new Set(guide?.secondary||[])) if(muscle in scores) scores[muscle]+=0.5;
    }
  }
  const missed=Object.keys(scores).filter(muscle=>scores[muscle]===0);
  return {days,start,end:todayIso,scores,missed,trained:Object.keys(scores).filter(muscle=>scores[muscle]>0)};
}

/**
 * Builds a compact exercise list that covers the selected missing muscles.
 * Primary-muscle matches are preferred. Secondary matches are used only when
 * they reduce gaps left by those direct recommendations (for example adductors,
 * which are supporting muscles in the built-in program).
 */
export function exerciseSuggestionsForMissed(missedMuscles, options={}) {
  const remaining=new Set((Array.isArray(missedMuscles)?missedMuscles:[]).filter(muscle=>muscle in MUSCLES));
  const candidates=Object.entries(formGuide).map(([name,guide])=>({name,primary:guide.primary||[],secondary:guide.secondary||[]}));
  const suggestions=[];
  const recent=new Set(options.recentExercises||[]);
  const avoid=new Set(options.avoidMuscles||[]);
  const preferred=options.preferredEquipment;

  while(remaining.size>0) {
    let best=null;
    for(const candidate of candidates) {
      if(suggestions.some(item=>item.name===candidate.name)) continue;
      const direct=candidate.primary.filter(muscle=>remaining.has(muscle));
      const supporting=candidate.secondary.filter(muscle=>remaining.has(muscle));
      if(direct.length===0&&supporting.length===0) continue;
      if(candidate.primary.some(muscle=>avoid.has(muscle))) continue;
      const machine=/Machine|Cable|Pulldown/.test(candidate.name);
      const equipmentBonus=preferred==="machine"?(machine?3:0):preferred==="free"?(!machine?3:0):0;
      const score=direct.length*100+supporting.length*10+equipmentBonus-(recent.has(candidate.name)?20:0);
      if(!best||score>best.score) best={...candidate,direct,supporting,score};
    }
    if(!best) break;
    const covered=[...best.direct,...best.supporting];
    suggestions.push({name:best.name,direct:best.direct,supporting:best.supporting,covered});
    covered.forEach(muscle=>remaining.delete(muscle));
  }

  return {suggestions,uncovered:[...remaining]};
}

/** Approximate hard-set stimulus: primary = 1 set, secondary = 0.5 set. */
export function muscleSetVolume(sessions, days = 7, todayIso = todayISO()) {
  const start=addDaysISO(todayIso,-Math.max(1,days)+1);
  const sets=Object.fromEntries(Object.keys(MUSCLES).map(muscle=>[muscle,0]));
  const lastTrained=Object.fromEntries(Object.keys(MUSCLES).map(muscle=>[muscle,null]));
  for(const session of Array.isArray(sessions)?sessions:[]) {
    if(!session?.date||session.date<start||session.date>todayIso) continue;
    for(const exercise of session.exercises||[]) {
      const count=Array.isArray(exercise?.sets)?exercise.sets.length:0;
      if(!count) continue;
      const guide=formGuide[exercise.name];
      for(const muscle of new Set(guide?.primary||[])) if(muscle in sets) { sets[muscle]+=count; if(!lastTrained[muscle]||session.date>lastTrained[muscle]) lastTrained[muscle]=session.date; }
      for(const muscle of new Set(guide?.secondary||[])) if(muscle in sets) { sets[muscle]+=count*0.5; if(!lastTrained[muscle]||session.date>lastTrained[muscle]) lastTrained[muscle]=session.date; }
    }
  }
  return {days,start,end:todayIso,sets,lastTrained};
}

export function dashboardRangeSummary(sessions, days = 7, todayIso = todayISO()) {
  const start=addDaysISO(todayIso,-Math.max(1,days)+1);
  const inRange=(Array.isArray(sessions)?sessions:[]).filter(session=>session?.date>=start&&session.date<=todayIso);
  return {days,start,end:todayIso,sessions:inRange.length,workoutDays:new Set(inRange.map(session=>session.date)).size,sets:inRange.reduce((sum,session)=>sum+(session.exercises||[]).reduce((n,exercise)=>n+(exercise.sets?.length||0),0),0),volume:inRange.reduce((sum,session)=>sum+sessionVolume(session),0)};
}

export function musclePriorities(setVolume, targets={}, plannedDays=5, todayIso=todayISO()) {
  const scale=Math.max(1,Number(plannedDays)||5)/5;
  return Object.keys(MUSCLES).map(muscle=>{
    const done=Number(setVolume?.sets?.[muscle])||0;
    const target=Math.max(1,Number(targets?.[muscle])||Math.round(10*scale));
    const last=setVolume?.lastTrained?.[muscle];
    const daysSince=last?Math.max(0,Math.round((parseLocalDate(todayIso)-parseLocalDate(last))/86400000)):null;
    return {muscle,done,target,remaining:Math.max(0,target-done),pct:Math.min(100,Math.round(done/target*100)),lastTrained:last,daysSince};
  }).sort((a,b)=>b.remaining-a.remaining||(b.daysSince??999)-(a.daysSince??999)||a.muscle.localeCompare(b.muscle));
}
