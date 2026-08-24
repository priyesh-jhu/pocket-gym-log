# Home Engagement Rollout 1 — Design

**Status:** Approved by user, ready for planning.

## Context

This is Rollout 1 of a multi-rollout roadmap of "gym rat" features brainstormed
for Pocket Gym Log (see chat history 2026-08-24). The full roadmap groups ~15
ideas into 7 rollouts; this spec covers only Rollout 1, the smallest/lowest-risk
batch that builds entirely on existing data (no new inputs, no schema changes
to stored sessions).

Four features, in the order they'll be planned/built:

1. PR celebration toast (post-save)
2. Weekly/monthly summary card on Home
3. Exercise-level sparkline in the exercise picker
4. "Same day-type" comparison (pre-session preview + post-save recap)

## Feature 1: PR celebration toast

**Trigger:** `saveSession()` in `App.jsx` already calls
`createWorkoutSummary(saved, sessions, completedAt)` (`src/workoutSummary.js`),
which returns `{ ..., prs: [{name, weight, unit, reps}], ... }`. When
`workoutSummary.prs.length > 0`, show a toast immediately after the summary
panel renders.

**Component:** New `src/components/Toast.jsx` + `Toast.css`.
- Non-modal, does not trap focus, does not block interaction (unlike `Sheet`).
- Props: `{ open, onClose, children }`. Auto-dismisses after 4000ms via
  `setTimeout`, cleared on unmount/re-open; also dismissable by tap.
- Visual basis: `Card` component styled `--success`-tinted (reuse
  `color-mix(in srgb, var(--success) N%, var(--surface-container-high))`
  pattern already used for calendar heatmap tints), positioned fixed near the
  top of the viewport, slide/fade in via `--dur-med`/`--ease-emph` tokens.
- Content: one line per PR entry — `🏆 {name} {weight}{unit} × {reps} — new best`.

**Wiring:** In `App.jsx`, add `toastPRs` state, set it from
`workoutSummary.prs` right after `setWorkoutSummary(...)` in `saveSession()`.
Render `<Toast open={toastPRs?.length > 0} onClose={() => setToastPRs(null)}>`
near the top of the app shell (not inside the summary panel, so it can
overlay regardless of scroll position).

**Non-goals:** No live per-set toast during the session (explicitly decided
against — recap-only, at save time).

## Feature 2: Weekly/monthly summary card (Home)

**New stats helper:** `src/stats.js` gets `monthSummary(sessions, todayIso)`,
mirroring the existing `weekSummary(sessions, todayIso)` shape:
```js
export function monthSummary(sessions, todayIso = todayISO()) {
  // returns { sessions, volume, prevVolume, deltaPct }
  // "sessions"/"volume" = current calendar month (1st through todayIso)
  // "prevVolume" = full previous calendar month
  // "deltaPct" = null if prevVolume is 0 (no baseline), else % change
}
```
Bucketing is calendar-month (`YYYY-MM` from the ISO date), not a rolling
30-day window — matches the existing Mon-Sun convention `weekSummary` uses
for weeks.

**UI:** New card on `HomeScreen.jsx`, placed after the existing hero
volume card. Local state `const [range, setRange] = useState("week")`.
Uses `SegmentedButtons` (`options=[{value:"week",label:"Week"},{value:"month",label:"Month"}]`)
to toggle. Card text: `"You trained {sessions}× this {week|month} · volume
{up|down} {abs(deltaPct)}%"` (omit the volume clause entirely when `deltaPct`
is `null`, i.e. no prior-period baseline yet).

## Feature 3: Exercise-level sparkline in the picker

**Data plumbing:** `LibraryPickerSheet` currently receives only
`{open, onClose, onSelect}`. Thread `sessions` down: `App.jsx` → `SessionScreen`
(new prop) → `LibraryPickerSheet` (new prop). `SessionScreen` already receives
enough session-scoped props that adding one more (`sessions`) is consistent
with existing patterns (e.g. `prMap`, `getLastTime`).

**Rendering:** For each exercise row in the picker list, compute
`exerciseE1RMSeries(sessions, name)` (existing `stats.js` export, oldest-first
`{date, value}` in lb). If the series has fewer than 2 points, render the row
unchanged (no sparkline — avoids a flat/meaningless single-point chart).
Otherwise render a small `recharts` `LineChart`: no `XAxis`/`YAxis`/`CartesianGrid`/
`Tooltip`, fixed small size (e.g. 60×24px), single `Line` stroke colored via
`useThemeTokens().primary` (same hook `ProgressScreen`'s `E1RMGroup` already
uses), gated by the existing `useReducedMotion()` pattern for `isAnimationActive`.

**New component:** `src/components/ExerciseSparkline.jsx` (`{ series }` props,
returns `null` if `series.length < 2`) — kept separate from
`LibraryPickerSheet.jsx` so the picker's own file doesn't grow, and so this
component is independently reusable in a later rollout if a per-exercise
history view gets built.

## Feature 4: "Same day-type" comparison

**New stats helper:** `src/stats.js` gets
`lastSameDaySummary(sessions, day, beforeDate)`:
```js
export function lastSameDaySummary(sessions, day, beforeDate) {
  // Finds the most recent prior session with session.day === day and
  // session.date < beforeDate. Returns null if none exists.
  // Otherwise returns:
  // {
  //   date,                 // ISO date of that prior session
  //   volume,               // total volume (lb) of that prior session
  //   exercises: [
  //     { name, weight, unit, reps }  // top set (heaviest) per exercise that day
  //   ],
  // }
}
```
Comparison math (current vs this prior summary) is computed at the call site
in each of the two surfaces below, not inside the helper — the helper only
fetches "what happened last time," matching the separation already used by
`workoutSummary.js` (`priorBest` fetches, caller compares).

**Surface A — pre-session preview (Home):** On `HomeScreen.jsx`, inside the
existing "Today's plan" card, add a line sourced from
`lastSameDaySummary(sessions, dayMeta.day, todayISO())`: `"Last {day} day
({date}): {volume} {unit} total"`. Renders nothing if the helper returns
`null` (first time doing this day, or no history yet).

**Surface B — post-save recap:** In the workout summary panel (`App.jsx`,
where `workout-summary__prs` already renders), add a comparison block
computed from `lastSameDaySummary(sessions, saved.day, saved.date)` (using
`sessions` from *before* the new session was appended, i.e. the same
`priorSessions` semantics `createWorkoutSummary` already uses) vs. the
just-saved session: total volume delta (`"vs last {day} day: volume {up|down}
{X}%"`) and, per exercise present in both, a weight delta line if the top set
changed (`"{name} {+/-}{delta}{unit}"`). Exercises only in one session or the
other are omitted from the per-exercise delta list (no partial/misleading
comparison).

## Testing

Per the project's "minimal tests, no dedicated TDD ceremony for pure logic"
convention: each new pure function (`monthSummary`, `lastSameDaySummary`)
gets a small set of direct unit tests in `src/stats.test.js` covering the
normal case, the no-prior-baseline/no-prior-day case, and one edge (e.g.
month boundary, or two sessions same day). New UI components (`Toast`,
`ExerciseSparkline`) get one or two smoke-level tests if the project's test
setup supports component rendering, otherwise are verified manually (this
project's tests are `node --test` on plain modules — no React Testing
Library observed in `src/**/*.test.js` so far, so UI verification will likely
be manual/visual, consistent with how `SessionScreen`/`HomeScreen` are
already tested only indirectly via their pure logic).

## Out of scope for this rollout

- Live per-set PR toast during a session (deferred/rejected).
- Any change to session/exercise data shape.
- Rollouts 2-7 (1RM/ratios/standards, RPE, volume landmarks, body tracking,
  programming, export) — separate specs when their turn comes.
