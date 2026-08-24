// ─── STRENGTH STANDARDS ────────────────────────────────────────────────────────
// Pure helpers behind the Progress dashboard's "Strength levels" card. The
// exercise library names equivalent-equipment variants of the same lift with
// a "/" (e.g. "Barbell/DB Bench Press"); genuinely distinct lifts get their
// own name. LIFT_VARIANTS lists each big lift's canonical name first, then
// fallback variants to use when the canonical name has no logged data yet.
import { exerciseE1RMSeries } from "./stats.js";

export const LIFT_VARIANTS = {
  bench: ["Barbell/DB Bench Press", "Incline DB Press", "Chest Press Machine", "Incline Chest Press Machine"],
  squat: ["Back Squat/Goblet Squat", "Leg Press Machine", "Bulgarian Split Squat", "Single-Leg Leg Press"],
  deadlift: ["Conventional Deadlift", "Smith Machine Deadlift", "Romanian Deadlift"],
};

/** Approximate, publicly-common bodyweight-ratio thresholds per lift and sex. */
export const STANDARDS = {
  male: {
    bench: { novice: 0.5, intermediate: 0.75, advanced: 1.25, elite: 1.75 },
    squat: { novice: 0.75, intermediate: 1.25, advanced: 1.75, elite: 2.5 },
    deadlift: { novice: 1.0, intermediate: 1.5, advanced: 2.0, elite: 2.75 },
  },
  female: {
    bench: { novice: 0.25, intermediate: 0.5, advanced: 0.75, elite: 1.0 },
    squat: { novice: 0.5, intermediate: 0.75, advanced: 1.25, elite: 1.75 },
    deadlift: { novice: 0.75, intermediate: 1.0, advanced: 1.5, elite: 2.0 },
  },
};

const STANDARDS_SEX_KEY = "__standardsSex";

/** null until the user has chosen a standards table in Settings. */
export function getStandardsSex(prefs) {
  const value = prefs?.[STANDARDS_SEX_KEY];
  return value === "male" || value === "female" ? value : null;
}

/** Returns updated prefs; any non-"female" input normalizes to "male". */
export function setStandardsSex(prefs, sex) {
  return { ...(prefs || {}), [STANDARDS_SEX_KEY]: sex === "female" ? "female" : "male" };
}

function tierFor(ratio, thresholds) {
  if (!thresholds) return null;
  if (ratio >= thresholds.elite) return "elite";
  if (ratio >= thresholds.advanced) return "advanced";
  if (ratio >= thresholds.intermediate) return "intermediate";
  if (ratio >= thresholds.novice) return "novice";
  return null;
}

/**
 * Current strength summary for the big 3 lifts. Each lift uses the latest
 * point of exerciseE1RMSeries for the first name in its fallback chain that
 * has any logged data; lifts with zero data across their whole chain are
 * omitted entirely (never shown as a zeroed-out row).
 */
export function bigLiftSummary(sessions, bodyweightLb, sex) {
  if (!bodyweightLb || bodyweightLb <= 0) return [];
  const results = [];
  for (const lift of Object.keys(LIFT_VARIANTS)) {
    const chain = LIFT_VARIANTS[lift];
    let match = null;
    for (const name of chain) {
      const series = exerciseE1RMSeries(sessions, name);
      if (series.length > 0) { match = { name, series }; break; }
    }
    if (!match) continue;
    const e1rmLb = match.series.at(-1).value;
    const ratio = Math.round((e1rmLb / bodyweightLb) * 100) / 100;
    const thresholds = sex ? STANDARDS[sex]?.[lift] : null;
    results.push({ lift, exerciseName: match.name, isFallback: match.name !== chain[0], e1rmLb, ratio, tier: tierFor(ratio, thresholds) });
  }
  return results;
}
