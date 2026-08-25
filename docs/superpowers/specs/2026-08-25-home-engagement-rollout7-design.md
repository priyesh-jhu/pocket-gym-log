# Home Engagement Rollout 7 — Sharing & Export

**Status:** Approved by user, ready for planning.

## Context

Rollout 7 of the multi-rollout "gym rat" roadmap (see Rollout 1's spec for
the full roadmap). Rollouts 5 and 6 are currently skipped/deferred. This
rollout covers two independent pieces: sharing a stats snapshot as an
image, and CSV export. JSON export/import already exists
(`src/backup.js`, Settings' export/import buttons) — CSV is new.

The original roadmap idea was "share a single workout summary as an
image." During brainstorming this was refined: the user wants to share
**overall weekly/monthly stats from the Progress dashboard**, not a single
workout. Sharing a specific past workout (e.g. from History) is
explicitly out of scope for this rollout.

## Decisions from brainstorming

- **Image generation approach:** snapshot a real DOM node to a PNG via a
  small library (`html-to-image`, ~10-15kb), rather than manually drawing
  text/layout on an HTML canvas. This reuses the app's actual CSS/theme
  automatically instead of reimplementing styling in canvas-drawing code —
  the new dependency is a good trade against that implementation risk.
- **Shareable content:** a dedicated, purpose-built "shareable card" — not
  a snapshot of the live dashboard UI — vertical/story-shaped, showing the
  date range, total volume, session count, current streak, and a top
  PR/big-lift figure for that period. All values come from existing
  `src/stats.js` functions; no new stats computation.
- **Entry point:** a "Share" button in the Progress dashboard's toolbar,
  next to the existing 7/28/90-day range toggle (`src/screens/ProgressScreen.jsx`'s
  `ProgressToolbar`). The shared range matches whatever range is currently
  selected there.
- **Share mechanism:** `navigator.share()` with a `files` array (Web Share
  API Level 2) when supported — opens the native share sheet on mobile.
  Falls back to a plain PNG download (reusing the existing Blob-download
  pattern from `downloadJSON` in `src/App.jsx`) when `navigator.share`/file
  sharing isn't available (desktop browsers, older devices).

## Feature 1: Shareable stats card

**New component:** `src/components/ShareableStatsCard.jsx` — a
purpose-built card component, NOT reused from any existing dashboard
layout. Renders off-screen (or in a temporary overlay) only at the moment
of sharing, sized for a social-share aspect ratio (e.g. 1080×1920,
matching common story formats), styled with the app's existing design
tokens (`src/design/tokens.css`) for visual consistency, but as its own
independent layout — a vertical stack: app name/wordmark, date range
label (e.g. "Aug 19 - Aug 25, 2026"), then four stat blocks: total volume,
sessions this period, current streak, and one standout PR from the period.

**Data source — no new stats.js functions needed:**
- Range summary: `dashboardRangeSummary(sessions, rangeDays, todayIso)`
  (existing export — `{days, start, end, sessions, workoutDays, sets, volume}`).
- Streak: `currentStreak(sessions, todayIso)` (existing export).
- Top PR for the period: filter `personalRecords(sessions, limit)` (existing
  export, newest-first) to records whose `date` falls within
  `[dashboardRangeSummary.start, dashboardRangeSummary.end]`, take the
  first (most recent) match. If none, that stat block is omitted from the
  card (renders 3 blocks instead of 4 — no placeholder/zero shown).

**New file:** `src/imageShare.js` — a small, pure-ish wrapper around
`html-to-image` and `navigator.share`, isolating the browser-API surface
from the component:
```js
export async function shareElementAsImage(element, filename) {
  // Renders `element` to a PNG blob via html-to-image, then either:
  // - calls navigator.share({ files: [file] }) if supported, or
  // - falls back to a Blob download (same pattern as downloadJSON)
  // Returns { ok: boolean, method: "share" | "download", error? }
}
```

**UI wiring:** `ProgressScreen.jsx`'s `ProgressToolbar` gets a new "Share"
`Button`. Clicking it mounts `ShareableStatsCard` (off-screen, e.g.
`position: fixed; left: -9999px` or inside a hidden container — never
visible in normal layout), waits for it to render, calls
`shareElementAsImage` on its DOM node, then unmounts it. A brief status
message (reusing the existing `status-banner` pattern already used
elsewhere in `App.jsx`/screens) confirms success or reports failure.

## Feature 2: CSV export

**New file:** `src/csvExport.js` — one pure function:
```js
/** One row per logged set: date, day, exercise, weight, unit, reps, rpe. */
export function sessionsToCsv(sessions) {
  // returns a CSV string, header row + one row per set across all
  // sessions/exercises, sorted by date then exercise order as stored.
  // rpe column is blank ("") for sets without one (pre-Rollout-3 data,
  // or sets a user chose not to rate — matches existing "optional field
  // renders as blank" convention already used elsewhere, e.g. History's
  // setDisplay omitting a missing weight).
}
```
CSV values are quoted per standard CSV escaping (a value containing a
comma, quote, or newline is wrapped in quotes with internal quotes
doubled) — exercise names in this app never contain these characters
today, but the function shouldn't assume that going forward.

**UI wiring:** `SettingsScreen.jsx`'s existing "Export"/"Import" `Button`s
(currently in the `AppBar`'s trailing actions, per `src/App.jsx`) gain a
sibling "Export CSV" action, calling `sessionsToCsv(sessions)` and
downloading via a small generalization of the existing `downloadJSON`
helper in `src/App.jsx` — e.g. a new `downloadText(content, filename,
mimeType)` helper, with `downloadJSON` becoming a thin wrapper over it
(`downloadText(JSON.stringify(data, null, 2), filename,
"application/json")`) so both paths share one Blob-download
implementation instead of duplicating it.

## New dependency

`html-to-image` (or an equivalent well-maintained small DOM-to-PNG
library — exact package chosen during planning after checking current
maintenance status/bundle size) added to `package.json` dependencies.

## Testing

Per this project's minimal-tests convention:
- `sessionsToCsv`: 2-3 direct unit tests (a normal multi-session/multi-set
  case, a set with no `rpe` rendering as a blank column, and a value
  needing CSV-escaping).
- `shareElementAsImage`/`ShareableStatsCard`: browser-API-heavy (canvas
  rendering, `navigator.share`, DOM mounting) — not meaningfully unit
  testable with this project's `node:test` setup (no DOM/browser
  environment in the test runner, consistent with how other
  browser-only UI in this project — e.g. `Toast`, `SessionScreen`'s set
  row — is verified manually rather than via component tests). Verified
  manually instead: confirm the card renders with real data, the native
  share sheet opens on a real mobile browser/PWA, and the desktop
  fallback download produces a valid PNG.

## Out of scope for this rollout

- Sharing a single past workout from History (explicitly deferred).
- Reusing/snapshotting the live dashboard UI directly (a purpose-built
  card is used instead).
- Rollout 6 (programming/mesocycles) — still deferred, separate spec
  when its turn comes.
- The new "day-type volume trend" idea raised during this rollout's
  brainstorm (Push/Pull/Legs volume trend graph on Progress) — noted as
  a candidate for a future rollout, not built here.
