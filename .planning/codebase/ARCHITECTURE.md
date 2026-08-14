<!-- refreshed: 2026-08-14 -->
# Architecture

**Analysis Date:** 2026-08-14

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│ React presentation and interaction                                 │
├─────────────────────┬─────────────────────┬─────────────────────────┤
│ App shell/workout   │ Screens             │ Reusable UI/analytics   │
│ `src/App.jsx`       │ `src/screens/`      │ `src/components/`       │
└──────────┬──────────┴──────────┬──────────┴────────────┬────────────┘
           │                     │                       │
           └─────────────────────┴───────────┬───────────┘
                                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Pure workout domain and data modules                               │
│ `src/*.js`, `src/data/`, `src/charts/`, `src/design/`              │
└───────────────────────────────┬─────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Offline-first persistence and optional cloud synchronization       │
│ browser localStorage (`src/App.jsx`, `src/draftStorage.js`)         │
│ Firebase Auth/Firestore (`src/firebase.js`, `src/cloudData.js`)     │
└───────────────────────────────┬─────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Delivery shells: Vite PWA / Firebase Hosting / Capacitor Android   │
│ `public/`, `firebase.json`, `capacitor.config.json`, `android/`     │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Browser bootstrap | Initializes theme and mounts the error boundary, PWA status, and application | `src/main.jsx` |
| Application orchestrator | Owns navigation, workout lifecycle, profile state, persistence, sync, timers, imports, and most modal UI | `src/App.jsx` |
| Top-level screens | Render home, progress, and settings experiences from state and callbacks supplied by `App` | `src/screens/HomeScreen.jsx`, `src/screens/ProgressScreen.jsx`, `src/screens/SettingsScreen.jsx` |
| Analytics | Derives volume, streak, PR, muscle, calendar, and recommendation data without owning persistence | `src/stats.js`, `src/trainingInsights.js`, `src/workoutSummary.js` |
| Workout domain | Creates drafts, resolves exercise variants, validates sets, templates, tracking modes, goals, and progression | `src/draft.js`, `src/data/exercises.js`, `src/customWorkouts.js`, `src/exerciseTracking.js`, `src/progression.js`, `src/userFeatures.js` |
| Local persistence | Stores profile-scoped sessions, weigh-ins, preferences, drafts, navigation, and timer data | `src/App.jsx`, `src/equipmentPrefs.js`, `src/draftStorage.js` |
| Cloud adapter | Encapsulates Firebase initialization, Google authentication, Firestore schema-v2 reads/writes, tombstones, and migration reads | `src/firebase.js` |
| Reconciliation/import | Validates JSON backups and deterministically merges local, cloud, legacy, and imported data | `src/backup.js`, `src/cloudData.js` |
| Design system | Supplies reusable controls, theme tokens, global CSS, and chart colors | `src/components/`, `src/design/`, `src/charts/` |

## Pattern Overview

**Overall:** Offline-first React single-page application with a central stateful container, functional domain modules, and adapter-based optional cloud sync.

**Key Characteristics:**
- `src/App.jsx` is the composition root and state owner; screens are controlled views receiving data and event callbacks.
- Domain calculations are plain ES modules with no React or storage dependency, which keeps them directly testable with Node's test runner.
- Local storage is authoritative for immediate/offline use; authenticated Firestore operations are asynchronous mirrors and cloud data is reconciled into local state.
- The same compiled web application runs in browsers/PWA and inside the generated Capacitor Android shell.
- No client-side router is used; `activeTab` and `sessionActive` select views inside `App`, with browser history used only to intercept back navigation during an active workout.

## Layers

**Bootstrap and Delivery:**
- Purpose: Start the React application and expose it as web, installable PWA, Firebase-hosted SPA, and Android app.
- Location: `src/main.jsx`, `src/pwa.js`, `src/PWAStatus.jsx`, `public/`, `firebase.json`, `capacitor.config.json`, `android/`
- Contains: Root mounting, theme/PWA initialization, service-worker assets, hosting rules, and native wrapper configuration.
- Depends on: React, Vite output, Capacitor, Firebase Hosting.
- Used by: Browser and Android runtime entry points.

**Presentation:**
- Purpose: Render tabs, workout entry, history, progress, weight, settings, dialogs, and reusable controls.
- Location: `src/App.jsx`, `src/screens/`, `src/components/`, `src/ProgressDashboard.jsx`, `src/MuscleHeatmap.jsx`
- Contains: React components, hooks, controlled inputs, inline workout UI, and component-scoped CSS.
- Depends on: Domain modules, chart/theme helpers, icon and chart libraries.
- Used by: `src/main.jsx`.

**Domain and Reference Data:**
- Purpose: Encode workout rules and compute derived results independent of UI and persistence.
- Location: `src/*.js`, `src/data/`
- Contains: Draft/session construction, exercise catalog, form guides, statistics, progression, summaries, goals, backup transformations, and date handling.
- Depends on: Other pure domain/data modules only; keep calendar-date construction centralized in `src/dateUtils.js`.
- Used by: `src/App.jsx`, screens, dashboards, and co-located tests.

**Persistence and Integration:**
- Purpose: Persist state immediately on-device and optionally synchronize it to per-user cloud collections.
- Location: `src/App.jsx`, `src/draftStorage.js`, `src/equipmentPrefs.js`, `src/firebase.js`, `src/cloudData.js`, `src/backup.js`
- Contains: Namespaced keys, guarded storage calls, draft autosave, JSON import/export, Firebase auth, Firestore CRUD, tombstones, timeouts, and legacy migration.
- Depends on: Browser storage APIs and Firebase SDKs.
- Used by: Application orchestration in `src/App.jsx`.

## Data Flow

### Application Startup and Cloud Reconciliation

1. `src/main.jsx:10` initializes theme and mounts `App` inside `ErrorBoundary` alongside `PWAStatus`.
2. `src/App.jsx:311` initializes React state, reads the active tab and profile-scoped local records, and subscribes to Firebase auth.
3. `src/App.jsx:456` builds a local snapshot, calls `loadCloudData`, then uses `reconcileCloudData` to merge schema-v2 and legacy cloud records.
4. `src/cloudData.js:4` delegates deterministic union behavior to `mergeBackup` and filters server tombstones.
5. Reconciled sessions, weigh-ins, and settings update React state/local storage; `saveCloudSnapshot` persists the normalized schema when signed in.

### Workout Save

1. Controlled inputs update the in-memory `draft` in `src/App.jsx`; a debounced effect at `src/App.jsx:521` writes it through `src/draftStorage.js`.
2. `saveSession` in `src/App.jsx:778` removes incomplete sets, attaches readiness/completion metadata, and computes a summary with `src/workoutSummary.js`.
3. `persist` writes the updated profile-scoped session array to localStorage immediately.
4. When authenticated, `saveCloudSession` in `src/firebase.js` asynchronously writes the individual session document to `users/{uid}/sessions/{id}`.

### Analytics Rendering

1. `src/screens/HomeScreen.jsx` and `src/screens/ProgressScreen.jsx` receive sessions and preferences from `App`.
2. They call pure selectors in `src/stats.js` and `src/trainingInsights.js`; `src/ProgressDashboard.jsx` composes the broader dashboard metrics.
3. React/Recharts components render derived values without mutating stored session data.

### Backup and Import

1. `src/App.jsx` serializes exports through `buildBackup` and parses selected JSON files.
2. `validateBackup` in `src/backup.js` validates container and nested record shapes, discarding malformed individual records while reporting counts.
3. The user-selected merge or replace path uses `mergeBackup` or `replaceBackup`, writes local storage, updates state, and pushes a cloud snapshot when authenticated.

**State Management:**
- Use React `useState`/`useRef` in `src/App.jsx` as the application store; there is no external state library or context layer.
- Persist durable profile/account data through named localStorage keys, not component-local storage calls scattered through screens.
- Treat `equipmentPrefs` as the account-scoped settings aggregate; it also contains progression, timer, custom-workout, goal, and dashboard preferences.
- Keep transient UI state (open sheets, confirmation targets, inputs, active exercise) in React only.

## Key Abstractions

**Workout Session and Draft:**
- Purpose: Represent a dated workout with exercises and tracked sets before and after completion.
- Examples: `src/draft.js`, `src/draftStorage.js`, `src/App.jsx`
- Pattern: Immutable object/array updates in React; pure constructors and validators outside the component.

**Exercise Family and Variant:**
- Purpose: Preserve stable exercise identities while selecting free-weight or machine variants and tracking each variant separately.
- Examples: `src/data/exercises.js`, `src/data/formGuide.js`, `src/exerciseTracking.js`
- Pattern: Static data registry plus lookup/resolution functions. Treat exercise names as persisted identifiers and do not rename them without migration.

**Profile Namespace:**
- Purpose: Isolate guest and authenticated user data on a device.
- Examples: storage key helpers in `src/App.jsx`, `src/equipmentPrefs.js`, `src/draftStorage.js`
- Pattern: Prefix plus profile/UID; authenticated data uses the Firebase UID as the local namespace.

**Cloud Snapshot:**
- Purpose: Normalize individual Firestore collections, settings, tombstones, and legacy documents into the local data shape.
- Examples: `src/firebase.js`, `src/cloudData.js`, `src/backup.js`
- Pattern: Adapter plus deterministic merge; individual writes for normal changes and batches (maximum 400 operations) for snapshot imports/migration.

**Reusable UI Primitive:**
- Purpose: Keep common interaction and visual behavior consistent across screens.
- Examples: `src/components/Button.jsx`, `src/components/Sheet.jsx`, `src/components/index.js`
- Pattern: Small presentational component with adjacent CSS and a barrel export.

## Entry Points

**Web Application:**
- Location: `index.html` and `src/main.jsx`
- Triggers: Vite development server or built `dist/index.html`.
- Responsibilities: Provide the root DOM node, load the module graph, initialize theme, and render the application.

**Application Component:**
- Location: `src/App.jsx`
- Triggers: React root render.
- Responsibilities: Load/persist data, coordinate sync and timers, own navigation, and compose all feature views.

**Service Worker:**
- Location: `public/sw.js`, registered by `src/pwa.js`
- Triggers: `PWAStatus` mount in a supported browser.
- Responsibilities: Cache the application shell and coordinate user-controlled updates.

**Android Host:**
- Location: `android/app/src/main/java/com/pocketgymlog/app/MainActivity.java`
- Triggers: Android application launch.
- Responsibilities: Host the Capacitor web view; native Firebase auth and local notification plugins bridge into shared JavaScript.

## Architectural Constraints

- **Threading:** React and browser code runs on the single UI event loop; Firestore, timers, storage, service-worker, and Capacitor calls are asynchronous. No worker-thread application logic exists.
- **Global state:** Module-level Firebase `app`, `auth`, and `db` singletons live in `src/firebase.js`; storage prefixes/constants live in `src/App.jsx` and helper modules. Mutable application state remains inside `App`.
- **Circular imports:** No circular dependency chain is detected. Keep domain modules directed toward lower-level date/data helpers and keep `App` as the top-level importer.
- **Offline-first writes:** Local writes must succeed independently of cloud availability; cloud failures set status but must not prevent local use.
- **Stable persisted identifiers:** Exercise names and profile-scoped key formats are storage contracts. Changes require explicit data migration.
- **Local calendar dates:** Construct training dates through `src/dateUtils.js`; do not derive them with UTC `toISOString()` slicing.
- **Platform branching:** Use `Capacitor.isNativePlatform()` before invoking native-only authentication or notification flows.

## Anti-Patterns

### Adding More Feature Logic to the App Monolith

**What happens:** New rendering, transformation, validation, storage, and integration behavior is implemented directly in the 1,458-line `src/App.jsx`.
**Why it's wrong:** It couples unrelated features to the central state container, makes render behavior harder to reason about, and prevents direct Node testing of logic.
**Do this instead:** Put pure rules in a focused `src/<feature>.js` module with a co-located test, put substantial views in `src/screens/` or a feature component, and leave `App` responsible for state and callback wiring.

### Bypassing Persistence Boundaries

**What happens:** A screen writes directly to arbitrary localStorage keys or Firebase collections.
**Why it's wrong:** Profile isolation, offline-first ordering, save status, reconciliation, and schema/tombstone behavior can diverge.
**Do this instead:** Route durable mutations through `App` callbacks and the existing helpers in `src/draftStorage.js`, `src/equipmentPrefs.js`, and `src/firebase.js`.

### Treating UTC Dates as Workout Dates

**What happens:** A calendar date is created with `new Date().toISOString().slice(0, 10)`.
**Why it's wrong:** Evening workouts can shift to the next day in timezones west of UTC.
**Do this instead:** Use `todayISO`, `localISO`, `parseLocalDate`, and `addDaysISO` from `src/dateUtils.js`.

## Error Handling

**Strategy:** Keep pure transformations total where practical, guard browser storage access, map integration failures to user-readable state, and isolate unrecoverable render failures at the root.

**Patterns:**
- `storage` in `src/App.jsx` catches localStorage exceptions and returns success/failure values.
- `src/backup.js` validates untrusted imports and returns `{ ok, data/error }` rather than throwing for bad input.
- `src/firebase.js` throws rejected promises for integration failures and wraps network operations in a 12-second timeout.
- `runCloud`/`firebaseErrorMessage` in `src/App.jsx` convert async failures to connection/error UI while logging diagnostic details.
- `src/ErrorBoundary.jsx` catches React render errors and presents recovery/reset actions.

## Cross-Cutting Concerns

**Logging:** Use `console.error` for caught runtime, PWA, and Firebase failures; there is no centralized telemetry service.
**Validation:** Validate imported/nested data in `src/backup.js`, draft data in `src/draftStorage.js`, and completed sets in `src/draft.js`/`src/App.jsx`; Firestore rules enforce owner-only paths.
**Authentication:** Firebase Google authentication is optional. Web uses popup auth, Android uses `@capacitor-firebase/authentication`, and all Firestore records are scoped beneath `users/{uid}` in `src/firebase.js` and `firestore.rules`.

---

*Architecture analysis: 2026-08-14*
