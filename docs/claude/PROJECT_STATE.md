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
| Time and scheduling | `game/src/core/time/SimulationClock.ts`, `game/src/core/simulation/SimulationScheduler.ts` | Fixed-step clock plus deterministic phase/priority/multi-rate scheduler with one-shot work, fault isolation and pause. Not a message dispatcher/event journal, time-scale policy or save/restore of scheduled work |
| Coordinates | `game/src/core/coordinates/CoordinateFrames.ts` | Not a complete world/spatial engine |
| Randomness | `game/src/core/random/SeededRandom.ts` | Not complete scenario/entity/subsystem stream orchestration |
| Messages and entities | `game/src/core/contracts/Messages.ts`, `game/src/core/events/MessageBus.ts`, `game/src/core/entities/EntityRegistry.ts` | Validated, deterministic in-process message bus and entity identity/lifecycle registry. Not an event journal, replay, save/load or network transport |
| Module types and resolution | `game/src/core/modules/` (ModuleTypes, SemanticVersion, ModuleResolver, ModuleComposer) | Validates manifests, resolves capabilities/versions/dependencies (missing, incompatible, ambiguous, cyclic rejected with diagnostics) and composes modules from an explicit factory catalog. Not a manifest discovery/loader, async lifecycle host or configuration loader |
| Rendering boundary | `game/src/rendering/RendererPort.ts` | Not a selected or implemented rendering engine |
| Tests | Foundation unit tests and browser smoke test for the shell | Not aircraft, radar, missile or campaign acceptance coverage |

The README files under `physics/`, `sensors/`, `game/modules/`, `game/systems/` and much of `game/world/` are architecture specifications, data plans or task routers. Many directories are intentionally empty scaffolds. A directory, README, schema, example manifest, test plan, placeholder or visual mock is not evidence of a working runtime capability.

### Not implemented as complete runtime systems

Do not describe or build on these as though they already exist:

- Module manifest discovery/loading, async module lifecycle states and configuration-driven runtime composition (validation, resolution and synchronous composition exist).
- Message journal persistence, entity component composition, save-state migrations, resource quality matching and reservations, resource allocator, diagnostics service, persistence, replay and complete spatial services.
- Six-degree-of-freedom aircraft flight model, aerodynamic surface integration, propulsion simulation, flight controls/actuators, ground handling or aircraft-specific system networks.
- Complete environment/atmosphere and terrain/collision runtime, RF propagation, radar waveform/receiver/processing/detection/tracking chain, RWR/ESM and passive emitter tracking, IRST/EO, sensor fusion or aircraft datalink runtime. Radar/ESM README files describe intended ownership only.
- Aircraft installations, accurate clickable cockpits, startup procedures, operational aircraft, complete missile variant data, validated 6-DoF coefficient tables, full pulse-IQ radar missile seeker, calibrated monopulse seeker/CM susceptibility, fuze/warhead effects, ground units, infantry, naval units, AI, logistics or campaign simulation.
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

**Radar/missile scope update:** this task is documentation-only. Runtime code and tests mistakenly added during the task have been removed. The remaining source-area README files are folder markers and architecture guides; they must not be treated as evidence of implemented radar, missile, seeker, guidance, countermeasure or ESM behavior.

The project remains at the previously documented foundation stage. Implementation order and stage gates remain governed by the roadmap and implementation workflow.

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

1. ~~Manifest validation and a capability/version resolver.~~ **Done** (see `game/core/module-registry/README.md`): two test modules compose through one interface; missing, incompatible, ambiguous and cyclic dependencies are rejected with diagnostics.
2. ~~A deterministic simulation dispatcher/scheduler.~~ **Done** (`game/src/core/simulation/SimulationScheduler.ts`; see `game/core/simulation/README.md`). Original requirement: Define update phases, fixed-tick order, event ordering and multi-rate scheduling. Rendering frame rate must not control simulation time.
3. ~~Entity identity and lifecycle, then typed command/event/observation/snapshot transport.~~ **Done** (`game/src/core/entities/EntityRegistry.ts`, `game/src/core/events/MessageBus.ts`; see the owner READMEs).
4. ~~Resource offer/demand/allocation contracts with observable denial and degraded behavior.~~ **Done** (`game/src/core/resources/ResourceArbiter.ts`; see `game/core/resources/README.md`).
5. ~~Configuration resolution, diagnostics and save/replay contracts as their dependencies become stable.~~ **Done** (`game/src/core/configuration/`, `game/src/core/diagnostics/`, `game/src/core/persistence/`).

**Stage 1 exit criteria are met by tests:** missing/incompatible/cyclic dependencies are rejected (`ModuleResolver.test.ts`); two test modules compose through one interface (`ModuleComposition.test.ts`); replay reproduces state (`SaveReplay.test.ts`); resource failures report causes (`ResourceArbiter.test.ts`). Stage 1 is complete once these pass in CI on `main`. The next work is Stage 2 (physics and world foundations). A live runtime monitor (`game/src/debug/`) shows these services running in the browser; it is a debug view with a fictional demo module, not a simulator feature.

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
