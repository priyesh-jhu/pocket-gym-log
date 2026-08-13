import { exerciseForVariantName, variantFor } from "./data/exercises.js";

export const CUSTOM_EXERCISES_KEY = "__customExercises";
export const WORKOUT_TEMPLATES_KEY = "__workoutTemplates";

const text = (value, max=80) => String(value || "").trim().slice(0,max);

export function getCustomExercises(prefs) {
  const raw = prefs?.[CUSTOM_EXERCISES_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter(item => item && text(item.name)).map(item => ({
    id:text(item.id) || `custom-${text(item.name).toLowerCase().replace(/[^a-z0-9]+/g,"-")}`,
    name:text(item.name), target:text(item.target) || "3 x 8-12", tip:text(item.tip,160),
  }));
}

export function createCustomExercise(prefs, values, now=Date.now()) {
  const name = text(values?.name);
  if (!name) return { ok:false, error:"Enter an exercise name.", prefs:{...(prefs||{})} };
  const existing = getCustomExercises(prefs);
  if (existing.some(item => item.name.toLowerCase() === name.toLowerCase()) || exerciseForVariantName(name)) {
    return { ok:false, error:"An exercise with that name already exists.", prefs:{...(prefs||{})} };
  }
  const exercise = { id:`custom-${now}`, name, target:text(values?.target) || "3 x 8-12", tip:text(values?.tip,160) };
  return { ok:true, exercise, prefs:{...(prefs||{}),[CUSTOM_EXERCISES_KEY]:[...existing,exercise]} };
}

export function addExerciseToDraft(draft, exercise) {
  if (!draft || !exercise?.name) return draft;
  return { ...draft, exercises:[...(draft.exercises||[]), { name:exercise.name, equipment:"custom", target:exercise.target||"3 x 8-12", tip:exercise.tip||"", sets:[{weight:"",reps:"",unit:"lb",done:false}] }] };
}

export function getWorkoutTemplates(prefs) {
  const raw = prefs?.[WORKOUT_TEMPLATES_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter(item => item && text(item.name) && Array.isArray(item.exercises) && item.exercises.length>0)
    .map(item => ({ id:text(item.id), name:text(item.name), exercises:item.exercises.filter(ex=>ex&&text(ex.name)).map(ex=>({name:text(ex.name),equipment:["free","machine","custom"].includes(ex.equipment)?ex.equipment:"custom",target:text(ex.target)||"3 x 8-12",tip:text(ex.tip,160)})) }));
}

export function saveWorkoutTemplate(prefs, name, draft, now=Date.now()) {
  const cleanName = text(name);
  if (!cleanName) return { ok:false, error:"Enter a template name.", prefs:{...(prefs||{})} };
  const exercises = (draft?.exercises||[]).map(ex => {
    const family = exerciseForVariantName(ex.name);
    const variant = family ? variantFor(family, ex.equipment) : null;
    return { name:ex.name, equipment:ex.equipment, target:ex.target||variant?.target||"3 x 8-12", tip:ex.tip||variant?.tip||"" };
  });
  if (!exercises.length) return { ok:false, error:"Add at least one exercise first.", prefs:{...(prefs||{})} };
  const existing = getWorkoutTemplates(prefs).filter(item => item.name.toLowerCase() !== cleanName.toLowerCase());
  const template = { id:`template-${now}`, name:cleanName, exercises };
  return { ok:true, template, prefs:{...(prefs||{}),[WORKOUT_TEMPLATES_KEY]:[...existing,template]} };
}

export function applyWorkoutTemplate(draft, template) {
  if (!draft || !template?.exercises?.length) return draft;
  return { ...draft, startedAt:null, notes:"", exercises:template.exercises.map(ex=>({ ...ex, sets:[{weight:"",reps:"",unit:"lb",done:false}] })) };
}
