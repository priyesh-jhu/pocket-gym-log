# Pocket Gym Log — Modern Android Redesign Completion

## What This Is

Pocket Gym Log is an offline-first workout tracker delivered as a React web/PWA application and a Capacitor Android app. It supports focused workout logging, history, progress analytics, weight tracking, Google sign-in, and optional Firebase synchronization. This milestone completes the already-approved modern Android-first visual and structural redesign without expanding the product feature set.

## Core Value

Users can reliably log and review workouts through a sleek, coherent, phone-first Android experience without losing any existing data or behavior.

## Requirements

### Validated

- ✓ Users can log workouts with exercise variants, sets, reps, weight, completion state, notes, rest timers, and draft recovery — existing
- ✓ Users can save workouts offline and optionally synchronize owner-scoped data through Firebase — existing
- ✓ Users can browse workout history, track weigh-ins, import/export backups, and manage preferences — existing
- ✓ Users can review volume, streak, record, muscle, balance, calendar, trend, and e1RM analytics — existing
- ✓ The application runs as a browser app, installable PWA, Firebase-hosted SPA, and Capacitor Android application — existing
- ✓ The redesign foundation provides theme tokens, self-hosted Manrope, light/dark themes, Material-inspired primitives, AppBar, NavBar, and Settings — existing redesign work
- ✓ Home and focused workout-session experiences substantially use the new Android-first design system — existing redesign work
- ✓ Users can review the complete Progress dashboard through accessible Material controls, responsive phone layouts, and live light/dark visualizations — validated in Phase 1: Progress Completion

### Active

- [ ] Extract and restyle History and Weight as dedicated screen components while preserving behavior
- [ ] Remove hidden duplicate session UI, obsolete inline styles, dead CSS, and legacy `!important` overrides after parity checks
- [ ] Keep `App.jsx` focused on state, persistence, routing, and callback wiring rather than substantial screen rendering
- [ ] Verify every redesigned screen in light and dark themes at 360px and 390px widths
- [ ] Verify safe areas, theme/status-bar behavior, hardware back, native Google sign-in, notifications, and primary workout flows on Android
- [ ] Keep the existing build and test suite green and resolve redesign-related lint failures

### Out of Scope

- New workout, analytics, social, coaching, or account features — this milestone completes the approved redesign only
- Firebase schema, sync, backup/import, draft-storage, progression, service-worker, exercise catalog, or muscle-model changes — existing data behavior must remain stable
- Security hardening or data-encryption initiatives — valuable future work, but separate from presentation completion
- Tablet layouts, desktop navigation rails, or multiple responsive form factors — the approved target is one phone layout centered on larger screens
- Material You dynamic color, a third-party component library, Tailwind, or a new styling dependency — the approved architecture uses CSS tokens and hand-built primitives
- Deployment, publishing, or store release work — performed only under a separate explicit request

## Context

- The redesign contract is `../docs/superpowers/specs/2026-08-14-android-redesign-design.md`; its sequencing and architectural decisions remain authoritative.
- Foundation, Home, Session, Settings, and Progress now use the Android-first design system. History and Weight remain embedded in `src/App.jsx` for Phase 2.
- `src/App.jsx` remains the stateful composition root and is still oversized. Durable mutations must continue through its existing persistence callbacks and adapters.
- The app is offline-first: local writes must work independently of Firebase availability, with cloud synchronization remaining an optional mirror.
- Exercise names, local-storage namespaces, Firestore paths, and local calendar dates are persisted contracts and must not change during visual migration.
- The existing codebase map in `.planning/codebase/` documents architecture, conventions, integrations, testing, and known concerns.
- Dedicated component and screen UI tests were explicitly excluded from the approved redesign; existing unit tests, timezone checks, build/lint checks, and manual phone/device verification provide the acceptance gates.

## Constraints

- **Architecture**: Follow the approved `src/design/`, `src/components/`, `src/screens/`, and `src/charts/` structure; keep domain logic outside React screens.
- **Styling**: Use design tokens and shared primitives with no hard-coded screen colors, no new inline-style system, and no `!important` specificity workaround.
- **Behavior preservation**: Do not regress authentication, Firebase sync, offline persistence, drafts, timers, past-date logging, imports/exports, analytics, or navigation.
- **Compatibility**: Retain React 19, Vite 8, Capacitor 7, Android API 23+, and the existing Firebase integration.
- **Phone-first UI**: Optimize and manually verify 360px and 390px phone widths in both themes; larger viewports use the centered narrow-column treatment.
- **Accessibility**: Preserve at least 48dp interactive targets, meaningful labels, theme contrast, reduced-motion handling, and keyboard-accessible web behavior.
- **Verification**: `npm test`, timezone tests, production build, lint, responsive theme review, and Android-device checks gate completion.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Limit this milestone to completing the modern Android redesign | Prevent feature and infrastructure scope from obscuring a partially completed visual migration | — Pending |
| Preserve the approved Material 3 structure with a custom dark/light fitness palette | Existing foundation and implemented screens already rely on these tokens and primitives | ✓ Good |
| Continue using hand-built CSS-token primitives instead of adding a UI framework | Avoid bundle cost and inconsistency while finishing the established architecture | ✓ Good |
| Keep one Android-first phone layout centered on desktop | Matches the approved design and the app's small-user, workout-in-hand use case | — Pending |
| Preserve all existing persistence and domain behavior during screen extraction | The redesign is presentation and information architecture work, not a data migration | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-14 after Phase 1 completion*
