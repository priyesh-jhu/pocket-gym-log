export const TRACKING_TYPES={WEIGHTED:"weighted",BODYWEIGHT:"bodyweight",TIMED:"timed",DISTANCE:"distance"};

const BODYWEIGHT_EXERCISES=new Set([
  "Pull-ups/Lat Pulldown","Tricep Dips/Skull Crushers","Bulgarian Split Squat",
  "Glute Bridge/Hip Thrust","Standing Calf Raises","Hanging Leg Raises",
  "Captain's Chair Leg Raise","Ab Wheel/Dead Bug","Weighted Sit-ups/Bicycle Crunches",
  "Back Extensions/Good Mornings",
]);

export function trackingForExercise(exercise) {
  if(["weighted","bodyweight","timed","distance"].includes(exercise?.tracking)) return exercise.tracking;
  if(exercise?.name==="Plank w/ Shoulder Taps") return TRACKING_TYPES.TIMED;
  if(exercise?.name==="Farmer's Carries") return TRACKING_TYPES.DISTANCE;
  if(BODYWEIGHT_EXERCISES.has(exercise?.name)) return TRACKING_TYPES.BODYWEIGHT;
  const target=String(exercise?.target||"").toLowerCase();
  if(/\b(sec|second|minute|min)\b/.test(target)) return TRACKING_TYPES.TIMED;
  if(/\b(meters?|metres?|yards?|miles?|km)\b/.test(target)) return TRACKING_TYPES.DISTANCE;
  return TRACKING_TYPES.WEIGHTED;
}

export function trackingLabels(type) {
  if(type===TRACKING_TYPES.TIMED) return {weight:"Added weight",measure:"Seconds",help:"Enter the hold duration; added weight is optional."};
  if(type===TRACKING_TYPES.DISTANCE) return {weight:"Carried weight",measure:"Distance",help:"Enter distance; carried weight is optional."};
  if(type===TRACKING_TYPES.BODYWEIGHT) return {weight:"Added weight",measure:"Reps",help:"Enter reps; added weight is optional."};
  return {weight:"Weight",measure:"Reps",help:"Enter both weight and reps."};
}
