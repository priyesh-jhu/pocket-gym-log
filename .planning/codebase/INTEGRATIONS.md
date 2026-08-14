# External Integrations

**Analysis Date:** 2026-08-14

## APIs & External Services

**Firebase Platform:**
- Firebase Authentication - Optional Google account identity for browser and Android clients
  - SDK/Client: `firebase/auth` in `src/firebase.js`; `@capacitor-firebase/authentication` for the native credential flow
  - Auth: Firebase web-app configuration supplied through the `VITE_FIREBASE_*` variables; Android app registration supplied separately through `android/app/google-services.json`
- Cloud Firestore - Optional cross-device synchronization for workout sessions, bodyweights, equipment preferences, and account metadata
  - SDK/Client: `firebase/firestore` in `src/firebase.js`
  - Auth: Firebase Authentication UID; `firestore.rules` permits access only below the authenticated user's `users/{uid}` tree
- Firebase Hosting - Production static hosting and SPA routing
  - SDK/Client: Firebase CLI invoked manually as documented in `README.md`; it is not a package dependency
  - Auth: Developer Firebase CLI session outside the repository

**Google Identity:**
- Google Sign-In - Browser uses `signInWithPopup`; Android uses the Capacitor Firebase plugin to obtain an ID token, then signs into Firebase Web Auth with `signInWithCredential`
  - SDK/Client: `GoogleAuthProvider` from `firebase/auth` and `FirebaseAuthentication` from `@capacitor-firebase/authentication` in `src/firebase.js`
  - Auth: Google provider enabled in Firebase Console; Android builds also require registered SHA-1 certificates

**Device and Browser Services:**
- Rest completion alerts - Web Notifications and vibration are capability-gated in `src/restTimer.js`; native Android notifications use `@capacitor/local-notifications` in `src/App.jsx`
  - SDK/Client: Browser `Notification`/`navigator.vibrate` APIs and Capacitor `LocalNotifications`
  - Auth: Runtime notification permission requested from the user
- Offline application shell - The service worker in `public/sw.js` uses Cache Storage, network-first navigation, and cache-first static assets
  - SDK/Client: Browser Service Worker and Cache Storage APIs, registered by `src/pwa.js`
  - Auth: Not applicable

## Data Storage

**Databases:**
- Cloud Firestore (optional)
  - Connection: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, and `VITE_FIREBASE_APP_ID`
  - Client: Firebase modular Web SDK in `src/firebase.js`
  - Schema: `users/{uid}/sessions/{encodedSessionId}`, `users/{uid}/bodyweights/{encodedDate}`, and `users/{uid}/settings/main`; legacy `users/{uid}/profiles/{main|default}` documents are read only for migration
  - Deletion model: tombstone documents with `deleted: true`; bulk writes are split below Firestore's batch ceiling in `src/firebase.js`

**File Storage:**
- No external object/file storage is used; the Firebase `storageBucket` value is part of app initialization but no Firebase Storage SDK calls are detected
- User-controlled JSON backup/restore is implemented locally through `src/backup.js` and wired to browser download/upload behavior in `src/App.jsx`

**Local Persistence:**
- Browser `localStorage` is the primary offline store and is accessed through guarded wrappers in `src/App.jsx`; data remains available when Firebase is absent or unreachable
- Keys are scoped between guest and authenticated users; exercise names are persistent history identifiers, as documented in `README.md`
- Cache Storage holds the PWA shell and fetched static assets through `public/sw.js`

**Caching:**
- Browser Cache Storage only; `public/sw.js` versions caches from `package.json`, removes obsolete caches on activation, uses network-first navigation, and cache-first static assets
- No Redis, CDN API client, or application data cache is detected

## Authentication & Identity

**Auth Provider:**
- Firebase Authentication with Google as the only configured identity provider
  - Implementation: `observeAuth` subscribes to auth state in `src/firebase.js`; web sign-in opens a Google popup, while Android exchanges a native Google token for a Firebase credential
  - Authorization: `firestore.rules` compares `request.auth.uid` to the path's `{userId}`
  - Signed-out behavior: guest data stays local and isolated; it is not automatically merged into a Google account

## Monitoring & Observability

**Error Tracking:**
- None detected; no Sentry, Crashlytics, analytics, or remote telemetry SDK is imported

**Logs:**
- User-facing cloud/auth failures are normalized in `src/App.jsx`, and cloud operations have a 12-second timeout in `src/firebase.js`
- `src/ErrorBoundary.jsx` catches React render failures and offers local recovery/export behavior
- Firebase CLI can produce local `firebase-debug.log`; treat it as a development artifact, not an observability pipeline

## CI/CD & Deployment

**Hosting:**
- Firebase Hosting serves `dist/`; project alias configuration is in `.firebaserc`, while routing and cache headers are in `firebase.json`
- Android delivery is a Capacitor app built as an APK/AAB through Android Studio from `android/`

**CI Pipeline:**
- None detected; no GitHub Actions or other CI workflow is present
- Deployment is manual: build with `npm run build`, then deploy Hosting and Firestore rules with the Firebase CLI as documented in `README.md`

## Environment Configuration

**Required env vars:**
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

All six are optional for purely local/guest use but collectively required to enable Firebase initialization in `src/firebase.js`.

**Secrets location:**
- Web Firebase configuration is expected in uncommitted `.env.local`; `.env.example` exists as a setup template. Never read or reproduce values from either environment file in generated documentation
- Native Firebase configuration is expected at ignored `android/app/google-services.json`
- Android signing keystore and passwords are kept outside the repository, per `README.md`
- Firebase CLI login state is stored outside the repository by the CLI

## Webhooks & Callbacks

**Incoming:**
- None; this is a static client application with no server endpoints or webhook receiver
- Browser callbacks include Firebase auth-state changes, service-worker lifecycle/fetch events, connectivity changes, install prompts, and notification permission responses

**Outgoing:**
- No application-defined webhooks
- Firebase SDK requests provide authentication and Firestore synchronization; service-worker fetches retrieve the hosted application shell and static assets

---

*Integration audit: 2026-08-14*
