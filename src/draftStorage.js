import { dayTemplates, variantFor } from "./data/exercises.js";

export const DRAFT_PREFIX = "workout-draft:";

const key = namespace => DRAFT_PREFIX + namespace;
const validSet = set => set && typeof set === "object" && !Array.isArray(set) &&
  ["weight","reps"].every(field => typeof set[field] === "string" || typeof set[field] === "number") &&
  (set.unit === "lb" || set.unit === "kg");

export function validateDraft(value) {
  if (!value || typeof value !== "object" || !dayTemplates[value.day]) return false;
  if (typeof value.id !== "string" || typeof value.date !== "string" || typeof value.notes !== "string") return false;
  if (!Array.isArray(value.exercises) || value.exercises.length < 1 || value.exercises.length > 50) return false;
  return value.exercises.every(exercise => {
    if (!exercise || !["free","machine","custom"].includes(exercise.equipment) || typeof exercise.name !== "string" || !exercise.name.trim()) return false;
    return Array.isArray(exercise.sets) && exercise.sets.length > 0 && exercise.sets.every(validSet);
  });
}

export function draftHasContent(draft) {
  if (!validateDraft(draft)) return false;
  const plan = dayTemplates[draft.day].exercises;
  // Equipment alone is never content: newSession() honours each exercise's
  // remembered (sticky) equipment preference, so a brand-new, untouched draft
  // can already default to a "machine" variant. Only an exercise whose name
  // doesn't match what that plan slot + equipment would naturally produce is
  // a real customisation (e.g. a custom/added exercise, not a plain default).
  const customShape = draft.exercises.length !== plan.length || draft.exercises.some((exercise,index) =>
    !plan[index] || variantFor(plan[index], exercise.equipment).name !== exercise.name);
  return draft.notes.trim() !== "" || draft.exercises.some(exercise =>
    exercise.sets.length > 1 || exercise.sets.some(set =>
      String(set.weight).trim() !== "" || String(set.reps).trim() !== "" || set.done === true)) || customShape;
}

export function loadDraft(storage, namespace) {
  if (!namespace) return null;
  try {
    const raw = storage.get(key(namespace));
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved || !validateDraft(saved.draft) || typeof saved.savedAt !== "string") return null;
    return saved;
  } catch { return null; }
}

export function saveDraft(storage, namespace, draft, now = new Date()) {
  if (!namespace || !draftHasContent(draft)) return false;
  return storage.set(key(namespace), JSON.stringify({ draft, savedAt:now.toISOString() }));
}

export function clearDraft(storage, namespace) {
  return namespace ? storage.remove(key(namespace)) : false;
}
