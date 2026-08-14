# Requirements: Pocket Gym Log — Modern Android Redesign Completion

**Defined:** 2026-08-14
**Core Value:** Users can reliably log and review workouts through a sleek, coherent, phone-first Android experience without losing any existing data or behavior.

## v1 Requirements

### Progress

- [ ] **PROG-01**: Users can view e1RM progression, daily workout trends, body heatmaps, muscle guidance, group balance, and push/pull ratio through the shared Material design system.
- [ ] **PROG-02**: Users can change analytics ranges and customization settings through accessible Material controls and sheets.
- [ ] **PROG-03**: Progress visualizations remain legible and correctly themed in light and dark modes without hard-coded screen colors.

### History

- [ ] **HIST-01**: Users can browse existing workout sessions from a dedicated, Material-styled History screen.
- [ ] **HIST-02**: Users can inspect, edit, and delete historical workouts with existing confirmation and persistence behavior preserved.

### Weight

- [ ] **WGHT-01**: Users can add and browse weigh-ins from a dedicated, Material-styled Weight screen.
- [ ] **WGHT-02**: Users can edit or delete weigh-ins while preserving local and Firebase synchronization behavior.

### Architecture and Cleanup

- [ ] **ARCH-01**: History and Weight rendering resides in dedicated screen components while `App.jsx` retains state, persistence, routing, and callback wiring.
- [ ] **ARCH-02**: The hidden duplicate session interface and obsolete legacy styles are removed only after behavioral parity is verified.
- [ ] **ARCH-03**: Redesigned screens use shared tokens and primitives without new hard-coded colors, legacy inline-style systems, or `!important` overrides.

### Verification

- [ ] **VERI-01**: Existing tests, timezone tests, production build, and redesign-relevant lint checks pass.
- [ ] **VERI-02**: All five destinations and workout session mode work at 360px and 390px in light and dark themes.
- [ ] **VERI-03**: Android safe areas, theme/status-bar updates, hardware back, Google sign-in, rest notifications, and primary workout flows are manually verified without regressions.

## v2 Requirements

No product expansion is deferred from this milestone. Future features and hardening initiatives require a separate milestone definition.

## Out of Scope

| Feature | Reason |
|---------|--------|
| New workout, analytics, social, coaching, or account features | This milestone completes the approved redesign only. |
| Firebase schema, synchronization, backup/import, draft-storage, progression, service-worker, exercise-catalog, or muscle-model changes | Existing data behavior must remain stable during presentation work. |
| Security hardening or local-data encryption | Important future work, but separate from redesign completion. |
| Tablet layouts, desktop navigation rails, or additional responsive layouts | The approved target is one phone layout centered on larger screens. |
| Material You dynamic color or a third-party styling/component framework | The established architecture uses a custom palette, CSS tokens, and hand-built primitives. |
| Deployment, publishing, or store release | These actions require a separate explicit request. |

## Traceability

Roadmap phase mappings will be populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROG-01 | TBD | Pending |
| PROG-02 | TBD | Pending |
| PROG-03 | TBD | Pending |
| HIST-01 | TBD | Pending |
| HIST-02 | TBD | Pending |
| WGHT-01 | TBD | Pending |
| WGHT-02 | TBD | Pending |
| ARCH-01 | TBD | Pending |
| ARCH-02 | TBD | Pending |
| ARCH-03 | TBD | Pending |
| VERI-01 | TBD | Pending |
| VERI-02 | TBD | Pending |
| VERI-03 | TBD | Pending |

**Coverage:**
- v1 requirements: 13 total
- Mapped to phases: 0
- Unmapped: 13 ⚠️

---
*Requirements defined: 2026-08-14*
*Last updated: 2026-08-14 after initial definition*
