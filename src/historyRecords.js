// ─── HISTORY RECORDS ──────────────────────────────────────────────────────────
// Pure helpers behind the History destination. Everything here treats stored
// sessions as UNTRUSTED input: a single corrupt record must be isolated, never
// allowed to blank a valid training log or crash a render.
//
// Two invariants matter most:
//
//   1. Dates are LOCAL calendar dates. Grouping and labels are derived from the
//      stored "YYYY-MM-DD" string through parseLocalDate — never `new Date(iso)`,
//      which parses as UTC and silently moves a workout into the previous month
//      for anyone west of Greenwich.
//   2. A confirmed record is never mutated. Drafts are deep copies, and a
//      failed update leaves the original deeply untouched.
import { dayOrder, dayTemplates } from "./data/exercises.js";
import { parseLocalDate } from "./dateUtils.js";
import { isCompleteSet } from "./draft.js";
import { TRACKING_TYPES, trackingForExercise } from "./exerciseTracking.js";
import { normalizeReadiness, readinessScore } from "./userFeatures.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const text = value => (typeof value === "string" ? value : "");
const isPlainObject = value => !!value && typeof value === "object" && !Array.isArray(value);

/** True only for a real local calendar date string, e.g. "2026-02-30" is not one. */
function isLocalISODate(value) {
  if (!ISO_DATE.test(text(value))) return false;
  const parsed = parseLocalDate(value);
  if (Number.isNaN(parsed.getTime())) return false;
  const [year, month, day] = value.split("-").map(Number);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

function numberOrNull(value) {
  if (value === null || value === undefined) return null;
  const raw = typeof value === "number" ? value : text(value).trim();
  if (raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function unitOf(set) { return set?.unit === "kg" ? "kg" : "lb"; }

/** The workout days the edit sheet can offer, in the app's established order. */
export const HISTORY_DAY_OPTIONS = dayOrder.map(value => ({
  value,
  label: `${dayTemplates[value].emoji} ${dayTemplates[value].label}`,
}));

/** Day identity for a card. Unknown or missing template metadata reads as Workout. */
export function dayIdentity(day) {
  const template = typeof day === "string" ? dayTemplates[day] : null;
  if (!template) return { dayLabel: "Workout", dayEmoji: "" };
  return { dayLabel: text(template.label) || "Workout", dayEmoji: text(template.emoji) };
}

function setDisplay(set, tracking) {
  const weight = numberOrNull(set.weight);
  const measure = numberOrNull(set.reps);
  const unit = unitOf(set);
  const measureText = measure === null ? "" :
    tracking === TRACKING_TYPES.TIMED ? `${measure} sec` :
    tracking === TRACKING_TYPES.DISTANCE ? `${measure} m` :
    `${measure} reps`;
  // A missing optional weight is omitted rather than rendered as a misleading 0.
  const weightText = weight === null ? "" : `${weight} ${unit}`;
  if (weightText && measureText) return `${weightText} × ${measureText}`;
  return weightText || measureText;
}

function normalizeSet(set, tracking) {
  if (!isPlainObject(set)) return null;
  const weight = numberOrNull(set.weight);
  const reps = numberOrNull(set.reps);
  if (weight === null && reps === null) return null;
  return { weight, reps, unit: unitOf(set), display: setDisplay(set, tracking) };
}

function normalizeExercise(exercise) {
  if (!isPlainObject(exercise)) return null;
  const name = text(exercise.name).trim();
  if (!name) return null;
  if (!Array.isArray(exercise.sets)) return null;
  const tracking = trackingForExercise(exercise);
  const sets = exercise.sets.map(set => normalizeSet(set, tracking)).filter(Boolean);
  if (!sets.length) return null;
  return { name, tracking, sets };
}

/** Volume only when the stored sets support one honest figure in a single unit. */
function sessionVolumeDisplay(exercises) {
  let total = 0;
  let unit = null;
  for (const exercise of exercises) {
    if (exercise.tracking !== TRACKING_TYPES.WEIGHTED) continue;
    for (const set of exercise.sets) {
      if (set.weight === null || set.reps === null || set.weight <= 0 || set.reps <= 0) continue;
      if (unit && unit !== set.unit) return null;
      unit = set.unit;
      total += set.weight * set.reps;
    }
  }
  if (!unit || total <= 0) return null;
  return { value: Math.round(total), unit };
}

function normalizeSession(session) {
  if (!isPlainObject(session)) return null;
  const id = session.id === null || session.id === undefined ? "" : String(session.id);
  if (!id) return null;
  const date = text(session.date);
  if (!isLocalISODate(date)) return null;
  if (!Array.isArray(session.exercises)) return null;

  const exercises = session.exercises.map(normalizeExercise).filter(Boolean);
  const readiness = isPlainObject(session.readiness) ? normalizeReadiness(session.readiness) : null;
  const localDate = parseLocalDate(date);

  return {
    id,
    date,
    monthKey: date.slice(0, 7),
    dateLabel: localDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }),
    ...dayIdentity(session.day),
    day: typeof session.day === "string" ? session.day : "",
    exercises,
    exerciseCount: exercises.length,
    setCount: exercises.reduce((count, exercise) => count + exercise.sets.length, 0),
    volume: sessionVolumeDisplay(exercises),
    notes: text(session.notes).trim(),
    completedAt: text(session.completedAt),
    readiness,
    readinessScore: readiness ? readinessScore(readiness) : null,
    // The exact stored record, so editing starts from what is really persisted.
    session,
  };
}

/** Safe view records for every session that can be rendered. Never mutates input. */
export function normalizeHistorySessions(sessions) {
  if (!Array.isArray(sessions)) return [];
  return sessions.map(normalizeSession).filter(Boolean);
}

// Newest first. `completedAt` then `id` break same-date ties so the order never
// depends on the order the records happened to be stored in.
function newestFirst(a, b) {
  return b.date.localeCompare(a.date)
    || b.completedAt.localeCompare(a.completedAt)
    || b.id.localeCompare(a.id);
}

function monthLabel(monthKey) {
  return parseLocalDate(`${monthKey}-01`).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/** Local calendar-month groups, newest month and newest workout first. */
export function groupSessionsByMonth(sessions) {
  const byMonth = new Map();
  for (const record of normalizeHistorySessions(sessions)) {
    if (!byMonth.has(record.monthKey)) byMonth.set(record.monthKey, []);
    byMonth.get(record.monthKey).push(record);
  }
  return [...byMonth.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map(key => {
      const grouped = [...byMonth.get(key)].sort(newestFirst);
      return { key, label: monthLabel(key), count: grouped.length, sessions: grouped };
    });
}

// ─── EDITING ──────────────────────────────────────────────────────────────────

/**
 * A deep copy of one stored record, shaped for form inputs.
 * `key` and `sourceIndex` are transient edit-only fields; they identify rows for
 * React and let preparation preserve any stored field this form does not edit.
 */
export function createHistoryDraft(session) {
  if (!isPlainObject(session)) return null;
  const exercises = Array.isArray(session.exercises) ? session.exercises : [];
  return {
    id: session.id === null || session.id === undefined ? "" : String(session.id),
    date: text(session.date),
    day: typeof session.day === "string" ? session.day : "",
    notes: text(session.notes),
    exercises: exercises.map((exercise, exerciseIndex) => {
      const sets = Array.isArray(exercise?.sets) ? exercise.sets : [];
      return {
        key: `e${exerciseIndex}`,
        sourceIndex: exerciseIndex,
        name: text(exercise?.name),
        tracking: trackingForExercise(exercise),
        sets: sets.map((set, setIndex) => ({
          key: `e${exerciseIndex}s${setIndex}`,
          sourceIndex: setIndex,
          weight: set?.weight === null || set?.weight === undefined ? "" : String(set.weight),
          reps: set?.reps === null || set?.reps === undefined ? "" : String(set.reps),
          unit: unitOf(set),
        })),
      };
    }),
  };
}

/** A blank set row for the edit sheet, carrying the exercise's stored unit. */
export function createDraftSet(exercise, key) {
  const lastUnit = exercise?.sets?.at(-1)?.unit;
  return { key, sourceIndex: null, weight: "", reps: "", unit: lastUnit === "kg" ? "kg" : "lb" };
}

function preparedSet(originalSet, draftSet) {
  const base = isPlainObject(originalSet) ? { ...originalSet } : {};
  // `done` is a live-workout flag; completed records never store it.
  delete base.done;
  return {
    ...base,
    weight: text(draftSet.weight).trim(),
    reps: text(draftSet.reps).trim(),
    unit: draftSet.unit === "kg" ? "kg" : "lb",
  };
}

/**
 * Validate an edit draft against the same rules a completed workout obeys and
 * return the record to persist. Preserves the session id, completion metadata,
 * stored exercise order/names/tracking, and every field this form never edits.
 * On failure nothing is returned and the original stays deeply unchanged.
 */
export function prepareHistoryUpdate(original, draft) {
  if (!isPlainObject(original) || !isPlainObject(draft)) {
    return { ok: false, session: null, field: null, error: "That workout is no longer available on this device." };
  }
  if (!isLocalISODate(draft.date)) {
    return { ok: false, session: null, field: "date", error: "Choose the calendar date this workout happened on." };
  }

  const day = text(draft.day);
  const originalDay = typeof original.day === "string" ? original.day : "";
  if (day !== originalDay && !dayTemplates[day]) {
    return { ok: false, session: null, field: "day", error: "Choose one of the available workout days." };
  }

  const originalExercises = Array.isArray(original.exercises) ? original.exercises : [];
  const draftExercises = Array.isArray(draft.exercises) ? draft.exercises : [];
  const exercises = [];

  for (const draftExercise of draftExercises) {
    const source = originalExercises[draftExercise?.sourceIndex];
    const base = isPlainObject(source) ? { ...source } : {};
    const name = text(draftExercise?.name).trim();
    const tracking = trackingForExercise({ ...base, name: name || text(base.name), tracking: draftExercise?.tracking });
    const draftSets = Array.isArray(draftExercise?.sets) ? draftExercise.sets : [];
    const sets = draftSets
      .map(draftSet => preparedSet(base.sets?.[draftSet?.sourceIndex], draftSet))
      .filter(set => isCompleteSet(set, tracking));
    // An exercise the user emptied out simply drops, exactly as saving a live
    // workout does. A named-but-blank exercise that still holds sets is an error
    // the user must fix rather than silently lose.
    if (!sets.length) continue;
    if (!name) {
      return { ok: false, session: null, field: `exercise-${draftExercise?.key || ""}-name`, error: "Every exercise needs a name." };
    }
    exercises.push({ ...base, name, tracking, sets });
  }

  if (!exercises.length) {
    return {
      ok: false,
      session: null,
      field: "sets",
      error: "Keep at least one complete set. Weighted sets need weight and reps; bodyweight, timed, and distance sets need their result.",
    };
  }

  // Spreading `original` first is what preserves the id, completedAt, startedAt,
  // readiness, and any field a future version stores but this form never shows.
  return {
    ok: true,
    field: null,
    error: null,
    session: { ...original, date: draft.date, day: day || originalDay, notes: text(draft.notes).trim(), exercises },
  };
}

/**
 * The single write path for a History mutation.
 *
 * Ordering is the whole point: the device is written FIRST, React state only
 * after that write is confirmed, and the cloud only ever mirrors a write that
 * already landed locally. A local write that returns anything other than a
 * confirmed success — including a thrown quota error — leaves both React state
 * and the cloud untouched, so the workout stays visible and retryable.
 */
export function commitHistoryMutation({ nextSessions, writeLocal, applyState, mirrorCloud }) {
  if (!Array.isArray(nextSessions)) {
    return { ok: false, error: new Error("A workout list is required before saving.") };
  }
  if (typeof writeLocal !== "function") {
    return { ok: false, error: new Error("No device writer was provided.") };
  }
  try {
    if (!writeLocal(nextSessions)) {
      return { ok: false, error: new Error("This device did not confirm the save.") };
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
  applyState?.(nextSessions);
  let mirrorError = null;
  try {
    mirrorCloud?.();
  } catch (error) {
    // The local write already succeeded, so a cloud mirror failure is reported
    // through the existing sync status, not by rejecting a saved change.
    mirrorError = error instanceof Error ? error : new Error(String(error));
  }
  return { ok: true, error: null, mirrorError };
}
