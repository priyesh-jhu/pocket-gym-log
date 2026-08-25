import { exerciseForVariantName, variantFor } from "./data/exercises.js";

export const CUSTOM_EXERCISES_KEY = "__customExercises";
export const WORKOUT_TEMPLATES_KEY = "__workoutTemplates";

const text = (value, max=80) => String(value || "").trim().slice(0,max);

export function getCustomExercises(prefs) {
  const raw = prefs?.[CUSTOM_EXERCISES_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter(item => item && text(item.name)).map(item => {
    const base = {
      id:text(item.id) || `custom-${text(item.name).toLowerCase().replace(/[^a-z0-9]+/g,"-")}`,
      name:text(item.name), target:text(item.target) || "3 x 8-12", tip:text(item.tip,160),
    };
    if (item.libraryId) {
      base.libraryId = text(item.libraryId, 60);
      base.primaryMuscles = Array.isArray(item.primaryMuscles) ? item.primaryMuscles.filter(m => text(m)).slice(0,6) : [];
      base.secondaryMuscles = Array.isArray(item.secondaryMuscles) ? item.secondaryMuscles.filter(m => text(m)).slice(0,6) : [];
    }
    return base;
  });
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

export function createCustomExerciseFromLibrary(prefs, libraryEntry, now=Date.now()) {
  const name = text(libraryEntry?.name);
  if (!name) return { ok:false, error:"Choose an exercise from the library.", prefs:{...(prefs||{})} };
  const existing = getCustomExercises(prefs);
  const match = existing.find(item => item.name.toLowerCase() === name.toLowerCase());
  if (match) {
    if (match.libraryId === text(libraryEntry.id, 60)) return { ok:true, exercise:match, prefs:{...(prefs||{})} };
    return { ok:false, error:"An exercise with that name already exists.", prefs:{...(prefs||{})} };
  }
  if (exerciseForVariantName(name)) {
    return { ok:false, error:"An exercise with that name already exists.", prefs:{...(prefs||{})} };
  }
  const exercise = {
    id:`custom-${now}`, name, target:"3 x 8-12", tip:"",
    libraryId:text(libraryEntry.id, 60),
    primaryMuscles:Array.isArray(libraryEntry.primaryMuscles) ? libraryEntry.primaryMuscles.slice(0,6) : [],
    secondaryMuscles:Array.isArray(libraryEntry.secondaryMuscles) ? libraryEntry.secondaryMuscles.slice(0,6) : [],
  };
  return { ok:true, exercise, prefs:{...(prefs||{}),[CUSTOM_EXERCISES_KEY]:[...existing,exercise]} };
}

export function addExerciseToDraft(draft, exercise) {
  if (!draft || !exercise?.name) return draft;
  const entry = { name:exercise.name, equipment:"custom", target:exercise.target||"3 x 8-12", tip:exercise.tip||"", sets:[{weight:"",reps:"",unit:"lb",done:false,rpe:null}] };
  if (exercise.libraryId) {
    entry.libraryId = exercise.libraryId;
    entry.primaryMuscles = exercise.primaryMuscles || [];
    entry.secondaryMuscles = exercise.secondaryMuscles || [];
  }
  return { ...draft, exercises:[...(draft.exercises||[]), entry] };
}

export function getWorkoutTemplates(prefs) {
  const raw = prefs?.[WORKOUT_TEMPLATES_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter(item => item && text(item.name) && Array.isArray(item.exercises) && item.exercises.length>0)
    .map(item => ({ id:text(item.id), name:text(item.name), day:text(item.day), restSeconds:[60,90,120].includes(item.restSeconds)?item.restSeconds:90, exercises:item.exercises.filter(ex=>ex&&text(ex.name)).map(ex=>({name:text(ex.name),equipment:["free","machine","custom"].includes(ex.equipment)?ex.equipment:"custom",target:text(ex.target)||"3 x 8-12",tip:text(ex.tip,160),setCount:Math.max(1,Math.min(10,Number(ex.setCount)||1))})) }));
}

export function saveWorkoutTemplate(prefs, name, draft, nowOrDefaults=Date.now(), defaults={}) {
  const now=typeof nowOrDefaults==="number"?nowOrDefaults:Date.now();
  if(nowOrDefaults&&typeof nowOrDefaults==="object") defaults=nowOrDefaults;
  const cleanName = text(name);
  if (!cleanName) return { ok:false, error:"Enter a template name.", prefs:{...(prefs||{})} };
  const exercises = (draft?.exercises||[]).map(ex => {
    const family = exerciseForVariantName(ex.name);
    const variant = family ? variantFor(family, ex.equipment) : null;
    return { name:ex.name, equipment:ex.equipment, target:ex.target||variant?.target||"3 x 8-12", tip:ex.tip||variant?.tip||"", setCount:Math.max(1,Math.min(10,ex.sets?.length||1)) };
  });
  if (!exercises.length) return { ok:false, error:"Add at least one exercise first.", prefs:{...(prefs||{})} };
  const existing = getWorkoutTemplates(prefs).filter(item => item.name.toLowerCase() !== cleanName.toLowerCase());
  const template = { id:`template-${now}`, name:cleanName, day:draft?.day||"", restSeconds:[60,90,120].includes(defaults.restSeconds)?defaults.restSeconds:90, exercises };
  return { ok:true, template, prefs:{...(prefs||{}),[WORKOUT_TEMPLATES_KEY]:[...existing,template]} };
}

export function applyWorkoutTemplate(draft, template) {
  if (!draft || !template?.exercises?.length) return draft;
  return { ...draft, day:template.day||draft.day, startedAt:null, notes:"", exercises:template.exercises.map(ex=>({ ...ex, sets:Array.from({length:ex.setCount||1},()=>({weight:"",reps:"",unit:"lb",done:false,rpe:null})) })) };
}
