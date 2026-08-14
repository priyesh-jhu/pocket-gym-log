// ─── DRAFT / SESSION CONSTRUCTION ─────────────────────────────────────────────
import { dayTemplates, variantFor } from "./data/exercises.js";
import { prefFor } from "./equipmentPrefs.js";
import { todayISO } from "./dateUtils.js";
import { TRACKING_TYPES } from "./exerciseTracking.js";

const filled = s => String(s.weight ?? "").trim() !== "" || String(s.reps ?? "").trim() !== "";
export const isCompleteSet = (s,tracking=TRACKING_TYPES.WEIGHTED) => {
  const measure=String(s?.reps??"").trim();
  if(!measure||!Number.isFinite(Number(measure))||Number(measure)<=0) return false;
  if(tracking!==TRACKING_TYPES.WEIGHTED) return true;
  const weight=String(s?.weight??"").trim();
  return Boolean(weight)&&Number.isFinite(Number(weight))&&Number(weight)>=0;
};

export function emptySets() { return [{ weight:"", reps:"", unit:"lb", done:false }]; }

/** True if the user has typed any weight or reps into these sets. */
export function hasEnteredData(sets) { return (sets || []).some(filled); }

/** How many sets carry data — used in the switch-confirm message. */
export function countEnteredSets(sets) { return (sets || []).filter(filled).length; }

/** A blank draft exercise for one variant. */
export function buildDraftExercise(variant) {
  return { name:variant.name, equipment:variant.equipment, sets:emptySets() };
}

/** A fresh draft session for a day, honouring stored equipment preferences. */
export function newSession(dayKey, prefs = {}, now = new Date()) {
  return {
    id: "session_" + now.getTime(),
    date: todayISO(now),
    day: dayKey,
    startedAt: null,
    notes: "",
    exercises: dayTemplates[dayKey].exercises.map(ex =>
      buildDraftExercise(variantFor(ex, prefFor(prefs, ex.variants[0].name)))),
  };
}
