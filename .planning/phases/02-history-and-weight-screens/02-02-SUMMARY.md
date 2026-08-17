# 02-02 Summary — Weight screen

Replaced the legacy inline `WeightTab` in `src/App.jsx` with a dedicated `src/screens/WeightScreen.jsx` (+ `WeightScreen.css`), following the History pattern: summary hero → bodyweight trend (recharts + accessible data table) → `Add weigh-in` → newest-first history, with loading/error/empty states and a shared Add/Edit Sheet plus a separate delete confirmation.

New `src/weightRecords.js` provides pure helpers: `normalizeBodyweights` (permissive reads — accepts any finite weight, including zero/negative legacy values), `buildWeightView` (display-unit conversion, local-ISO 7-day average, summary/net-change/history), `createWeightDraft`, `prepareWeightMutation` (one-entry-per-date, id preservation across adds/edits/date-moves), `commitWeightMutation` (device-write-first seam, mirrors `commitHistoryMutation`), and `createWeightCloudOperation` (awaits old-date delete before new-date save).

`App.jsx` now owns `bodyweights` and a `weightDisplayUnit` state, and exposes `saveWeighIn`/`deleteWeighIn` adapters that call the new seams and schedule exactly one cloud operation through the existing `runCloud`. Removed `weightInput`/`weightDate`/`confirmDeleteWeight` state and the now-dead `persistWeights` helper. History wiring (`loadError={localLoadError?.bodyweights}`) mirrors the History screen's pattern.

Tests: 11 new focused tests in `src/weightRecords.test.js` covering malformed/zero/negative reads, zero/one-entry summary (no fabrication), mixed lb/kg conversion, local-ISO 7-day-average month-boundary arithmetic, add-onto-existing-date id preservation, edit-with-date-move id/collision handling, validation rejection, and commit/cloud-ordering seams.

Gates: `npm test` 238/238 pass (227 baseline + 11 new), `npm run test:tz` clean across all six zones, `npm run build` clean, `node scripts/verify-lint-baseline.mjs` passes with the one pre-existing baselined `App.jsx` finding only. No deviations from the plan.
