# Project state and Claude starting point

**Purpose:** A short, evidence-based status page for coding agents. This page describes the repository as it exists, not the simulator it is intended to become.

**Current baseline:** `main` contains a Vite/TypeScript application shell, a small set of core primitives, tests and a large architecture/documentation scaffold. The documentation is intentionally much broader than the executable runtime.

## What this project is

Iron-Front is a browser-based combat flight simulation project intended to grow into a Falcon BMS-inspired, systems-oriented simulator, with combined-arms and campaign capabilities developed on top of the flight-simulation foundation. Falcon BMS is an architectural and simulation-depth reference, not a source of copied constants, undocumented behavior or proprietary implementation.

The first aircraft proof is the F-16C Block 50. The MiG-29A product 9.13 is the second-aircraft architecture proof. They must have independent aircraft-specific flight models, aerodynamic data, geometry, control response, installation and validation. They may reuse numerical physics infrastructure and stable interfaces; they must not share one universal flight model or inherit each other's handling.

## Reality check: what exists now

The executable TypeScript is concentrated in `game/src/`. The current source tree contains these foundational pieces:

| Area | Current evidence | What that evidence does not mean |
|---|---|---|
| Application | `game/src/main.ts` and the Vite shell | Not a playable simulator or 3D renderer |
| Time | `game/src/core/time/SimulationClock.ts` | Not a complete simulation scheduler or deterministic event loop |
| Coordinates | `game/src/core/coordinates/CoordinateFrames.ts` | Not a complete world/spatial engine |
| Randomness | `game/src/core/random/SeededRandom.ts` | Not complete scenario/entity/subsystem stream orchestration |
| Message shapes | `game/src/core/contracts/Messages.ts` | Not a validated message bus, dispatcher or event journal |
| Module types | `game/src/core/modules/ModuleTypes.ts` | Not a manifest loader, registry, dependency resolver or lifecycle host |
| Rendering boundary | `game/src/rendering/RendererPort.ts` | Not a selected or implemented rendering engine |
| Tests | Foundation unit tests plus new deterministic radar, missile, seeker and guidance unit suites; browser smoke test for the shell | Numerical unit coverage is not scenario acceptance, real-world fidelity evidence or aircraft integration |
| Radar kernels | `game/src/physics/radar/`, `game/src/sensors/radar/` and `game/src/sensors/esm/`: radar equation, antenna/RCS, jammer coupling, sampled terrain/atmospheric path loss, hardware readiness, pulse/IQ + matched filter + Doppler FFT, CFAR, radar tracks, beam scheduling, planar AESA array factor, passive RWR interception/classification and bearing-only tracks | Not a full terrain/environment pipeline, distributed clutter, calibrated Pd/Pfa, RWR alert/cockpit/DF network, aircraft fit or full fusion |

| Missile kernels | `game/src/physics/guidance/`, `game/src/physics/ballistics/MissileDynamics.ts`, `Missile6DofDynamics.ts`, `game/src/physics/guidance/Missile6DofController.ts`, `game/src/weapons/Missile6DofSimulation.ts`, `game/src/sensors/weapon-seeker/` and `game/src/weapons/MissileNavigation.ts`: PN/APN/pursuit, 3/6-DoF aerodynamic/motor simulation, fin actuator and inner-loop control, INS drift/correction, seeker discrimination/lifecycle, thermal flare/chaff simulation and fuze event gate | Not a verified missile variant, aircraft/launcher integration, calibrated CM susceptibility or fuze/warhead damage model |

The README files under `physics/`, `sensors/`, `game/modules/`, `game/systems/` and much of `game/world/` are architecture specifications, data plans or task routers. Many directories are intentionally empty scaffolds. A directory, README, schema, example manifest, test plan, placeholder or visual mock is not evidence of a working runtime capability.

### Not implemented as complete runtime systems

Do not describe or build on these as though they already exist:

- Module manifest validation/loading, capability resolution, dependency graph, module lifecycle and runtime composition.
- Deterministic event dispatcher/journal, multi-rate scheduler, entity store, resource allocator, diagnostics service, persistence, replay and complete spatial services.
- Six-degree-of-freedom aircraft flight model, aerodynamic surface integration, propulsion simulation, flight controls/actuators, ground handling or aircraft-specific system networks.
- Complete environment/atmosphere and terrain/collision runtime. Limited sampled-profile terrain LOS and coefficient-driven attenuation exist for radar echo screening, but there is no complete environment-coupled propagation service, terrain tile sampling, refraction/ducting/multipath/weather field, distributed clutter model, calibrated detector, RWR ESM tracker/alerts, IRST/EO, sensor fusion or aircraft datalink runtime.
- Aircraft installations, accurate clickable cockpits, startup procedures, operational aircraft, complete missile variant data, validated 6-DoF coefficient tables, active/semi-active radar missile seeker, calibrated seeker/CM susceptibility, fuze/warhead effects, ground units, infantry, naval units, AI, logistics or campaign simulation.
- A production 3D renderer, audio engine, asset pipeline or persistent authoritative multiplayer backend.

A subsystem guide may define detailed intended behavior while the runtime remains absent. Keep that distinction explicit in code reviews, commits, documentation and user-facing status.



### Flight-model independence is mandatory

A shared six-degree-of-freedom rigid-body integrator, reusable aerodynamic equations and force/moment contracts are **not** a shared aircraft flight model. Every aircraft owns its own validated aerodynamic model/data, geometry, mass/inertia, control laws, trim/actuator response, propulsion installation, configuration effects and operating envelope. Different aircraft may need different model structures. Never force the F-16 and MiG-29 into the same coefficient tables, panelization, control response or tuning. Reuse only the mathematical tools and interfaces whose assumptions are valid for the aircraft.

## Engineering reference library

Use `docs/reference-library/README.md` as the central annotated source index. Read the specific domain guide for flight dynamics, ground vehicles/infantry, sensors/EW, weapons/ballistics, aircraft systems, validation or tactical/campaign context. The references are intentionally annotated with what they establish and what they do not establish. They do not create implementation evidence or authorize copying restricted/copyrighted material. Keep exact variant applicability, page/table citations, units, provenance, uncertainty and validity envelope attached to every adopted datum.

## Advanced flight-physics specifications

The flight-model specification now has dedicated owner guides for unsteady aerodynamics/dynamic stall, compressibility/transonic response, LEX/LERX and wake interactions, structural flexibility/aeroelasticity, installed inlet/exhaust coupling and aircraft ground handling. Read [advanced flight physics references](../reference-library/advanced-flight-physics.md) and the exact owner guide before implementing any of these capabilities.

**These additions are specifications and research routes only.** They do not mean dynamic stall, shock response, vortex fields, aeroelastic modes, inlet distortion, fatigue tracking or aircraft tire/gear dynamics have been implemented. Do not mark them complete until executable vertical slices and the FM-21 to FM-31 acceptance cases pass.



**Stage 0.5 — Foundation hardening is complete and CI-verified on `main` as of 21 November 2026.** The successful [GitHub Actions quality run](https://github.com/unforgiven29/Iron-Front/actions/runs/44963589879) passed lint, TypeScript, schema validation, unit tests, production build and Playwright browser smoke tests.

**Implementation exception:** at the user's explicit request, isolated radar and missile numerical kernels have now been added under `game/src/` with unit tests. This is deliberately early, bounded domain work; it does **not** complete Stage 1, Stage 5 sensors/EW or Stage 6 weapons, and it does not authorize aircraft/platform integration ahead of the roadmap gates. Treat the new code as reusable algorithm slices, not as a playable radar/missile suite. Their current limits are recorded in the owning READMEs.

The next permitted foundation work remains **Stage 1 — Runtime contracts and core services**. Do not attach these kernels to aircraft, campaign entities, UI or authoritative simulation scheduling before the Stage 1 exit criteria pass. After the foundation, complete the F-16C Block 50 as the first aircraft vertical slice, then use the MiG-29 product 9.13 as a second, independent flight-model proof.

### Stage 0.5 — completed foundation hardening

All Stage 0.5 exit criteria are implemented and CI-verified on `main`. The validation evidence is:

1. **Module manifest parity:** TypeScript contracts and JSON Schema agree on required/optional fields. The API compatibility upper bound is explicit: `maximumExclusive: null` means unbounded; omission is rejected. Positive and negative schema cases run in CI.
2. **Message kinds:** command, event, observation and snapshot envelopes each have positive schema cases; malformed command, event and observation cases are rejected.
3. **Coordinate conventions:** unit tests cover east/north/south/west level attitudes, FRD body axes, gravity direction, vector round trips, zero quaternions and non-finite vector rejection.
4. **Random streams:** scoped streams derive from stable scenario/entity/subsystem identities; tests cover repeatability, isolation and independence from unrelated scope creation.
5. **Antenna aperture data:** versioned parabolic-reflector and flat slotted-waveguide examples validate; invalid configuration is rejected. This is data-contract validation, not implemented antenna physics.

The successful CI run above executed `npm run check` and `npm run test:e2e`. Keep these checks in place; reopen Stage 0.5 only to fix a regression or contract change. Do not spend further implementation time redoing completed checks.

### Stage 1 — implement the smallest useful runtime

Build and test narrow, replaceable services in this order:

1. Manifest validation and a capability/version resolver. Prove it with two small test modules, including missing, incompatible and cyclic dependencies.
2. A deterministic simulation dispatcher/scheduler. Define update phases, fixed-tick order, event ordering and multi-rate scheduling. Rendering frame rate must not control simulation time.
3. Entity identity and lifecycle, then typed command/event/observation/snapshot transport.
4. Resource offer/demand/allocation contracts with observable denial and degraded behavior.
5. Configuration resolution, diagnostics and save/replay contracts as their dependencies become stable.

Keep each step a small vertical slice with contract tests. Do not create a monolithic `SimulationManager` or implement all planned services in one pass.

## Architecture rules that matter most

- **One owner per authoritative state and algorithm.** Before adding code, identify its owner, direct callers, inputs, outputs, update domain and tests.
- **Shared engine, platform installation.** Generic physics, sensor processing and network solvers are shared. An aircraft package supplies its exact geometry, installed equipment, wiring/topology, software fit, cockpit mapping and aircraft-specific data. Never add aircraft-name conditionals to shared engines.
- **Do not over-modularize.** A module is something that needs independent selection, configuration, versioning, replacement or lifecycle. A helper function, coefficient table or private algorithm is not automatically a module. Prefer a small number of clear public contracts and private implementation details.
- **Keep the layers one-way.** Core coordinates runtime services; physics owns reusable physical/numerical models; shared systems own platform networks; sensors own sensor equipment/processing; platform packages compose installations; world owns spatial truth; graphics/UI consume snapshots and issue commands.
- **Separate information types.** A command requests an action; an event records a committed fact; an observation is imperfect evidence; a snapshot is immutable read state. A cue is not a lock, a release request is not a release, and a detection is not world truth.
- **No hidden-truth shortcuts.** Sensors, seekers and AI may use only permitted observations, onboard state and received reports. They must not read the target's authoritative transform or another sensor's private track.
- **Simulation is not rendering.** Use fixed simulation time, stable event ordering and seeded randomness. Never let `requestAnimationFrame`, frame-rate variation or UI callbacks decide physical outcomes.
- **Model causal behavior, not booleans.** Electrical power, hydraulic pressure/flow, pneumatic inventory, fuel, cooling, damage, jamming and countermeasures must affect connected consumers through their actual interfaces. Do not replace a system with a generic `isWorking` flag.
- **Technical data is accountable.** Values need units, exact variant/software applicability, source/revision/page, provenance, validity envelope and uncertainty/confidence. Unknown is not zero. Do not invent precision to fill gaps.
- **No silent fidelity reduction.** Any approximation or performance tier must be explicit, documented and testable. Never secretly simplify physics or sensor behavior to recover frame rate.
- **No speculative scaffolding.** Do not add batches of empty directories, placeholder classes, duplicate READMEs or generic managers. Create the smallest structure needed for the current tested slice.

## Working commands

Requirements and setup are in `CONTRIBUTING.md`. The repository specifies Node.js 22.13+ and npm 10.9.9.

```bash
npm ci
npm run check
npm run dev
```

`npm run check` runs lint, TypeScript checking, schema validation, unit tests and the production build. Run `npm run test:e2e` for browser-facing changes (install the Playwright browser as described in CONTRIBUTING.md when needed). Do not claim a command passed unless you actually ran it.

The current implementation-readiness page records the baseline CI checks as green, while GitHub Pages configuration/deployment verification, renderer selection and Stage 0.5/Stage 1 completion remain outstanding. Re-check that page rather than assuming its checklist has not changed.

## How to start a Claude task

1. Read this page and `CLAUDE.md`.
2. Use `docs/claude/README.md` to find the single canonical owner for the task.
3. Read `docs/claude/implementation-workflow.md` before changing code.
4. Read only that owner's README and the direct producer/consumer guides necessary for the change. Read the full architecture overview only for cross-owner or ownership changes.
5. State the roadmap stage, acceptance criterion, files/contracts/tests to change and explicit non-goals before coding.
6. Implement one vertical slice; add positive, negative, failure/recovery and determinism tests as applicable.
7. Update the owner guide and implementation status with evidence. Report actual commands/results, limitations and next blocker.

If a requested feature conflicts with the current stage, propose the dependency that must be built first. Do not quietly skip the foundation.
