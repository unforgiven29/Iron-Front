# Iron-Front implementation roadmap

This roadmap defines the order in which the architecture becomes an executable simulator. Work milestone by milestone, not by implementing every folder at once.

## Stage 0 — Reproducible project foundation

Goal: any developer can install, validate, test, run and build the same application.

Deliverables: Node/npm policy, pinned direct dependencies, Vite shell, strict TypeScript, linting, JSON Schema validation, unit/browser tests, CI, Pages deployment, Claude instructions and contributor workflow.

Exit: clean install, lockfile committed, lint/type/schema/unit/build and browser tests pass in CI.

## Stage 0.5 — Foundation hardening

Goal: close contract gaps in the initial shell and turn critical conventions into executable validation before the runtime expands.

Deliverables: TypeScript/JSON Schema parity for module manifests; kind-specific message-envelope validation; known ENU/FRD reference-attitude tests and finite-vector validation; stable independent random streams derived from scenario/entity/subsystem identity; versioned antenna-aperture schema with explicit parabolic-reflector and flat slotted-waveguide examples; positive and negative schema tests.

Exit: valid and invalid manifests/messages are distinguished by CI; all four cardinal level-flight attitudes map body axes correctly; gravity maps into body-down; non-finite vectors are rejected; scoped random streams are repeatable and independent of entity creation order; both aperture examples validate and invalid aperture records are rejected.

## Stage 1 — Runtime contracts and core services

Implement a validated module manifest loader/registry and capability resolver; versioned commands/events/observations/snapshots; entity identity/lifecycle; fixed-step clock and deterministic event order; seeded random streams; diagnostics; resource contracts/allocation; coordinate/unit utilities; configuration validation.

Exit: missing/incompatible/cyclic dependencies rejected; two test modules compose through one interface; replay reproduces state; resource failures report causes.

## Stage 2 — Physics and world foundations

Implement world coordinates/local ENU, rigid-body integration and force/moment contracts, collision/query contracts, atmosphere sampling/local air velocity, terrain surface data and spatial index.

Exit: analytical rigid-body/force tests, coordinate transforms, timestep sensitivity and deterministic replay pass.

## Stage 3 — F-16C Block 50 vertical slice

Implement exact module manifest and sourced data; geometry/mass/aero surfaces and coefficients; flight-control laws/actuators; F110-GE-129 installation and shared turbofan model; fuel/electrical/hydraulic/cooling topology; gear/brakes/cockpit controls/instruments; connected damage/failures.

Exit: F-16 acceptance scenarios pass, no F-16 branch exists in shared physics, and unknown values remain explicit.

## Stage 4 — Cockpit and asset pipeline

Prototype and select renderer; finalize asset metadata/import conventions; build model hierarchy/attachments/animation bindings; map cockpit controls to real commands and indicators to snapshots; measure LOD/performance.

Exit: renderer passes comparison; cockpit controls cause system changes; indications reflect authoritative snapshots.

## Stage 5 — Sensors and electronic warfare

Build radar emissions/propagation/receiver/detection/tracking, RWR direct RF interception, passive IRST thermal chain, EO/FLIR, IFF, MAWS, fusion and datalink.

Exit: sensor outputs follow physical signal/geometry/resource limits, preserve uncertainty and have no hidden-truth shortcuts.

## Stage 6 — Weapons and damage

Build launcher compatibility/release, weapon runtime, shared ballistics/propulsion/guidance/seeker/fuze/warhead interfaces, countermeasures and damage propagation.

Exit: supported weapon scenarios pass from release through flight, impact and damage.

## Stage 7 — Second aircraft proof

Use MiG-29 product 9.13 to prove the shared engines support materially different geometry, propulsion, control, system, sensor and cockpit configurations without copying F-16 code.

## Stage 8 — Combined arms

Build ground mobility, armour, vehicles, infantry, naval units and carrier operations over shared services. Every family needs a vertical slice and performance tests.

## Stage 9 — World, AI, logistics and campaign

Build streaming terrain/infrastructure, AI, command/control, logistics and campaign as optional modules consuming imperfect observations and published events. Validate save/load/migration for long-running campaigns.

## Stage 10 — Optimization, expansion and multiplayer adapters

Profile actual workloads; add LOD, workers, spatial culling and bounded approximations only when measured. Persistent authoritative co-op requires an external backend; GitHub Pages is static hosting.

## Completion rules

A folder/README/type is not an implementation. Every stage requires demo/test scenarios, failure cases and performance evidence. Do not begin downstream features while foundational contracts are unstable. Do not weaken tests to force green status.
