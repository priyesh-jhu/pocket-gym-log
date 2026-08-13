import { sessionVolume, toLb } from "./stats.js";

function bestSet(exercise) {
  let best = null;
  for (const set of exercise?.sets || []) {
    const weightLb = toLb(set?.weight, set?.unit);
    const reps = Number(set?.reps) || 0;
    if (weightLb <= 0) continue;
    if (!best || weightLb > best.weightLb || (weightLb === best.weightLb && reps > best.reps)) {
      best = { weightLb, reps, weight:Number(set.weight), unit:set.unit === "kg" ? "kg" : "lb" };
    }
  }
  return best;
}

function priorBest(sessions, name) {
  let best = null;
  for (const session of sessions || []) {
    const candidate = bestSet(session?.exercises?.find(ex => ex.name === name));
    if (candidate && (!best || candidate.weightLb > best.weightLb || (candidate.weightLb === best.weightLb && candidate.reps > best.reps))) best = candidate;
  }
  return best;
}

function previousExercise(sessions, name) {
  for (const session of [...(sessions || [])].sort((a,b) => String(b.date).localeCompare(String(a.date)))) {
    const exercise = session?.exercises?.find(ex => ex.name === name);
    if (exercise) return exercise;
  }
  return null;
}

function durationMinutes(startedAt, completedAt) {
  const elapsed = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (!startedAt || !Number.isFinite(elapsed) || elapsed < 0 || elapsed > 12*60*60*1000) return null;
  return Math.max(1, Math.round(elapsed/60000));
}

export function createWorkoutSummary(session, priorSessions, completedAt=new Date().toISOString()) {
  const exercises = Array.isArray(session?.exercises) ? session.exercises : [];
  const prs = [];
  const improvements = [];

  for (const exercise of exercises) {
    const current = bestSet(exercise);
    if (!current) continue;
    const allTime = priorBest(priorSessions, exercise.name);
    if (!allTime || current.weightLb > allTime.weightLb || (current.weightLb === allTime.weightLb && current.reps > allTime.reps)) {
      prs.push({ name:exercise.name, weight:current.weight, unit:current.unit, reps:current.reps });
    }
    const previous = bestSet(previousExercise(priorSessions, exercise.name));
    if (previous && current.weightLb > previous.weightLb + 0.01) {
      improvements.push({ name:exercise.name, increaseLb:Math.round((current.weightLb-previous.weightLb)*10)/10 });
    }
  }

  return {
    date:session?.date,
    day:session?.day,
    durationMinutes:durationMinutes(session?.startedAt, completedAt),
    exercises:exercises.length,
    sets:exercises.reduce((count, exercise) => count+(exercise.sets?.length || 0), 0),
    volumeLb:Math.round(sessionVolume(session)),
    prs,
    improvements,
    notes:String(session?.notes || "").trim(),
  };
}
