# Home Engagement Rollout 3 — RPE Logging + Grinding Insight

**Status:** Approved by user, ready for planning.

## Context

Rollout 3 of the multi-rollout "gym rat" roadmap (see Rollout 1's spec for
the full roadmap). Unlike Rollouts 1-2, this rollout introduces a genuinely
new per-set input — RPE (Rate of Perceived Exertion) — rather than only new
views over existing data. It touches the live session-logging flow, the set
data shape, History's read/edit paths, and adds one new "grinding too much"
insight.

Decisions made during brainstorming:
- **RPE, not RIR.** Whole-number scale, 6-10 (not the half-point 6-10 scale
  some lifters use) — 5 options, simple enough for a per-set control.
- **Required going forward, not retroactively.** A set can't be marked done
  in a live session without RPE. Historical sets that predate this feature
  are never invalidated or forced to backfill it.
- **"Grinding too much" only** (not "leaving reps in the tank" — deferred,
  not in scope for this rollout), and it gets its **own** insight surface,
  not merged into the existing `trainingInsights.js` plateau/deload signal.

## Data model

The set object gains one new optional key, uniform across all tracking
types (weighted/bodyweight/timed/distance) — consistent with how `weight`
is already optional-per-type on the same object:

```js
{ weight: "", reps: "", unit: "lb", done: false, rpe: null }
```

`rpe` is `null` until set (a freshly created set via `emptySets()` in
`src/draft.js` gets `rpe: null`), otherwise an integer 6-10. No changes to
`isCompleteSet` (`src/draft.js`) — it continues to validate only
weight/reps, exactly as today. `src/backup.js` already round-trips unknown
set fields with no whitelist, so export/import needs zero changes.

## "Required" enforcement point

RPE is required to complete a set, but the requirement is enforced at the
**done-toggle**, not at `isCompleteSet`/save time. In
`src/screens/SessionScreen.jsx`, the existing "mark set done" toggle button
(`toggleSetDone(ei, si)`) becomes disabled whenever `!set.rpe` (no RPE
6-10 selected yet). This means:

- Going forward, a user physically cannot check off a set as done without
  rating it first.
- Saving a session is unaffected — `cleanSession`/`isCompleteSet` in
  `src/App.jsx`/`src/draft.js` keep validating only weight/reps, so a
  session with some unrated (not-yet-done, or historically-imported) sets
  still saves normally.
- Editing a historical set in History (`src/historyRecords.js`,
  `src/screens/HistoryScreen.jsx`) is **never** gated on RPE — the edit
  sheet's RPE control is optional there. This is a deliberate asymmetry:
  forcing retroactive RPE entry on old data to edit an unrelated field
  (e.g. fixing a weight typo) would be bad UX, so the requirement only
  applies to the live logging flow where it can't be bypassed.

## UI

A shared constant, `RPE_OPTIONS = [6, 7, 8, 9, 10]`, defined once (in
`src/draft.js`, alongside the other set-shape helpers) and imported by both
`SessionScreen.jsx` and `HistoryScreen.jsx` so the two controls stay in
sync.

**Session logging (`SessionScreen.jsx`):** a small `<select>` — mirroring
the existing readiness check-in's `<select>` pattern (`src/userFeatures.js`
readiness fields), not `SegmentedButtons` (too wide for the already
6-element `.set-row`) — added to the set row right after the reps input,
before the remove button. Blank/placeholder option first (no RPE selected
yet), then 6-10. Selecting a value calls the existing generic
`updateSet(ei, si, "rpe", value)` handler (no new handler needed — it's
already field-name-agnostic). The done-toggle button gets `disabled={!set.rpe}`
and a `title="Rate this set (6-10) before marking it done"` when disabled.

**History edit sheet (`HistoryScreen.jsx`):** the same `RPE_OPTIONS`
`<select>`, added to the existing per-set edit row, wired the same way
History already handles other fields (`updateDraftSet` or equivalent
existing local handler — no new gating, no required behavior).

**History read view (`historyRecords.js`):** `normalizeSet(set, tracking)`
starts also returning `rpe: numberOrNull(set.rpe)`, and `setDisplay(set,
tracking)` appends `" · RPE {n}"` when present (omitted entirely when
`rpe` is null, so old sets display exactly as they do today).

## "Grinding too much" insight

New file `src/rpeInsights.js`, mirroring `trainingInsights.js`'s shape and
windowing convention (same "3 in a row" pattern already established for the
plateau/deload signal), but a separate function, separate file, separate
insight type:

```js
/**
 * Flags an exercise whose last 3 logged sessions (sessions containing at
 * least one set with a recorded RPE for that exercise) all averaged RPE 9
 * or higher — signaling sustained near-failure training that may call for
 * a lighter week.
 */
export function grindingInsights(sessions, limit = 5) {
  // returns [{ type: "grinding", name, date, evidence: [{date, avgRpe}],
  //            action, message }], newest-first, capped at `limit`
}
```

`evidence` mirrors `trainingInsights.js`'s shape (`[{date, ...}]` for the
same 3 sessions), `action` is a short suggested next step (e.g. "Reduce
load ~10% or add a rest day"), `message` is the user-facing sentence (e.g.
"You've rated the last 3 sessions of {name} at RPE 9+. Consider a lighter
week or backing off load a bit.").

## Home screen surface

A new card on `HomeScreen.jsx`, rendered only when `grindingInsights(sessions,
1)` returns a result (same "absent when empty" pattern already used for the
existing Training insight card) — placed near, but visually distinct from,
that existing card (its own `Card`, its own heading, not merged into the
same block).

## Testing

Per this project's minimal-tests convention: a small number of direct unit
tests — one or two for the done-toggle's disabled-without-RPE behavior
(if reachable via existing pure-function tests; otherwise verified
manually, consistent with how other SessionScreen-only UI behavior in this
project is verified), one or two for `normalizeSet`/`setDisplay` now
surfacing RPE, and 2-3 for `grindingInsights` (the "3 in a row at 9+"
positive case, a case where only 2 of 3 qualify — no flag, and the "no RPE
data at all" case). No exhaustive matrix.

## Out of scope for this rollout

- RIR as an alternative scale, or a user-configurable scale choice.
- "Leaving reps in the tank" (low-RPE) insight — deferred.
- Any change to `isCompleteSet`/session-save validation.
- Backfilling RPE onto historical sets in bulk.
- Rollouts 4-7 (volume landmarks, body/recovery tracking, programming,
  export) — separate specs when their turn comes.
