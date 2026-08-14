# Codebase Concerns

**Analysis Date:** 2026-08-14

## Tech Debt

**Application monolith and incomplete Android/Material extraction:**
- Issue: `App` owns authentication, local persistence, cloud reconciliation, workout editing, history, weigh-ins, imports, timers, navigation, and most modal UI in one 1,458-line component. The Android redesign has extracted home, progress, and settings screens, but active-session and history/weight flows remain embedded and heavily inline-styled.
- Files: `src/App.jsx`, `src/screens/HomeScreen.jsx`, `src/screens/ProgressScreen.jsx`, `src/screens/SettingsScreen.jsx`, `src/index.css`
- Impact: Any state change can rerender a very large tree; persistence and navigation changes are difficult to isolate; visual behavior is split between tokens, component CSS, inline styles, and legacy markup.
- Fix approach: Extract stateful domains behind hooks/services (`useWorkoutDraft`, `useCloudSync`, `useRestTimer`) and move history, weight, and session UI into screen components. Keep storage/cloud operations outside render components and migrate inline styles to the tokenized component system.

**Hidden duplicate session UI:**
- Issue: Old coach, date, timer, and warm-up markup is still rendered with `aria-hidden="true"` and hidden only by `.session-legacy-details { display: none; }`, while replacement content lives in sheets.
- Files: `src/App.jsx`, `src/index.css`
- Impact: Dead UI increases bundle and maintenance cost, preserves duplicate controls and copy, and can reappear if CSS fails or is refactored.
- Fix approach: Remove `.session-legacy-details` markup after verifying parity in the details/options sheets; keep one implementation for each control.

**Storage identity and schema are implicit:**
- Issue: Exercise display names are durable history keys, and `equipmentPrefs` is also used as a general account document for custom exercises, templates, goals, dashboard settings, increments, and timer defaults without a declared schema or migration version.
- Files: `src/data/exercises.js`, `src/equipmentPrefs.js`, `src/customWorkouts.js`, `src/userFeatures.js`, `src/progression.js`, `src/restTimer.js`, `src/App.jsx`
- Impact: Renaming an exercise or changing a nested preference shape can orphan history or silently discard user features during reconciliation/import.
- Fix approach: Introduce stable exercise IDs, a versioned account-settings schema, explicit migrations, and validators for every persisted settings subsection before changing names or shapes.

**Documentation and native release metadata drift:**
- Issue: The README says lint has five known errors, while the current run has one. The web package reports `1.4.0`, but Android remains `versionCode 1` / `versionName "1.0"`.
- Files: `README.md`, `package.json`, `android/app/build.gradle`
- Impact: Release artifacts can display inconsistent versions, Play Store upgrades cannot be managed reliably, and contributors receive stale quality-gate guidance.
- Fix approach: Derive Android versioning from a release process or update it with every release; make lint green and remove the stale exception text.

## Known Bugs

**Lint fails on synchronous bootstrap state updates:**
- Symptoms: `npm run lint` exits 1 with `react-hooks/set-state-in-effect` at `App.jsx:396`; CI or release workflows that require lint cannot pass.
- Files: `src/App.jsx`, `eslint.config.js`, `README.md`
- Trigger: Run `npm run lint`.
- Workaround: Tests and production build currently pass independently; this does not make the lint gate green.

**Local save can be reported successful before cloud persistence succeeds:**
- Symptoms: Workout saves immediately show a saved state; a rejected cloud write only changes the cloud indicator and logs an error, without retaining an explicit retry item or surfacing the failed record.
- Files: `src/App.jsx`, `src/firebase.js`
- Trigger: Save/delete while signed in when Firestore is offline, times out, denies the write, or loses connectivity after the local write.
- Workaround: The local copy remains and a later authentication/profile sync may upload it, provided the same browser storage survives and reconciliation does not encounter a conflicting record.

**Concurrent edits use type-dependent, timestamp-free conflict rules:**
- Symptoms: On the same session ID, current-device data always wins; on a weigh-in date, incoming cloud data wins; settings are shallow-merged. `updatedAt` is written but never read for reconciliation.
- Files: `src/backup.js`, `src/cloudData.js`, `src/firebase.js`, `src/App.jsx`
- Trigger: Modify overlapping data on two devices before each device has loaded the other's changes, then reconnect/sign in.
- Workaround: Export a JSON backup before resolving discrepancies manually; there is no conflict UI or deterministic last-write policy.

**Guest bootstrap performs avoidable cascading renders:**
- Symptoms: React lint identifies direct state updates in the bootstrap effect, and startup commits several state changes after the initial render.
- Files: `src/App.jsx`
- Trigger: Every application mount.
- Workaround: None user-facing; initialize a single bootstrap state lazily or dispatch one reducer action from an external subscription/task.

## Security Considerations

**Sensitive fitness data is stored unencrypted and included in device backups:**
- Risk: Workout history, bodyweight, readiness/pain notes, goals, account display name/email, and drafts are readable from browser/Capacitor local storage; Android permits OS backup with `android:allowBackup="true"`.
- Files: `src/App.jsx`, `src/draftStorage.js`, `src/equipmentPrefs.js`, `src/userFeatures.js`, `android/app/src/main/AndroidManifest.xml`
- Current mitigation: Data is namespaced by Firebase UID or guest, storage access is wrapped to avoid crashes, and cloud access is owner-scoped.
- Recommendations: Document the data-safety model, decide whether Android backup is intended, exclude sensitive WebView storage from backup or disable backup, and evaluate encrypted native storage for health-related data.

**Export files contain raw personal data:**
- Risk: JSON exports are unencrypted, downloaded to user-visible storage, and include all sessions, weigh-ins, preferences, goals, custom templates, and account/profile labeling.
- Files: `src/backup.js`, `src/App.jsx`, `src/ErrorBoundary.jsx`
- Current mitigation: Export is user-initiated; import validates structural crash hazards and requires merge/replace confirmation.
- Recommendations: Warn clearly that exports contain personal data, avoid unnecessary account identifiers, offer encrypted/password-protected export if threat requirements justify it, and define retention guidance.

**Firestore rules authorize ownership but not document shape or size:**
- Risk: Any authenticated owner can write arbitrary fields and large/malformed payloads beneath their UID. A compromised client or direct SDK use can create records that crash unguarded consumers or increase billing.
- Files: `firestore.rules`, `src/firebase.js`, `src/App.jsx`
- Current mitigation: Rules prevent cross-user access; normal client writes use expected paths and backup import performs partial validation.
- Recommendations: Add allowlisted collection paths, document-ID constraints, field/type/size validation, and emulator-backed rule tests. Validate cloud-loaded sessions, weigh-ins, and settings before rendering or persisting them locally.

**Cloud-loaded data bypasses backup validation:**
- Risk: `loadCloudData` returns raw nested Firestore objects and reconciliation feeds them into rendering/statistics; malformed owned documents can reach code that assumes `session.exercises` and `exercise.sets` are arrays.
- Files: `src/firebase.js`, `src/cloudData.js`, `src/backup.js`, `src/App.jsx`, `src/stats.js`
- Current mitigation: Firestore ownership rules limit who can modify the documents, and JSON imports use `validateBackup`.
- Recommendations: Reuse a shared schema validator for local storage, cloud reads, imports, and drafts; quarantine invalid records and show a recoverable-data warning.

## Performance Bottlenecks

**One-second timer rerenders the application shell:**
- Problem: During an active workout, `sessionElapsed` updates every second in the root `App`, while rest-timer state also ticks each second.
- Files: `src/App.jsx`
- Cause: Timer state shares the component that computes PR maps, sorted sessions, exercise-name unions, and renders all major tabs/modals.
- Improvement path: Isolate timers into memoized components/hooks, derive elapsed time locally, and memoize history/statistical derivations by sessions.

**Full collection scans and snapshot rewrites on sign-in:**
- Problem: Every profile sync reads every session and bodyweight document plus legacy/settings documents, merges them in memory, then writes the complete merged snapshot back in batches.
- Files: `src/firebase.js`, `src/cloudData.js`, `src/App.jsx`
- Cause: There is no cursor, incremental sync token, or query on `updatedAt`; tombstones are retained and fetched indefinitely.
- Improvement path: Track per-device sync cursors, query changed records, paginate large histories, compact acknowledged tombstones, and write only records changed by reconciliation.

**Large production chunks:**
- Problem: The build emits separate Firebase and chart chunks around 364 KB and 373 KB uncompressed, plus a 213 KB main chunk.
- Files: `src/App.jsx`, `src/ProgressDashboard.jsx`, `src/screens/ProgressScreen.jsx`, `vite.config.js`
- Cause: Firebase and Recharts are core imports; large analytics/screens are not fully route/lifecycle lazy-loaded.
- Improvement path: Lazy-load charting and Firebase sign-in/sync paths, verify actual initial network waterfalls, and set bundle budgets in build verification.

## Fragile Areas

**Offline-first local/cloud reconciliation:**
- Files: `src/App.jsx`, `src/firebase.js`, `src/cloudData.js`, `src/backup.js`, `src/cloudData.test.js`, `src/backup.test.js`
- Why fragile: Local state, UID namespaces, one-time legacy claiming, tombstones, imports, shallow settings merges, and asynchronous writes interact without transactions or a durable operation queue.
- Safe modification: Preserve guest/account isolation, validate every boundary, define collision semantics before changing merge order, and test two-device/offline/delete/import sequences with fake Firestore adapters.
- Test coverage: Pure merge and tombstone behavior is tested; authentication transitions, real persistence failures, retries, batch partial failure, and concurrent device scenarios are not.

**Android back navigation and session history sentinel:**
- Files: `src/App.jsx`, `android/app/src/main/java/com/pocketgymlog/app/MainActivity.java`, `android/app/src/main/AndroidManifest.xml`
- Why fragile: Browser history state, a mutable ref, `popstate`, React session state, and Capacitor's native back behavior jointly control whether a draft exits or shows confirmation.
- Safe modification: Centralize navigation state, test browser and Android back sequences, and preserve the draft before changing push/back ordering.
- Test coverage: No React DOM, Capacitor, or Android navigation tests cover this flow; native tests are generated examples under mismatched `com.getcapacitor.myapp` packages.

**Persisted-data rendering assumptions:**
- Files: `src/App.jsx`, `src/stats.js`, `src/ProgressDashboard.jsx`, `src/ErrorBoundary.jsx`, `src/backup.js`
- Why fragile: Many analytics/render paths directly iterate nested arrays. Corrupt local/cloud data can cause whole-app render failure; the error boundary's recovery is raw export and reload rather than record isolation.
- Safe modification: Normalize data once at ingestion and make selectors total over malformed records; retain raw recovery export separately.
- Test coverage: Import validation has strong malformed-payload tests, but direct localStorage and Firestore corruption are not tested through the rendered application.

**Material redesign styling boundary:**
- Files: `src/App.jsx`, `src/index.css`, `src/design/tokens.css`, `src/design/base.css`, `src/components/`, `src/screens/`
- Why fragile: New tokenized components coexist with extensive hard-coded dark colors, inline dimensions, hidden legacy markup, and partial screen extraction.
- Safe modification: Migrate one complete flow at a time, add visual/accessibility snapshots at narrow Android widths, then delete replaced CSS/markup.
- Test coverage: No component, screenshot, accessibility, focus-trap, keyboard, safe-area, or Android viewport tests exist.

## Scaling Limits

**Firestore history synchronization:**
- Current capacity: Firestore batches are intentionally capped at 400 writes; all records are loaded into memory and fetched in one unpaginated request set.
- Limit: Read cost and startup latency grow linearly with lifetime sessions, weigh-ins, and tombstones; bulk replace additionally reads all existing records before writing.
- Scaling path: Use incremental queries and pagination, archive/compact tombstones, add observable sync metrics, and avoid unconditional snapshot upload after reads.

**Browser localStorage as primary database:**
- Current capacity: Browser/WebView quotas are implementation-dependent and writes serialize complete session/bodyweight arrays.
- Limit: Each save rewrites the full JSON history synchronously on the main thread; quota exhaustion can reject saves/imports, and clearing site/app data removes the offline source of truth.
- Scaling path: Move structured records to IndexedDB or a native database, write records individually, retain transactional import semantics, and surface storage usage/backup status.

**Root-component computation:**
- Current capacity: All sessions are repeatedly scanned for PRs, names, history sorting, and downstream dashboard analytics during root renders.
- Limit: Long histories combined with one-second workout timers and chart rendering will increase interaction latency on lower-end Android devices.
- Scaling path: Memoize selectors, index records by exercise/date, virtualize long history lists, and profile on representative low-end hardware.

## Dependencies at Risk

**Capacitor/native integration coverage:**
- Risk: Capacitor authentication, notifications, native back handling, backup behavior, and Gradle configuration are not exercised by the JavaScript suite; checked-in Android tests are untouched template tests in the wrong package namespace.
- Impact: Web tests/build can pass while Android sign-in, notification permissions, navigation, or release packaging fails.
- Migration plan: Replace template tests with package-correct smoke/instrumentation tests, add a debug Android build to CI, and test native plugins on the supported API range before dependency upgrades.

**Rapid-major frontend dependency set:**
- Risk: React 19, ESLint 10, Vite 8, Recharts 3, Firebase 11, and Capacitor 7 are all major-version-sensitive integrations; the current React hooks lint rule already blocks lint.
- Impact: Upgrades can change hook diagnostics, bundling, chart rendering, authentication, or native plugin compatibility across web and Android.
- Migration plan: Keep exact native plugin versions aligned, upgrade one major integration at a time, run web unit/lint/build plus Android smoke tests, and add dependency-update automation with bundle/runtime checks.

## Missing Critical Features

**Durable sync queue and conflict visibility:**
- Problem: Failed cloud operations are not persisted as retryable operations, and record conflicts are resolved silently by fixed merge precedence without using `updatedAt`.
- Blocks: Reliable multi-device/offline guarantees and confident user messaging that all signed-in changes are synced.

**Validated, versioned persisted schema:**
- Problem: Only imported backup payloads receive meaningful shape validation; local storage, Firestore reads, and the overloaded settings object lack a shared schema/migration pipeline.
- Blocks: Safe evolution of exercise identifiers, account preferences, custom features, and cloud data without corruption/orphaning risk.

**Production Android quality gate:**
- Problem: There is no repository command or CI evidence for assembling/testing the Android app, checking release version metadata, or exercising native Google authentication and notifications.
- Blocks: Repeatable Play Store releases and regression detection for the ongoing Android redesign.

## Test Coverage Gaps

**React application workflows:**
- What's not tested: Authentication bootstrap, guest/account switching, full workout save/delete, import rollback UI, timer lifecycle, history navigation, error boundary recovery, and screen/component rendering.
- Files: `src/App.jsx`, `src/main.jsx`, `src/ErrorBoundary.jsx`, `src/screens/`, `src/components/`
- Risk: The highest-complexity component can regress despite 164 passing pure-function tests.
- Priority: High

**Firebase integration and rules:**
- What's not tested: Firestore rule enforcement, timeouts, batch chunking/partial failure, legacy migration, native/browser authentication, offline retry, and actual document serialization.
- Files: `src/firebase.js`, `firestore.rules`, `src/cloudData.js`
- Risk: Data loss, stale resurrection, access-rule mistakes, and sync failures can reach production unnoticed.
- Priority: High

**Android behavior and responsive redesign:**
- What's not tested: Capacitor build, native back button, Google sign-in, local notifications/permissions, safe-area layouts, focus handling, and narrow-screen visual regressions.
- Files: `android/`, `capacitor.config.json`, `src/App.jsx`, `src/screens/`, `src/components/`, `src/index.css`
- Risk: The current Android-focused redesign can pass web unit tests while failing on devices.
- Priority: High

**Persistence corruption and quota failures:**
- What's not tested: Malformed direct localStorage/cloud records, storage quota failure during ordinary workout/weigh-in saves, rollback failure through rendered UI, and recovery after app restart.
- Files: `src/App.jsx`, `src/draftStorage.js`, `src/equipmentPrefs.js`, `src/ErrorBoundary.jsx`, `src/firebase.js`
- Risk: Health/history data may disappear, diverge from UI, or crash rendering without a verified recovery path.
- Priority: High

**Performance and bundle budgets:**
- What's not tested: Long-history render latency, timer-driven rerenders, Firestore read growth, initial-load chunk cost, and lower-end Android performance.
- Files: `src/App.jsx`, `src/stats.js`, `src/ProgressDashboard.jsx`, `src/screens/ProgressScreen.jsx`, `vite.config.js`
- Risk: Performance degrades gradually as user history grows and remains invisible to functional tests.
- Priority: Medium

---

*Concerns audit: 2026-08-14*
