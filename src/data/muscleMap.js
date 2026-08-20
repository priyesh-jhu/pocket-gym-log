// src/data/muscleMap.js

/** free-exercise-db muscle name -> this app's MUSCLES keys (formGuide.js). */
export const LIBRARY_MUSCLE_MAP = {
  abdominals: ["abs"],
  abductors: ["glutes"], // closest region in this app's taxonomy — no dedicated abductor zone
  adductors: ["adductors"],
  biceps: ["biceps"],
  calves: ["calves"],
  chest: ["chest"],
  forearms: ["forearms"],
  glutes: ["glutes"],
  hamstrings: ["hamstrings"],
  lats: ["lats"],
  "lower back": ["lowerBack"],
  "middle back": ["midBack"],
  quadriceps: ["quads"],
  shoulders: ["frontDelts", "sideDelts", "rearDelts"],
  traps: ["traps"],
  triceps: ["triceps"],
  // "neck" intentionally omitted — no equivalent region in this app's body map.
};

export function mapMuscles(names) {
  const out = new Set();
  for (const name of names || []) {
    for (const key of LIBRARY_MUSCLE_MAP[name] || []) out.add(key);
  }
  return [...out];
}

export const BACK_ONLY_MUSCLES = new Set(["traps", "rearDelts", "midBack", "lats", "lowerBack", "glutes", "hamstrings"]);
export const BOTH_VIEW_MUSCLES = new Set(["triceps", "forearms", "calves"]);

export function viewForMuscles(muscleKeys) {
  return (muscleKeys || []).some(key => BACK_ONLY_MUSCLES.has(key)) ? "back" : "front";
}
