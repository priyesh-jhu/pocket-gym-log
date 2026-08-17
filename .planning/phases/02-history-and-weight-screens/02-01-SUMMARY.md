---
phase: 02-history-and-weight-screens
plan: 01
subsystem: ui
tags: [react, history, local-first, firebase, accessibility, timezone]
requires:
  - phase: 01-progress-completion
    provides: Converted-screen pattern, design tokens, shared Material primitives, and the lint-baseline gate
provides:
  - Dedicated monthly History destination extracted from App's inline render block
  - Strict per-collection result-based local hydration seam for screens that own their loading state
  - Tested pure History normalization, local-month grouping, copied edit drafts, and validation
  - One tested write-before-state-before-cloud orchestration seam used by both History mutations
  - App-owned save/delete adapters with no handwritten persistence ordering
affects: [02-history-and-weight-screens, 03-cleanup, weight-screen, android-redesign]
tech-stack:
  added: []
  patterns:
    - strict per-collection result reader alongside the existing forgiving reader
    - screen-owned loading/error state behind a narrowed root hydration guard
    - injected commit seam enforcing device -> state -> cloud ordering
    - copied edit draft retained across accidental dismissal
key-files:
  created:
    - src/localProfileData.js
    - src/localProfileData.test.js
    - src/historyRecords.js
    - src/historyRecords.test.js
    - src/screens/HistoryScreen.jsx
    - src/screens/HistoryScreen.css
  modified:
    - src/App.jsx
    - src/screens/SettingsScreen.jsx
    - src/screens/SettingsScreen.css
key-decisions:
  - "Grouping and every readable label derive from the stored local ISO date through parseLocalDate; new Date(iso) is never used, because it parses as UTC and moves a workout into the previous month west of Greenwich."
  - "Strict read failure is per COLLECTION, not per read. Workouts and weigh-ins are separate keys and separate destinations, so each carries its own { ok, data, error } and each screen surfaces only its own collection's failure. A corrupt weigh-in blob can never make a readable training history unreachable (fix round 1, Finding 1)."
  - "The strict reader is additive: readStoredArray keeps its forgiving semantics for auth reconciliation and import, and remains the per-collection fallback for whichever collection could not be read strictly."
  - "Bootstrap always reads strictly and records read failures per collection, falling back to the forgiving reader only for a collection that failed. Gating the strict read on activeTab at mount would leave History showing an empty list with no error when the user navigates to it later."
  - "Both History mutations must route through commitHistoryMutation; no parallel handwritten write/state/cloud sequence is allowed in App."
  - "commitHistoryMutation treats any non-truthy local write result as failure. For irreplaceable workout data, an unconfirmed write must not advance React state or the cloud."
  - "The day identity dot uses var(--primary) rather than the stored template colour, because the project constraints forbid hardcoded screen colours and a new inline-style system."
  - "The account-level reset control moved to Settings. It previously existed only in the History footer, which the UI contract removes, so leaving it there would have made reset unreachable."
patterns-established:
  - "Screen-owned loading: App exposes loading plus a load error and a retry callback; the screen renders the states."
  - "Injected orchestration seam: ordering-critical persistence lives in a tested pure function with callbacks, not in a component."
requirements-completed: [HIST-01, HIST-02, ARCH-01]
coverage:
  - id: D1
    description: History is a dedicated phone-width destination grouped by local calendar month, newest month and newest workout first, with every valid stored exercise, set, note, date, readiness detail and summary inspectable through accessible disclosure cards.
    requirement: HIST-01
    verification:
      - kind: unit
        ref: "src/historyRecords.test.js#groups valid sessions by local month, newest month and newest session first"
        status: pass
      - kind: unit
        ref: "src/historyRecords.test.js#valid exercises, sets, notes and metadata survive; malformed fragments are dropped"
        status: pass
      - kind: integration
        ref: "npm test && npm run test:tz && npm run build"
        status: pass
    human_judgment: true
    rationale: "Disclosure semantics, 48px targets, wrapping, theme contrast and 360/390px layout can only be confirmed on a real screen."
  - id: D2
    description: Grouping and readable labels derive from the exact stored local ISO date without UTC conversion, and invalid records are isolated without blanking valid history.
    requirement: HIST-01
    verification:
      - kind: unit
        ref: "src/historyRecords.test.js#month labels come from the stored local date without a UTC shift"
        status: pass
      - kind: unit
        ref: "src/historyRecords.test.js#malformed records are isolated without blanking valid history"
        status: pass
      - kind: integration
        ref: "npm run test:tz (six timezones, 218 pass each)"
        status: pass
    human_judgment: false
  - id: D3
    description: Editing opens a focused bottom sheet over a deep-copied draft; invalid or failed saves keep the draft open and leave the confirmed workout unchanged, and the edit preserves id, completion metadata, stored order, names, tracking types, units and unedited optional fields.
    requirement: HIST-02
    verification:
      - kind: unit
        ref: "src/historyRecords.test.js#a draft is a deep copy: editing it never touches the confirmed record"
        status: pass
      - kind: unit
        ref: "src/historyRecords.test.js#an update preserves the id, completion metadata and untouched stored fields"
        status: pass
      - kind: unit
        ref: "src/historyRecords.test.js#an update with no complete set fails and leaves the original deeply unchanged"
        status: pass
    human_judgment: true
    rationale: "Sheet focus handling, dirty dismissal, field error association and live announcements need interactive verification."
  - id: D4
    description: Workout deletion is a separately confirmed action; a failed local write keeps the workout visible and retryable, and success mirrors to Firebase only after the local write.
    requirement: HIST-02
    verification:
      - kind: unit
        ref: "src/historyRecords.test.js#a delete commit mirrors a cloud session delete only after the device write"
        status: pass
      - kind: unit
        ref: "src/historyRecords.test.js#a false device write invokes neither state nor cloud"
        status: pass
      - kind: unit
        ref: "src/historyRecords.test.js#a throwing device write invokes neither state nor cloud"
        status: pass
    human_judgment: true
    rationale: "Confirmation copy, non-destructive default focus and the signed-in Firestore mirror require device verification."
  - id: D5
    description: HistoryScreen owns presentation and transient sheet/expansion state while App owns sessions, storage, Firebase calls, navigation and confirmed state changes.
    requirement: ARCH-01
    verification:
      - kind: integration
        ref: "node -e assertion: single <HistoryScreen mount, no legacy History renderer in App.jsx"
        status: pass
      - kind: other
        ref: "node scripts/verify-lint-baseline.mjs"
        status: pass
    human_judgment: false
  - id: D6
    description: History loading is reachable — the root hydration guard admits only persisted History/Weight destinations while loading, a strict reader distinguishes valid empty data from a failed read, and Try again transitions error to loading to populated or error. Progress root-loading is unchanged.
    verification:
      - kind: unit
        ref: "src/localProfileData.test.js#a retry after failure re-enters loading and applies data before loading ends"
        status: pass
      - kind: unit
        ref: "src/localProfileData.test.js#malformed session JSON is an error rather than an empty history"
        status: pass
      - kind: integration
        ref: "node -e assertion: screenOwnsLoadingState is exactly [\"history\", \"weight\"] and the guard is narrowed"
        status: pass
    human_judgment: true
    rationale: "The visible loading/error/retry presentation and the absence of an empty-history flash must be seen."
  - id: D7
    description: A read failure in one collection never makes the other unreachable — a corrupt weigh-in blob leaves the workout history rendering, a corrupt workout blob leaves weigh-ins readable, and a retry that repairs one collection recovers only that one.
    requirement: HIST-01
    verification:
      - kind: unit
        ref: "src/localProfileData.test.js#a corrupt weigh-in blob leaves the workout history readable"
        status: pass
      - kind: unit
        ref: "src/localProfileData.test.js#a corrupt workout blob leaves the weigh-ins readable"
        status: pass
      - kind: unit
        ref: "src/localProfileData.test.js#a retry that repairs the workouts clears the History error and applies them"
        status: pass
      - kind: unit
        ref: "src/localProfileData.test.js#a load applies the readable collections even when the other one fails"
        status: pass
    human_judgment: false
  - id: D8
    description: Each month heading carries its own supporting workout count with correct singular/plural copy, alongside the unchanged screen-level total.
    verification:
      - kind: unit
        ref: "src/historyRecords.test.js#groups valid sessions by local month, newest month and newest session first (asserts group.count)"
        status: pass
      - kind: integration
        ref: "npm run build"
        status: pass
    human_judgment: true
    rationale: "Placement and legibility of the supporting line under each month heading need a visual check."
duration: 95min + 20min fix round 1
completed: 2026-08-17
status: complete
---

# Phase 2 Plan 1: History Vertical Slice Summary

**History is now a dedicated month-grouped screen over two tested pure modules, with edit and delete routed through one write-before-state-before-cloud seam**

## Performance

- **Duration:** ~95 min
- **Completed:** 2026-08-17
- **Tasks:** 3
- **Files created/modified:** 9

## Accomplishments

- Replaced App's inline History render block with `src/screens/HistoryScreen.jsx`, a controlled presentation component that touches neither storage nor Firebase.
- Added `src/historyRecords.js`: safe normalization of untrusted stored sessions, local calendar-month grouping with deterministic newest-first order, tracking-aware set display, deep-copied edit drafts, completed-workout validation, and the `commitHistoryMutation` ordering seam.
- Added `src/localProfileData.js`: a strict **per-collection** result reader that distinguishes genuinely empty storage from a thrown read or corrupt JSON, plus `profileLoadErrors` and `runLocalProfileLoad` for the error to loading to populated retry transition. Workouts and weigh-ins fail independently. The existing forgiving `readStoredArray` is untouched and still owns auth reconciliation and import.
- Narrowed App's root hydration guard to `if (loading && !screenOwnsLoadingState)` with `screenOwnsLoadingState = ["history", "weight"].includes(activeTab)`. Progress root-loading behaviour is unchanged.
- Both History mutations (`saveHistoricalWorkout`, `deleteHistoricalWorkout`) delegate all ordering to `commitHistoryMutation`. A false or throwing local write invokes neither React state nor the cloud.
- Each month heading carries its own `{N} workout` / `{N} workouts` supporting line.
- Test count went from 172 to 227, passing in the default timezone and in all six configured timezones.

## Task Commits

1. **Task 1: Prove a safe monthly History read path** - `5a95ce2`
2. **Task 2: Add copied workout editing with App-owned persistence** - `10c1cec`
3. **Task 3: Make workout deletion confirmed and failure-safe** - `c573063`

**Fix round 1** (review findings, after coordinator token fixes `7df2838` and `c3efbd1`):

4. **Finding 1: Isolate history and weight load failures** - `123b0db`
5. **Finding 2: Show workout counts on history month headings** - `1aa8568`

## Deviations from Plan

### 1. [Missing critical] Account-level reset would have become unreachable

- **Found during:** Task 1, removing the legacy History render block.
- **Issue:** `Reset all data` existed **only** in the History footer. The UI contract removes that footer chrome and states reset "stays in Settings", but no reset control existed in Settings, so removing the footer would have deleted the user's only path to reset — a behaviour regression the plan forbids.
- **Fix:** The existing `resetAll` / `confirmReset` state stays in App and is now surfaced by `SettingsScreen` as a tokenized card with the same two-step confirmation. No change to what reset does.
- **Files modified:** `src/screens/SettingsScreen.jsx`, `src/screens/SettingsScreen.css`, `src/App.jsx`
- **Committed in:** `5a95ce2`

### 2. [Refinement] Storage key builders moved into the new module

- **Issue:** `readLocalProfileResult({ storage, profile, loadPrefs })` has no key-builder parameter, so the new module must construct the session/weigh-in keys. Duplicating persisted key prefixes across two files is a data-integrity hazard.
- **Fix:** `SESSION_PREFIX`, `WEIGHT_PREFIX`, `sessionKey` and `weightKey` now live in `src/localProfileData.js` and App imports them. The key **strings are byte-identical**; nothing about the storage contract changed.
- **Committed in:** `5a95ce2`

### 3. [Refinement] Bootstrap reads strictly for every destination

- **Issue:** The plan says to use the strict seam "only when activeTab is History or Weight". Gating the mount read on `activeTab` means a user who starts on Home and later navigates to History sees an empty list with no error.
- **Fix:** Bootstrap always reads strictly and records the error, then falls back to the forgiving reader so every other destination keeps its long-standing behaviour. Only History (and, in plan 02-02, Weight) surfaces the error.
- **Committed in:** `5a95ce2`

### 4. [Bug, found in review] Combined read result blanked valid history

- **Found during:** Fix round 1 review.
- **Issue:** `readLocalProfileResult` returned a single combined `{ok,data,error}`, so a corrupt **weigh-in** blob failed the whole read. App recovered the valid sessions through the forgiving fallback but still set `localLoadError`, and `HistoryScreen` renders its load-error card whenever `loadError` is truthy — so a user with a perfectly readable history was told it could not be shown, and `Try again` re-ran the same combined read and could never succeed. The combined shape was what the plan's Task 1 `<action>` specified, but it violated the plan's own binding truth that invalid records are isolated without blanking valid history.
- **Fix:** Failure is now per collection. `sessions` and `bodyweights` each carry `{ ok, data, error }`; `profileLoadErrors(result)` reports them separately; the top-level `ok`/`error` are kept as the coarse answer. App applies whichever collections read cleanly, falls back to the forgiving reader only for the ones that failed, derives History's error from `localLoadError?.sessions` alone, and applies partial data on retry.
- **Files modified:** `src/localProfileData.js`, `src/localProfileData.test.js`, `src/App.jsx`
- **Committed in:** `123b0db`

### 5. [Bug, found in review] Per-month workout count was computed but never rendered

- **Issue:** `groupSessionsByMonth` computed `count` per group, but the screen only summed it into the screen-level total, so the UI contract's month-group copy was missing.
- **Fix:** Each month heading now renders `{N} workout` / `{N} workouts`; the screen-level total is unchanged.
- **Files modified:** `src/screens/HistoryScreen.jsx`, `src/screens/HistoryScreen.css`
- **Committed in:** `1aa8568`

### 6. [Refinement] Malformed stored exercise no longer blocks an edit

- **Found during:** Self-review after Task 3.
- **Issue:** `prepareHistoryUpdate` checked the exercise name before discarding empty exercises, so a record containing one malformed stored exercise could never be saved.
- **Fix:** Exercises with no complete set drop first (matching how saving a live workout behaves); a blank name that still holds sets remains a user-fixable error.
- **Committed in:** `c573063`

**Total deviations:** 1 missing critical, 3 refinements, 2 review-found bugs fixed in round 1.
**Impact on plan:** No scope creep beyond keeping reset reachable. No storage key, Firestore path, session id/schema, local-date, import/export or reset behaviour changed.

## Issues Encountered

- `react-hooks/refs` rejected reading a ref during render for the draft dirty check; the comparison moved into the close handler where it belongs.
- `--error-container`, `--on-error-container` and `.sr-only` were referenced by Phase 1 code but defined nowhere. Flagged from here and fixed by the coordinator in `7df2838` / `c3efbd1` (which also remapped an orphaned `--line`). `HistoryScreen` uses only defined tokens and a visible `h1` regardless.
- `HistoryScreen.css` uses `--sp3` (12px), which is not in the UI-SPEC's declared Phase 2 spacing scale. Reviewed and deliberately parked: `HomeScreen.css` and `SettingsScreen.css` already use it the same way, so conforming History alone would make it the inconsistent one.

## User Setup Required

None.

## Self-Check: PASSED

- Commits `5a95ce2`, `10c1cec`, `c573063`, `123b0db`, `1aa8568` exist; each task's `<automated>` verify command passes on the final tree, including the Task 1 command verbatim after the per-collection change.
- `npm test`: 227 passed, 0 failed (baseline was 172).
- `npm run test:tz`: 227 passed in each of six timezones.
- `npm run build`: passed.
- `node scripts/verify-lint-baseline.mjs`: passed with only the recorded App guest-bootstrap baseline finding.
- `HistoryScreen.css`: no colour literal, no `!important` (grep-verified).

## Next Phase Readiness

- Plan 02-02 (Weight) consumes `localLoadError?.bodyweights` and the `bodyweights` sub-result of `readLocalProfileResult`; the `weight` destination is already admitted by `screenOwnsLoadingState`, and `runLocalProfileLoad` already applies weigh-ins independently of workouts.
- The legacy `WeightTab` still renders inline in `App.jsx` and now mounts during hydration; plan 02-02 replaces it with its own loading/error states.
- Not yet human-verified on a device: light/dark 360/390px presentation, disclosure and sheet interaction, focus return, dirty dismissal, 200% text scaling, reduced motion, and the signed-in Firestore mirror for edit and delete.

---
*Phase: 02-history-and-weight-screens*
*Completed: 2026-08-17*
