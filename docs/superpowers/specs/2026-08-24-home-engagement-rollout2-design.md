# Home Engagement Rollout 2 — Strength-Nerd Core

**Status:** Approved by user, ready for planning.

## Context

Rollout 2 of the multi-rollout "gym rat" roadmap (see Rollout 1's spec,
`docs/superpowers/specs/2026-08-24-home-engagement-rollout1-design.md`, for
the full roadmap). This rollout covers the three "strength-nerd" ideas:
estimated 1RM tracking, big-lift ratios to bodyweight, and a strength
standards (novice/intermediate/advanced/elite) comparison.

Two things discovered during brainstorming that shrink this rollout's real
scope:

1. **1RM trending already exists.** `src/stats.js`'s `exerciseE1RMSeries` and
   `src/screens/ProgressScreen.jsx`'s `E1RMGroup` already provide a
   per-exercise estimated-1RM trend chart with a dropdown selector. This
   rollout does not rebuild that — it reuses `exerciseE1RMSeries` as the data
   source for the two genuinely new features below.
2. **Bodyweight tracking already exists.** `src/weightRecords.js` /
   `src/screens/WeightScreen.jsx` already store and normalize weigh-ins
   (`{id, date, weight, unit}`). No new data model is needed for the
   bodyweight side of the ratio/standards math.

So Rollout 2's actual deliverable is one new dashboard card: **Strength
levels**, showing the "big 3" (bench/squat/deadlift) each as current e1RM,
ratio to bodyweight, and a strength-standard tier — plus the small settings
addition (sex selection) that tier lookup needs.

## Exercise-name mapping and fallback

The exercise library names equivalent-equipment variants of the same lift
with a `/` (e.g. `"Barbell/DB Bench Press"` — barbell or dumbbell, same
lift). Genuinely distinct lifts get separate names. So the "big 3" map to
exactly one canonical exercise name each, with an ordered fallback chain for
users who've only logged a related variant:

```js
export const LIFT_VARIANTS = {
  bench:    ["Barbell/DB Bench Press", "Incline DB Press", "Chest Press Machine", "Incline Chest Press Machine"],
  squat:    ["Back Squat/Goblet Squat", "Leg Press Machine", "Bulgarian Split Squat", "Single-Leg Leg Press"],
  deadlift: ["Conventional Deadlift", "Smith Machine Deadlift", "Romanian Deadlift"],
};
```

For each lift, the first name in its chain with at least one logged
instance (`exerciseE1RMSeries(sessions, name).length > 0`) is used. If that
name isn't the chain's first (canonical) entry, the UI shows a small note:
`"(from {variant} — no {canonical} logged yet)"`. If NO name in a lift's
chain has any data, that lift is omitted from the card entirely (not shown
as a zeroed-out row).

## Strength standards data

Approximate, publicly-common bodyweight-ratio thresholds per lift, split by
sex (a user setting, not inferred), one-rep-max basis:

```js
export const STANDARDS = {
  male: {
    bench:    { novice: 0.5,  intermediate: 0.75, advanced: 1.25, elite: 1.75 },
    squat:    { novice: 0.75, intermediate: 1.25, advanced: 1.75, elite: 2.5  },
    deadlift: { novice: 1.0,  intermediate: 1.5,  advanced: 2.0,  elite: 2.75 },
  },
  female: {
    bench:    { novice: 0.25, intermediate: 0.5,  advanced: 0.75, elite: 1.0  },
    squat:    { novice: 0.5,  intermediate: 0.75, advanced: 1.25, elite: 1.75 },
    deadlift: { novice: 0.75, intermediate: 1.0,  advanced: 1.5,  elite: 2.0  },
  },
};
```

A ratio is compared against ascending thresholds to pick the highest tier
met (below `novice` → no tier / `null`, meaning "building toward novice").
These are rough approximations, not a medical or competition-federation
standard — the card copy will note this.

## New file: `src/strengthStandards.js`

Pure functions, following the same style as `src/userFeatures.js` and
`src/weightRecords.js` (no side effects, no storage access):

- `getStandardsSex(prefs)` → `"male" | "female" | null` — reads a new key
  (e.g. `prefs.__standardsSex`) off the same `equipmentPrefs` blob that
  already stores goals/increments/rest-timer-default via `saveAccountPrefs`.
  `null` until the user sets it.
- `setStandardsSex(prefs, sex)` → returns updated prefs (mirrors the
  `addGoal`/`removeGoal` pattern of returning a new prefs object).
- `bigLiftSummary(sessions, bodyweightLb, sex)` → array of up to 3 entries
  (only for lifts with data), each:
  ```js
  { lift: "bench"|"squat"|"deadlift", exerciseName, isFallback: boolean,
    e1rmLb: number, ratio: number, tier: "novice"|"intermediate"|"advanced"|"elite"|null }
  ```
  `e1rmLb` is the LATEST point of `exerciseE1RMSeries(sessions, exerciseName)`
  (oldest-first array — `.at(-1)`), representing "current," not all-time
  peak. `ratio = e1rmLb / bodyweightLb`. `tier` is `null` whenever `sex` is
  `null` (not yet configured) or the ratio is below the lowest threshold.

## UI: "Strength levels" dashboard card

A 5th toggleable group on the existing Progress dashboard
(`src/screens/ProgressScreen.jsx` + `src/progressDashboardSettings.js`),
alongside `e1rm`/`trend`/`heatmap`/`balance` — not a new Home card, since
Home was just decluttered in Rollout 1. This reuses the dashboard's existing
show/hide/reorder system for free: `progressDashboardSettings.js`'s
`normalizeDashboardSettings` already auto-appends any `PROGRESS_GROUP_IDS`
entry missing from a stored `cardOrder`, so existing users get the new card
appended at the end of their dashboard with no migration needed.

Add `"strength"` to `PROGRESS_GROUP_IDS` and
`PROGRESS_GROUP_LABELS.strength = "Strength levels"`.

New `StrengthGroup({ sessions, bodyweights })` component (co-located in
`ProgressScreen.jsx` alongside its sibling groups — `E1RMGroup`,
`DailyTrendGroup`, etc. — following that file's existing pattern of small
local components rather than one file per group). It:
- Derives `bodyweightLb` from the latest entry in
  `normalizeBodyweights(bodyweights)` (sorted by `date`, most recent last),
  converted to lb via `src/stats.js`'s existing exported `toLb(weight, unit)`
  (same conversion factor `weightRecords.js` uses internally, but that
  file's own `toLb` is private — use the already-exported one from
  `stats.js` instead of duplicating it).
  If there's no bodyweight entry at all, the card shows a single line:
  "Log your weight to see strength levels" (no ratios/tiers computed).
- Reads `getStandardsSex(equipmentPrefs)` (passed down like other
  prefs-derived values already are into `ProgressScreen`).
- Calls `bigLiftSummary(sessions, bodyweightLb, sex)` and renders one row
  per returned entry: lift name, `e1rmLb` (in the user's dominant display
  unit — reuse `dominantUnit`/lb↔kg conversion already used elsewhere in
  this file), ratio (e.g. "1.8× bodyweight"), and a tier `Chip` (or a
  "Set your sex in Settings to see your tier" prompt in place of the chip
  when `sex` is `null`).
- If `bigLiftSummary` returns an empty array (bodyweight exists, but zero
  data for all 3 lifts across all their fallback chains), shows: "Log a
  bench, squat, or deadlift set to see your strength levels."

## Settings addition

One new row in `src/screens/SettingsScreen.jsx`, likely near the existing
"Progression increments"/"Rest timer" cards: a small `Card` titled
"Strength standards" with a `SegmentedButtons` (`Male` / `Female`) wired to
`setStandardsSex`/`saveAccountPrefs`, and one line of copy: "Used to show
your strength tier (novice → elite) on the Progress dashboard. These are
rough public averages, not a medical or competition standard."

## Testing

Per this project's minimal-tests convention: a small number of direct unit
tests in a new `src/strengthStandards.test.js` — one for the fallback-chain
selection (an exercise with only a fallback variant logged, not the
canonical name, is picked and flagged `isFallback: true`), one for tier
lookup at a boundary ratio, one for the "no sex set → tier null" case, and
one for the "no data for any lift → empty array" case. No exhaustive
matrix across every lift/sex/tier combination.

## Out of scope for this rollout

- Any change to how bodyweight or e1RM data is stored (both already exist).
- A dedicated per-exercise history page (still deferred from Rollout 1).
- Rollouts 3-7 (RPE, volume landmarks, body/recovery tracking, programming,
  export) — separate specs when their turn comes.
