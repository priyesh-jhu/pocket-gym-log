# Home Engagement Rollout 4 — Volume & Recovery Awareness

**Status:** Approved by user, ready for planning.

## Context

Rollout 4 of the multi-rollout "gym rat" roadmap (see Rollout 1's spec for
the full roadmap). The original idea list for this rollout was volume-vs-
MEV/MAV/MRV landmarks, "days since last trained" on Home, and deload week
detection. Investigation found the first two are largely already built:

- The Progress dashboard's "Body heatmap" card already tracks weekly
  set-volume against a per-muscle target (`musclePriorities` in
  `src/stats.js`, adjustable via the dashboard's Customize sheet) and
  already computes `daysSince` last trained per muscle — it just isn't
  surfaced on Home.
- A true three-tier MEV/MAV/MRV model (minimum/maximum-adaptive/maximum-
  recoverable volume, one of three landmarks per muscle instead of one
  target) was considered and explicitly rejected: it adds real setup
  cognitive overhead (three numbers per muscle instead of one) for a
  personal single-user app, and the existing single-target model already
  answers the practical "am I doing enough/too much" question.

So this rollout's real scope is two smaller pieces: surfacing "days since
last trained" on Home (reusing existing data), and adding genuine deload
detection (the one true gap — `trainingInsights.js` only flags per-exercise
stalls/declines, nothing about overall program-wide volume trending up for
weeks without a break).

**Explicit visual constraint from the user:** new features must not disrupt
the app's existing sleek look. Both pieces below are designed specifically
to extend patterns that already exist rather than introduce new ones.

## "Overdue muscles" on Home

No new stats function — `musclePriorities` (`src/stats.js`, already used
by the Progress dashboard) already returns, per muscle,
`{muscle, done, target, remaining, pct, lastTrained, daysSince}`, sorted by
most-overdue-first. `HomeScreen.jsx`'s existing "Muscle freshness" section
(the heatmap button block, currently just the SVG + header) gains one new
line beneath the heatmap: the top 2 entries with `daysSince >= 4` (matching
the freshness heatmap's own existing recovery-curve threshold, where 4+
days is treated as meaningfully fresher — see `muscleFreshness` in
`src/stats.js`), rendered as two `Chip` components (the same component
already used for the streak badge and week-delta pill elsewhere on Home):
`Overdue: {label} ({daysSince}d)` per chip. The row renders only when at
least 2 muscles qualify (`daysSince >= 4`); if fewer than 2 qualify, the
row is omitted entirely (no single-chip line) — absent-by-default, matching
every other optional element already on this screen.

`musclePriorities` needs a `setVolume`/`targets`/`plannedDays` input
already computed elsewhere (`muscleSetVolume`, dashboard settings) —
`HomeScreen.jsx` will need to compute a simple default (not the
user's dashboard-customized per-muscle targets, which live in Progress
dashboard preferences Home doesn't currently read) using the same default
target math already used when dashboard settings have never been
customized. This keeps Home decoupled from Progress-dashboard-specific
preference plumbing — Home's "overdue" list is a simpler, unconfigured
view of the same underlying `daysSince` data, not a mirror of the
dashboard's fully customized targets.

## Deload reminder (new insight card)

New file `src/deloadInsight.js` (own file, same reasoning as
`rpeInsights.js` getting its own file rather than folding into
`trainingInsights.js` — this operates on whole-program weekly volume, a
different aggregation than `trainingInsights.js`'s per-exercise session
history):

```js
/**
 * Flags a sustained volume ramp with no lighter week: the last 4 FULLY
 * COMPLETED weeks (the current in-progress week is excluded) each had
 * volume greater than or equal to the previous week, with no week at
 * least 15% lighter than the one before it (no "down week") anywhere in
 * that span.
 */
export function deloadReminder(sessions, todayIso) {
  // returns null, or { type: "deload-week", weeks: [{weekStart, volume}],
  //   action, message }
}
```

Uses the existing `weeklyVolume(sessions, weeks, todayIso)` helper
(`src/stats.js`) to get zero-filled weekly buckets, drops the current
(possibly partial) week, and checks the 4 weeks before it. Message: "Volume's
climbed for 4 weeks straight with no lighter week. Consider a deload week."
Action: "Take one week at ~40-50% less volume."

Surfaces on `HomeScreen.jsx` as a third insight card, styled identically to
the existing "Training insight" and "Effort check" cards (same `.home-insight`
CSS class, same `Card` component, same absent-when-null rendering) —
deliberately not a new visual pattern, per the visual-consistency
requirement.

## Testing

Per this project's minimal-tests convention: 3-4 direct unit tests for
`deloadReminder` (the qualifying 4-weeks-ramping case, a case with a down
week that clears the flag, a case with fewer than 4 weeks of history, and
a flat/declining case), and 1-2 for whatever small `musclePriorities`-based
selection helper Home ends up using for its overdue-chip logic (exact
shape finalized in planning).

## Out of scope for this rollout

- Full MEV/MAV/MRV three-tier landmark model (explicitly rejected).
- Any change to the Progress dashboard's existing Body heatmap card,
  targets, or Customize settings.
- Rollouts 5-7 (body/recovery tracking, programming, export) — separate
  specs when their turn comes.
