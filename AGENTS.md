<!-- GSD:project-start source:PROJECT.md -->

## Project

**Pocket Gym Log — Modern Android Redesign Completion**

Pocket Gym Log is an offline-first workout tracker delivered as a React web/PWA application and a Capacitor Android app. It supports focused workout logging, history, progress analytics, weight tracking, Google sign-in, and optional Firebase synchronization. This milestone completes the already-approved modern Android-first visual and structural redesign without expanding the product feature set.

**Core Value:** Users can reliably log and review workouts through a sleek, coherent, phone-first Android experience without losing any existing data or behavior.

### Constraints

- **Architecture**: Follow the approved `src/design/`, `src/components/`, `src/screens/`, and `src/charts/` structure; keep domain logic outside React screens.
- **Styling**: Use design tokens and shared primitives with no hard-coded screen colors, no new inline-style system, and no `!important` specificity workaround.
- **Behavior preservation**: Do not regress authentication, Firebase sync, offline persistence, drafts, timers, past-date logging, imports/exports, analytics, or navigation.
- **Compatibility**: Retain React 19, Vite 8, Capacitor 7, Android API 23+, and the existing Firebase integration.
- **Phone-first UI**: Optimize and manually verify 360px and 390px phone widths in both themes; larger viewports use the centered narrow-column treatment.
- **Accessibility**: Preserve at least 48dp interactive targets, meaningful labels, theme contrast, reduced-motion handling, and keyboard-accessible web behavior.
- **Verification**: `npm test`, timezone tests, production build, lint, responsive theme review, and Android-device checks gate completion.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- JavaScript (ECMAScript modules, JSX) - React UI and application logic in `src/`; Node-based tests in `src/*.test.js`; service worker in `public/sw.js`
- CSS - Global, design-token, screen, and component styling in `src/index.css`, `src/design/`, `src/screens/`, and `src/components/`
- Groovy/Gradle DSL - Android build configuration in `android/*.gradle` and `android/app/*.gradle`
- Firestore Security Rules - Per-user database authorization in `firestore.rules`
- JSON - npm, Vite/Capacitor, Firebase Hosting, PWA manifest, and Android bridge configuration in `package.json`, `capacitor.config.json`, `firebase.json`, and `public/manifest.webmanifest`

## Runtime

- Browser/PWA runtime - Main delivery target; relies on DOM, Web Storage, Cache Storage, Service Worker, Notifications, and vibration APIs
- Node.js `^20.19.0 || >=22.12.0` - Build/test runtime required by the installed Vite 8 line; the mapped environment uses Node.js 20.19.0
- Android API 23+ - Native wrapper under `android/`, compiled and targeted against API 35
- Capacitor 7.6.8 - Hosts the same built web application inside Android
- npm 10.8.2 in the mapped environment; use npm scripts from `package.json`
- Lockfile: present at `package-lock.json` (lockfile version 3)

## Frameworks

- React 19.2.x - Component UI and hooks-based application state, mounted by `src/main.jsx`
- React DOM 19.2.x - Browser rendering through `createRoot` in `src/main.jsx`
- Capacitor 7.6.8 - Android packaging and native-platform detection through `capacitor.config.json`, `android/`, and `src/pwa.js`
- Firebase Web SDK 11.10.0 - Google authentication and Cloud Firestore access in `src/firebase.js`
- Node.js built-in test runner - Unit tests use `node:test` and `node:assert/strict`; `npm test` runs `node --test src`
- Android JUnit 4.13.2 / AndroidX Test 1.2.1 / Espresso 3.6.1 - Native test dependencies declared in `android/variables.gradle` and `android/app/build.gradle`; no native test sources are detected
- Vite 8.0.x - Development server and production bundling through `vite.config.js`
- `@vitejs/plugin-react` 6.0.x - JSX/React integration in `vite.config.js`
- ESLint 10.3.x - Static analysis configured by `eslint.config.js`
- Gradle 8.11.1 with Android Gradle Plugin 8.7.2 - Android build chain in `android/gradle/wrapper/gradle-wrapper.properties` and `android/build.gradle`

## Key Dependencies

- `firebase` 11.10.0 - Initializes Firebase Auth and Firestore, performs UID-scoped reads/writes, and timestamps cloud records in `src/firebase.js`
- `@capacitor-firebase/authentication` 7.5.0 - Obtains Google credentials in the native Android flow before handing them to Firebase Web Auth in `src/firebase.js`
- `@capacitor/local-notifications` 7.0.7 - Schedules and cancels native rest-timer notifications in `src/App.jsx`
- `recharts` 3.8.x - Progress and analytics charts in `src/App.jsx` and `src/ProgressDashboard.jsx`
- `lucide-react` 1.31.x - UI icon set used throughout `src/App.jsx`, `src/screens/`, and `src/components/`
- `@fontsource-variable/manrope` 5.3.x - Bundled application typeface imported by `src/main.jsx`
- Firebase Hosting - Serves `dist/`, rewrites routes to `index.html`, and applies immutable caching to fingerprinted assets via `firebase.json`
- Cloud Firestore - Optional remote persistence with user-owned collections and rules in `firestore.rules`
- Firebase Authentication - Google sign-in for browser and Android clients through `src/firebase.js`
- Capacitor Android 7.6.8 - Native project dependency in `android/` with app ID `com.pocketgymlog.app`

## Configuration

- Supply the six `VITE_FIREBASE_*` build-time variables referenced in `src/firebase.js`; Firebase features remain disabled when any value is absent
- Keep local values in `.env.local` and document placeholders in `.env.example`; both files exist, and secret values must not be copied into source or planning documents
- Native Google sign-in additionally requires an untracked `android/app/google-services.json`, as documented in `README.md` and conditionally loaded by `android/app/build.gradle`
- `vite.config.js` enables React, deduplicates React packages, and creates separate Firebase, charts, and React chunks
- `package.json` provides dev, build, preview, lint, unit-test, timezone-test, and Android sync/open/run scripts
- `capacitor.config.json` points the Android shell at `dist/` and configures Google as the native Firebase Authentication provider
- `firebase.json` deploys `dist/` as a single-page app and publishes `firestore.rules`
- `android/variables.gradle` fixes minimum SDK 23 and compile/target SDK 35; `android/build.gradle` configures Google and Maven Central repositories

## Platform Requirements

- Use Node.js 20.19+ (or 22.12+) and npm; install from `package-lock.json` for reproducible JavaScript dependencies
- Use a modern browser for PWA development; notification, vibration, and install-prompt behavior is capability-gated
- Use Android Studio with its bundled JDK, Android SDK 35, and `android/app/google-services.json` for Android builds with Google sign-in
- Run `npm test`, `npm run test:tz`, `npm run lint`, and `npm run build` from the repository root; timezone-sensitive tests exercise multiple `TZ` values
- Web: static Vite output in `dist/`, configured for Firebase Hosting by `firebase.json`
- PWA: HTTPS-capable host with root-level `sw.js` and manifest assets from `public/`
- Android: Capacitor application ID `com.pocketgymlog.app`, minimum Android API 23; signed release bundles are generated through Android Studio

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- Use camelCase `.js` names for domain utilities and matching colocated tests: `src/dateUtils.js` and `src/dateUtils.test.js`, `src/workoutSummary.js` and `src/workoutSummary.test.js`.
- Use PascalCase `.jsx` names for React components and screens: `src/ErrorBoundary.jsx`, `src/components/Sheet.jsx`, and `src/screens/HomeScreen.jsx`.
- Pair component styles by basename in the same directory, such as `src/components/Button.jsx` with `src/components/Button.css`.
- Use lowercase directory names organized by role: `src/components/`, `src/screens/`, `src/charts/`, `src/data/`, and `src/design/`.
- Use camelCase verbs for functions (`loadPrefs`, `createWorkoutSummary`, `reconcileCloudData`) and `use...` for hooks (`src/charts/useThemeTokens.js`).
- Name event handlers and callbacks for their action (`onClose`, `requestSessionExit`, `signInWithGoogle`).
- Use short local factory names only inside tests (`mkSet`, `mkSession`, `fakeStorage`).
- Use camelCase for local values and state (`activeProfile`, `equipmentPrefs`, `restSeconds`).
- Use uppercase snake case for module constants and storage keys (`TRACKING_TYPES`, `REST_TIMER_OPTIONS`, `CUSTOM_EXERCISES_KEY`).
- Use descriptive boolean names or predicates (`firebaseConfigured`, `draftHasContent`, `isCompleteSet`).
- The project is JavaScript, not TypeScript; object shapes are implicit in data and functions. Preserve established record keys such as `date`, `day`, `exercises`, `sets`, `weight`, `reps`, and `unit`.
- Use PascalCase for classes and React components (`ErrorBoundary`, `BrokenNotification`, `NotificationApi`).
- Treat persisted exercise names as stable identifiers. `src/data/exercises.test.js` freezes them because renaming orphans user history.

## Code Style

- No formatter configuration is present. Match the surrounding file rather than applying a repository-wide reformat.
- The dominant readable style uses two-space indentation, semicolons, double-quoted strings, spaces inside object literals, and spaces around operators; examples are `src/dateUtils.js`, `src/backup.js`, and `src/equipmentPrefs.test.js`.
- Some newer utility and test code is deliberately compact (`src/exerciseTracking.js`, `src/trainingInsights.test.js`, portions of `src/App.jsx`). Do not propagate dense one-line formatting into otherwise expanded files.
- Keep JSX props spaced and component bodies readable as in `src/components/Sheet.jsx` and `src/screens/HomeScreen.jsx`.
- Run ESLint 10 through `npm run lint`; configuration is `eslint.config.js`.
- Apply `@eslint/js` recommended rules, React Hooks flat recommended rules, and Vite React Refresh rules to all `.js` and `.jsx` files.
- Browser globals are available to source files; Node globals are additionally enabled for `**/*.test.{js,jsx}`.
- Unused variables are errors, except unused rest siblings. Use targeted disable comments only when a hook dependency is intentionally excluded, as in `src/App.jsx`.
- Generated output in `dist/` and `android/app/src/main/assets/public/` is ignored by lint.

## Import Organization

- No source path aliases are configured. Use relative paths such as `./dateUtils.js` and `../package.json`.
- Include `.js` or `.jsx` extensions in local ESM imports.
- Components may use the barrel at `src/components/index.js`; domain utilities are imported directly from their defining module.

## Error Handling

- Make local-storage and optional-device behavior best effort: catch access failures and return safe sentinels (`null`, `{}`, or `false`) in `src/equipmentPrefs.js`, `src/draftStorage.js`, and `src/design/theme.js`.
- Prefer total domain functions for untrusted persisted/imported data. `src/backup.js` returns `{ ok, data, error }` results and filters malformed records rather than throwing.
- Throw actionable errors when a required external integration cannot operate, such as missing Firebase configuration in `src/firebase.js`; catch these at the UI boundary in `src/App.jsx`, log the original error, and update visible status.
- Use promise `.catch(...)` for fire-and-forget asynchronous work such as service worker registration in `src/pwa.js` and cloud writes in `src/App.jsx`.
- Keep React’s final safety net in `src/ErrorBoundary.jsx`; do not let malformed persisted data permanently blank the app.

## Logging

- Use `console.error` only at integration or render boundaries where failures require diagnosis (`src/App.jsx`, `src/pwa.js`, `src/ErrorBoundary.jsx`).
- Keep pure domain utilities silent; communicate expected invalid input through return values.
- Do not log routine state changes, user data, Firebase configuration, or storage payloads.

## Comments

- Explain invariants and non-obvious failure modes: local calendar dates must not use UTC conversion in `src/dateUtils.js`; imported shapes must protect downstream rendering in `src/backup.js`; React and persisted storage must stay synchronized in `src/App.jsx`.
- Use comments to record why a workaround or constraint exists, not to narrate obvious syntax.
- Section banners are accepted in large modules such as `src/App.jsx`, `src/stats.js`, and `src/backup.js`.
- Use short JSDoc summaries for exported or subtle pure functions, as in `src/stats.js`, `src/dateUtils.js`, and `src/cloudData.js`.
- Formal `@param`/`@returns` annotations are not established. Keep documentation concise unless an implicit object shape would otherwise be ambiguous.

## Function Design

- Pass dependencies explicitly when behavior must be testable without browser/native APIs, as `announceRestComplete({ NotificationApi, navigatorApi, isNative })` does in `src/restTimer.js`.
- Use options objects for related optional inputs and defaults (`registerWorkoutPWA({ onUpdate } = {})`, `saveCloudSnapshot(uid, data, { replace = false } = {})`).
- Accept deterministic time/date parameters where output depends on time (`todayISO(now)`, analytics `todayIso`, storage `now`).
- Default absent collections/objects defensively when callers may supply partial data.
- Do not mutate caller-owned domain objects. Return new objects/arrays for updates, merges, and preferences; tests in `src/equipmentPrefs.test.js` and `src/customWorkouts.test.js` enforce this.
- Return explicit sentinels for expected absence (`null`, `[]`, `{}`, `false`) and structured result objects when callers need error details.
- Normalize calculations and persisted records before returning them so rendering code receives stable shapes.

## Module Design

- Use named exports for domain constants and pure functions. Use default exports for React components and screens.
- Keep browser/Firebase side effects behind exported functions; importing a domain module should not mutate state.
- Keep data definitions and their lookup helpers together in `src/data/exercises.js` and `src/data/formGuide.js`.
- `src/components/index.js` is the only established barrel. Add reusable UI primitives there when they are intended for app-wide consumption.
- Import domain modules directly; do not introduce a broad `src/index.js` barrel.

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

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

- `src/App.jsx` is the composition root and state owner; screens are controlled views receiving data and event callbacks.
- Domain calculations are plain ES modules with no React or storage dependency, which keeps them directly testable with Node's test runner.
- Local storage is authoritative for immediate/offline use; authenticated Firestore operations are asynchronous mirrors and cloud data is reconciled into local state.
- The same compiled web application runs in browsers/PWA and inside the generated Capacitor Android shell.
- No client-side router is used; `activeTab` and `sessionActive` select views inside `App`, with browser history used only to intercept back navigation during an active workout.

## Layers

- Purpose: Start the React application and expose it as web, installable PWA, Firebase-hosted SPA, and Android app.
- Location: `src/main.jsx`, `src/pwa.js`, `src/PWAStatus.jsx`, `public/`, `firebase.json`, `capacitor.config.json`, `android/`
- Contains: Root mounting, theme/PWA initialization, service-worker assets, hosting rules, and native wrapper configuration.
- Depends on: React, Vite output, Capacitor, Firebase Hosting.
- Used by: Browser and Android runtime entry points.
- Purpose: Render tabs, workout entry, history, progress, weight, settings, dialogs, and reusable controls.
- Location: `src/App.jsx`, `src/screens/`, `src/components/`, `src/ProgressDashboard.jsx`, `src/MuscleHeatmap.jsx`
- Contains: React components, hooks, controlled inputs, inline workout UI, and component-scoped CSS.
- Depends on: Domain modules, chart/theme helpers, icon and chart libraries.
- Used by: `src/main.jsx`.
- Purpose: Encode workout rules and compute derived results independent of UI and persistence.
- Location: `src/*.js`, `src/data/`
- Contains: Draft/session construction, exercise catalog, form guides, statistics, progression, summaries, goals, backup transformations, and date handling.
- Depends on: Other pure domain/data modules only; keep calendar-date construction centralized in `src/dateUtils.js`.
- Used by: `src/App.jsx`, screens, dashboards, and co-located tests.
- Purpose: Persist state immediately on-device and optionally synchronize it to per-user cloud collections.
- Location: `src/App.jsx`, `src/draftStorage.js`, `src/equipmentPrefs.js`, `src/firebase.js`, `src/cloudData.js`, `src/backup.js`
- Contains: Namespaced keys, guarded storage calls, draft autosave, JSON import/export, Firebase auth, Firestore CRUD, tombstones, timeouts, and legacy migration.
- Depends on: Browser storage APIs and Firebase SDKs.
- Used by: Application orchestration in `src/App.jsx`.

## Data Flow

### Application Startup and Cloud Reconciliation

### Workout Save

### Analytics Rendering

### Backup and Import

- Use React `useState`/`useRef` in `src/App.jsx` as the application store; there is no external state library or context layer.
- Persist durable profile/account data through named localStorage keys, not component-local storage calls scattered through screens.
- Treat `equipmentPrefs` as the account-scoped settings aggregate; it also contains progression, timer, custom-workout, goal, and dashboard preferences.
- Keep transient UI state (open sheets, confirmation targets, inputs, active exercise) in React only.

## Key Abstractions

- Purpose: Represent a dated workout with exercises and tracked sets before and after completion.
- Examples: `src/draft.js`, `src/draftStorage.js`, `src/App.jsx`
- Pattern: Immutable object/array updates in React; pure constructors and validators outside the component.
- Purpose: Preserve stable exercise identities while selecting free-weight or machine variants and tracking each variant separately.
- Examples: `src/data/exercises.js`, `src/data/formGuide.js`, `src/exerciseTracking.js`
- Pattern: Static data registry plus lookup/resolution functions. Treat exercise names as persisted identifiers and do not rename them without migration.
- Purpose: Isolate guest and authenticated user data on a device.
- Examples: storage key helpers in `src/App.jsx`, `src/equipmentPrefs.js`, `src/draftStorage.js`
- Pattern: Prefix plus profile/UID; authenticated data uses the Firebase UID as the local namespace.
- Purpose: Normalize individual Firestore collections, settings, tombstones, and legacy documents into the local data shape.
- Examples: `src/firebase.js`, `src/cloudData.js`, `src/backup.js`
- Pattern: Adapter plus deterministic merge; individual writes for normal changes and batches (maximum 400 operations) for snapshot imports/migration.
- Purpose: Keep common interaction and visual behavior consistent across screens.
- Examples: `src/components/Button.jsx`, `src/components/Sheet.jsx`, `src/components/index.js`
- Pattern: Small presentational component with adjacent CSS and a barrel export.

## Entry Points

- Location: `index.html` and `src/main.jsx`
- Triggers: Vite development server or built `dist/index.html`.
- Responsibilities: Provide the root DOM node, load the module graph, initialize theme, and render the application.
- Location: `src/App.jsx`
- Triggers: React root render.
- Responsibilities: Load/persist data, coordinate sync and timers, own navigation, and compose all feature views.
- Location: `public/sw.js`, registered by `src/pwa.js`
- Triggers: `PWAStatus` mount in a supported browser.
- Responsibilities: Cache the application shell and coordinate user-controlled updates.
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

### Bypassing Persistence Boundaries

### Treating UTC Dates as Workout Dates

## Error Handling

- `storage` in `src/App.jsx` catches localStorage exceptions and returns success/failure values.
- `src/backup.js` validates untrusted imports and returns `{ ok, data/error }` rather than throwing for bad input.
- `src/firebase.js` throws rejected promises for integration failures and wraps network operations in a 12-second timeout.
- `runCloud`/`firebaseErrorMessage` in `src/App.jsx` convert async failures to connection/error UI while logging diagnostic details.
- `src/ErrorBoundary.jsx` catches React render errors and presents recovery/reset actions.

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
