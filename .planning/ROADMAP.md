# Roadmap: Pocket Gym Log — Modern Android Redesign Completion

## Overview

This milestone finishes the approved Android-first redesign from its current brownfield state. It first completes the remaining Progress migration, then gives History and Weight dedicated Material-styled screens without changing persistence behavior, and finally removes replaced legacy UI while verifying the complete phone experience across themes, widths, web quality gates, and Android-native flows.

## Phases

- [ ] **Phase 1: Progress Completion** - Finish the deep-dive analytics experience on the shared Material design system.
- [ ] **Phase 2: History and Weight Screens** - Deliver dedicated History and Weight destinations with existing edit, delete, offline, and sync behavior intact.
- [ ] **Phase 3: Redesign Cleanup and Android Verification** - Remove replaced legacy presentation code and prove the complete redesigned experience across supported phone and Android scenarios.

## Phase Details

### Phase 1: Progress Completion
**Goal**: Users can use the complete Progress dashboard through coherent, accessible Material controls and correctly themed visualizations.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: [PROG-01, PROG-02, PROG-03]
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. Users can review e1RM progression, daily workout trends, body heatmaps, muscle guidance, group balance, and push/pull ratio in the Progress destination.
  2. Users can change analytics ranges and dashboard customization through accessible Material controls and sheets.
  3. Progress charts, labels, states, and controls remain legible and coherent when switching between light and dark themes.
**Plans**: TBD

### Phase 2: History and Weight Screens
**Goal**: Users can manage workout history and weigh-ins through dedicated Material-styled destinations with all existing data behavior preserved.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: [HIST-01, HIST-02, WGHT-01, WGHT-02, ARCH-01]
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. Users can browse historical workout sessions from the dedicated History destination and inspect each session's existing details.
  2. Users can edit or delete historical workouts with the existing confirmation and offline-first persistence behavior intact.
  3. Users can add and browse weigh-ins from the dedicated Weight destination.
  4. Users can edit or delete weigh-ins and see those changes persist locally and synchronize through Firebase when signed in.
**Plans**: TBD

### Phase 3: Redesign Cleanup and Android Verification
**Goal**: Users can rely on one coherent, regression-free phone experience across every redesigned destination and supported Android interaction.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: [ARCH-02, ARCH-03, VERI-01, VERI-02, VERI-03]
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. Users encounter one tokenized implementation of each redesigned control and flow, with no hidden duplicate session interface or obsolete legacy styling affecting the experience.
  2. Home, History, Progress, Weight, Settings, and workout session mode remain usable at 360px and 390px in both light and dark themes.
  3. Android users can use safe-area layouts, theme-aware status bars, hardware back, Google sign-in, rest notifications, and primary start/resume/log/finish flows without regressions.
  4. Existing tests, timezone checks, the production build, and redesign-relevant lint checks pass after cleanup.
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Progress Completion | 0/TBD | Not started | - |
| 2. History and Weight Screens | 0/TBD | Not started | - |
| 3. Redesign Cleanup and Android Verification | 0/TBD | Not started | - |

---
*Roadmap created: 2026-08-14*
