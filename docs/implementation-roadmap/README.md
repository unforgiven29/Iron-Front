# Iron-Front implementation roadmap

This roadmap defines the order in which the architecture becomes an executable simulator. Work milestone by milestone, not by implementing every folder at once. Feature breadth migrated from the legacy Viper Sortie project is catalogued in docs/legacy-game-feature-crosswalk.md; it must not bypass the vertical-slice sequence below.

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

Status: all four exit criteria have passing tests (see `docs/claude/PROJECT_STATE.md`). Remaining Stage 1 gaps are listed in each core owner README.

## Stage 2 — Physics and world foundations

Implement world coordinates/local ENU, rigid-body integration and force/moment contracts, collision/query contracts, atmosphere sampling/local air velocity, terrain surface data and spatial index. Lay the world data contract so both deterministic generated theatres and region-streamed, licensed geospatial Earth tiles can use the same interfaces.

Exit: analytical rigid-body/force tests, coordinate transforms, timestep sensitivity and deterministic replay pass; missing/invalid geodata cannot silently become flat terrain.

Status: all exit criteria have passing tests (see `docs/claude/PROJECT_STATE.md`). Remaining Stage 2 gaps are listed in each owner README.

## Stage 3 — F-16C Block 50 vertical slice

Implement an end-to-end F-16C Block 50 using its own geometry, mass/inertia, aerodynamic representation and sourced coefficient data; flight-control laws/actuators; F110-GE-129 installation and engine model; fuel/electrical/hydraulic/pneumatic/cooling topology; high-lift/control devices; landing gear/brakes/tires and cockpit controls/instruments; connected damage/failures.

Build advanced physical behaviors incrementally, in dependency order, not as a single feature dump:
1. local surface airflow, per-element forces/moments and actual actuator feedback;
2. fitted flaps/LEF/TEF/speedbrake scheduling and asymmetric/failure behavior;
3. aircraft-specific compressibility/transonic behavior and explicit Mach envelope;
4. selected unsteady aerodynamic response/dynamic stall with hysteresis and state;
5. aircraft-specific vortex/flow interactions and wake sampling where validated;
6. reduced-order structural flexibility/aeroelastic coupling only where structural evidence supports it;
7. installed inlet/distortion and nozzle/exhaust coupling where exact engine/installation data supports it;
8. aircraft-specific landing-gear/tire/strut/braking/anti-skid/steering and ground transitions;
9. structural loads, fatigue persistence and damage coupling only to the level supported by evidence.

Each capability may remain explicitly unsupported or estimated outside its validated envelope. Never fabricate a coefficient, flutter boundary, inlet surge limit or structural limit to make the roadmap look complete.

Exit: F-16 acceptance scenarios and applicable advanced cases pass; no F-16 branch or data defaults exist in shared physics; the aircraft model remains independently configurable; unsupported/unknown values and envelopes remain explicit; fixed-render-rate comparisons produce the same authoritative simulation results.

## Stage 4 — Cockpit and asset pipeline

Prototype and select renderer; finalize asset metadata/import conventions; build model hierarchy/attachments/animation bindings; map cockpit controls to real commands and indicators to snapshots; measure LOD/performance. Add reusable interaction/input paths, but keep each aircraft's cockpit layout, startup, warnings and display mappings variant-specific.

Exit: renderer passes comparison; cockpit controls cause system changes; indications reflect authoritative snapshots.

## Stage 5 — Sensors and electronic warfare

Build radar emissions/propagation/receiver/detection/tracking, RWR direct RF interception, passive IRST thermal chain, EO/FLIR/targeting payloads, IFF, MAWS, NCTR, fusion, datalink and the physical communication/navigation interference interfaces.

Exit: sensor outputs follow physical signal/geometry/resource limits, preserve uncertainty and have no hidden-truth shortcuts.

## Stage 6 — Weapons and damage

Build launcher compatibility/release, weapon runtime, shared ballistics/propulsion/guidance/seeker/fuze/warhead interfaces, infantry small-arms handling, countermeasures and damage propagation. Prove a coherent guided weapon and a small-arms/armour interaction before broad catalog expansion.

Exit: supported weapon scenarios pass from release through flight, impact and damage.

## Stage 7 — Second aircraft proof

Use MiG-29 product 9.13 to prove the shared physical infrastructure supports a materially different aircraft without copying F-16 code. Build its independent geometry/mass/aerodynamic model, control/stability augmentation, LEF/flap/taileron/aileron/rudder/speedbrake behavior, twin RD-33 installations and inlet states, systems topology, gear/ground handling, sensors, cockpit and its own advanced flow/structural data where evidence permits. Do not reuse F-16 coefficient tables, model structure assumptions, FLCS schedules, inlet maps, gear data or calibration.

Exit: F-16 and MiG-29 have distinct validated model configurations and data packages, and cross-platform tests prove there is no data/handling leakage between them. Each is independently tested for its supported envelope and known unsupported areas remain visible.

## Stage 8 — Combined arms and rotorcraft

Build ground mobility, layered armour, tanks, IFV/APC transport and dismount, artillery, ground air-defence, infantry first-person combat, squad AI, structures/interiors/fortifications, tactical medical/evacuation, rotorcraft dynamics, naval units/submarines and carrier operations over shared services. Each family needs a focused vertical slice, damage/failure cases and performance tests.

## Stage 9 — Uncrewed systems, civil traffic, world-war and campaign

Add FPV/UAS/loitering systems with link/autonomy behavior; civil aviation; real-Earth and generated theatre content; campaign/world-war state, institutions, intelligence, economy/logistics, civilian society, personnel/CSAR and strategic operations. Run one persistent causal campaign slice before adding the full country/event catalogue.

Exit: a sortie/infantry battle occurs inside a continuing campaign; supply, front, personnel and public consequences reconcile through events; save/migration and no-hidden-truth tests pass.

## Stage 10 — Optimization, expansion and multiplayer adapters

Profile actual workloads; add LOD, workers, spatial culling and bounded approximations only when measured. Expand aircraft/weapon/country rosters from validated data packages. Persistent authoritative co-op requires an external backend; GitHub Pages is static hosting.

## Completion rules

A folder/README/type is not an implementation. Every stage requires demo/test scenarios, failure cases and performance evidence. Do not begin downstream features while foundational contracts are unstable. Do not weaken tests to force green status.
