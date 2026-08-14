# Technology Stack

**Analysis Date:** 2026-08-14

## Languages

**Primary:**
- JavaScript (ECMAScript modules, JSX) - React UI and application logic in `src/`; Node-based tests in `src/*.test.js`; service worker in `public/sw.js`

**Secondary:**
- CSS - Global, design-token, screen, and component styling in `src/index.css`, `src/design/`, `src/screens/`, and `src/components/`
- Groovy/Gradle DSL - Android build configuration in `android/*.gradle` and `android/app/*.gradle`
- Firestore Security Rules - Per-user database authorization in `firestore.rules`
- JSON - npm, Vite/Capacitor, Firebase Hosting, PWA manifest, and Android bridge configuration in `package.json`, `capacitor.config.json`, `firebase.json`, and `public/manifest.webmanifest`

## Runtime

**Environment:**
- Browser/PWA runtime - Main delivery target; relies on DOM, Web Storage, Cache Storage, Service Worker, Notifications, and vibration APIs
- Node.js `^20.19.0 || >=22.12.0` - Build/test runtime required by the installed Vite 8 line; the mapped environment uses Node.js 20.19.0
- Android API 23+ - Native wrapper under `android/`, compiled and targeted against API 35
- Capacitor 7.6.8 - Hosts the same built web application inside Android

**Package Manager:**
- npm 10.8.2 in the mapped environment; use npm scripts from `package.json`
- Lockfile: present at `package-lock.json` (lockfile version 3)

## Frameworks

**Core:**
- React 19.2.x - Component UI and hooks-based application state, mounted by `src/main.jsx`
- React DOM 19.2.x - Browser rendering through `createRoot` in `src/main.jsx`
- Capacitor 7.6.8 - Android packaging and native-platform detection through `capacitor.config.json`, `android/`, and `src/pwa.js`
- Firebase Web SDK 11.10.0 - Google authentication and Cloud Firestore access in `src/firebase.js`

**Testing:**
- Node.js built-in test runner - Unit tests use `node:test` and `node:assert/strict`; `npm test` runs `node --test src`
- Android JUnit 4.13.2 / AndroidX Test 1.2.1 / Espresso 3.6.1 - Native test dependencies declared in `android/variables.gradle` and `android/app/build.gradle`; no native test sources are detected

**Build/Dev:**
- Vite 8.0.x - Development server and production bundling through `vite.config.js`
- `@vitejs/plugin-react` 6.0.x - JSX/React integration in `vite.config.js`
- ESLint 10.3.x - Static analysis configured by `eslint.config.js`
- Gradle 8.11.1 with Android Gradle Plugin 8.7.2 - Android build chain in `android/gradle/wrapper/gradle-wrapper.properties` and `android/build.gradle`

## Key Dependencies

**Critical:**
- `firebase` 11.10.0 - Initializes Firebase Auth and Firestore, performs UID-scoped reads/writes, and timestamps cloud records in `src/firebase.js`
- `@capacitor-firebase/authentication` 7.5.0 - Obtains Google credentials in the native Android flow before handing them to Firebase Web Auth in `src/firebase.js`
- `@capacitor/local-notifications` 7.0.7 - Schedules and cancels native rest-timer notifications in `src/App.jsx`
- `recharts` 3.8.x - Progress and analytics charts in `src/App.jsx` and `src/ProgressDashboard.jsx`
- `lucide-react` 1.31.x - UI icon set used throughout `src/App.jsx`, `src/screens/`, and `src/components/`
- `@fontsource-variable/manrope` 5.3.x - Bundled application typeface imported by `src/main.jsx`

**Infrastructure:**
- Firebase Hosting - Serves `dist/`, rewrites routes to `index.html`, and applies immutable caching to fingerprinted assets via `firebase.json`
- Cloud Firestore - Optional remote persistence with user-owned collections and rules in `firestore.rules`
- Firebase Authentication - Google sign-in for browser and Android clients through `src/firebase.js`
- Capacitor Android 7.6.8 - Native project dependency in `android/` with app ID `com.pocketgymlog.app`

## Configuration

**Environment:**
- Supply the six `VITE_FIREBASE_*` build-time variables referenced in `src/firebase.js`; Firebase features remain disabled when any value is absent
- Keep local values in `.env.local` and document placeholders in `.env.example`; both files exist, and secret values must not be copied into source or planning documents
- Native Google sign-in additionally requires an untracked `android/app/google-services.json`, as documented in `README.md` and conditionally loaded by `android/app/build.gradle`

**Build:**
- `vite.config.js` enables React, deduplicates React packages, and creates separate Firebase, charts, and React chunks
- `package.json` provides dev, build, preview, lint, unit-test, timezone-test, and Android sync/open/run scripts
- `capacitor.config.json` points the Android shell at `dist/` and configures Google as the native Firebase Authentication provider
- `firebase.json` deploys `dist/` as a single-page app and publishes `firestore.rules`
- `android/variables.gradle` fixes minimum SDK 23 and compile/target SDK 35; `android/build.gradle` configures Google and Maven Central repositories

## Platform Requirements

**Development:**
- Use Node.js 20.19+ (or 22.12+) and npm; install from `package-lock.json` for reproducible JavaScript dependencies
- Use a modern browser for PWA development; notification, vibration, and install-prompt behavior is capability-gated
- Use Android Studio with its bundled JDK, Android SDK 35, and `android/app/google-services.json` for Android builds with Google sign-in
- Run `npm test`, `npm run test:tz`, `npm run lint`, and `npm run build` from the repository root; timezone-sensitive tests exercise multiple `TZ` values

**Production:**
- Web: static Vite output in `dist/`, configured for Firebase Hosting by `firebase.json`
- PWA: HTTPS-capable host with root-level `sw.js` and manifest assets from `public/`
- Android: Capacitor application ID `com.pocketgymlog.app`, minimum Android API 23; signed release bundles are generated through Android Studio

---

*Stack analysis: 2026-08-14*
