export const DEFAULT_INCREMENTS = { lb:5, kg:2.5 };
export const PROGRESSION_PREF_KEY = "__progressionIncrements";

function validIncrement(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0.25 && number <= 100 ? number : fallback;
}

export function getProgressionIncrements(prefs) {
  const stored = prefs?.[PROGRESSION_PREF_KEY];
  return {
    lb:validIncrement(stored?.lb, DEFAULT_INCREMENTS.lb),
    kg:validIncrement(stored?.kg, DEFAULT_INCREMENTS.kg),
  };
}

export function setProgressionIncrement(prefs, unit, value) {
  if (unit !== "lb" && unit !== "kg") return { ...(prefs || {}) };
  const current = getProgressionIncrements(prefs);
  return { ...(prefs || {}), [PROGRESSION_PREF_KEY]:{ ...current, [unit]:validIncrement(value, current[unit]) } };
}

export function parseRepTarget(target) {
  if (typeof target !== "string" || /\b(?:sec(?:ond)?s?|met(?:er|re)s?)\b/i.test(target)) return null;
  const match = target.match(/(\d+)\s*x\s*(\d+)(?:\s*-\s*(\d+))?/i);
  if (!match) return null;
  const minReps = Number(match[2]);
  return { sets:Number(match[1]), minReps, maxReps:Number(match[3] || minReps) };
}

function workingGroup(sets) {
  const groups = new Map();
  for (const set of sets || []) {
    const weight = Number(set.weight);
    const reps = Number(set.reps);
    const unit = set.unit === "kg" ? "kg" : "lb";
    if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(reps) || reps <= 0) continue;
    const key = `${unit}:${weight}`;
    const group = groups.get(key) || { weight, unit, reps:[] };
    group.reps.push(reps);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a,b) => b.reps.length-a.reps.length || b.weight-a.weight)[0] || null;
}

function formatWeight(weight) {
  return Number.isInteger(weight) ? String(weight) : String(Number(weight.toFixed(2)));
}

export function getProgressionRecommendation(sets, target, increments=DEFAULT_INCREMENTS) {
  const goal = parseRepTarget(target);
  const work = workingGroup(sets);
  if (!goal || !work) return null;

  const enoughSets = work.reps.length >= goal.sets;
  const increment = validIncrement(increments?.[work.unit], DEFAULT_INCREMENTS[work.unit]);
  if (enoughSets && work.reps.every(reps => reps >= goal.maxReps)) {
    const next = work.weight + increment;
    return {
      action:"increase",
      label:"Increase next time",
      message:`Try ${formatWeight(next)} ${work.unit}; you reached ${goal.maxReps}+ reps across all ${goal.sets} working sets.`,
    };
  }

  if (enoughSets && work.reps.every(reps => reps < goal.minReps)) {
    const next = Math.max(increment, work.weight - increment);
    return {
      action:"reduce",
      label:"Reduce slightly",
      message:`Try ${formatWeight(next)} ${work.unit} and rebuild to at least ${goal.minReps} reps per set.`,
    };
  }

  return {
    action:"hold",
    label:"Repeat this weight",
    message:`Stay at ${formatWeight(work.weight)} ${work.unit} until all ${goal.sets} sets reach ${goal.maxReps} reps.`,
  };
}
