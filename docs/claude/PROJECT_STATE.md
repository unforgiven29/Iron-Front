# Project state and Claude starting point

**Purpose:** A short, evidence-based status page for coding agents. This page describes the repository as it exists, not the simulator it is intended to become.

**Current baseline:** `main` contains a Vite/TypeScript application shell, a small set of core primitives, tests and a large architecture/documentation scaffold. The documentation is intentionally much broader than the executable runtime.

## What this project is

Iron-Front is a browser-based combat flight simulation project intended to grow into a Falcon BMS-inspired, systems-oriented simulator, with combined-arms and campaign capabilities developed on top of the flight-simulation foundation. Falcon BMS is an architectural and simulation-depth reference, not a source of copied constants, undocumented behavior or proprietary implementation.

The first aircraft proof is the F-16C Block 50. The MiG-29A product 9.13 is the second-aircraft architecture proof: it must use the shared engines through a different aircraft installation, not an F-16 code fork.

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
| Tests | Unit tests for the clock, coordinates and seeded random; browser smoke test for the shell | Not aircraft, physics, radar, weapons or campaign acceptance coverage |

The README files under `physics/`, `sensors/`, `game/modules/`, `game/systems/` and much of `game/world/` are architecture specifications, data plans or task routers. Many directories are intentionally empty scaffolds. A directory, README, schema, example manifest, test plan, placeholder or visual mock is not evidence of a working runtime capability.

### Not implemented as complete runtime systems

Do not describe or build on these as though they already exist:

- Module manifest validation/loading, capability resolution, dependency graph, module lifecycle and runtime composition.
- Deterministic event dispatcher/journal, multi-rate scheduler, entity store, resource allocator, diagnostics service, persistence, replay and complete spatial services.
- Six-degree-of-freedom aircraft flight model, aerodynamic surface integration, propulsion simulation, flight controls/actuators, ground handling or aircraft-specific system networks.
- Environment/atmosphere field, terrain/collision runtime, RF propagation, radar transmitter/receiver/signal processing/tracking, RWR/ESM, IRST/EO, sensor fusion or datalink runtime.
- Aircraft installations, accurate clickable cockpits, startup procedures, operational aircraft, weapons, countermeasure interaction, ground units, infantry, naval units, AI, logistics or campaign simulation.
- A production 3D renderer, audio engine, asset pipeline or persistent authoritative multiplayer backend.

A subsystem guide may define detailed intended behavior while the runtime remains absent. Keep that distinction explicit in code reviews, commits, documentation and user-facing status.

## Current development stage

The implementation-readiness checklist and roadmap put the next work at **Stage 0.5 — Foundation hardening**, followed by **Stage 1 — Runtime contracts and core services**. Do not jump to aircraft, radar or weapon implementation before the Stage 1 exit criteria pass.

### Stage 0.5 — finish these contract checks first

1. Make the TypeScript module-manifest types and JSON Schema agree. Add positive and negative validation tests.
2. Validate message envelopes by message kind. Commands, committed events, observations and immutable snapshots must not accept each other's required fields by accident.
3. Verify coordinate conventions with reference-attitude tests: ENU world axes, FRD body axes, all cardinal level-flight attitudes, gravity direction and rejection of non-finite vectors.
4. Make seeded random streams independently derivable from stable scenario/entity/subsystem identity. Prove repeatability and prove that entity creation/query order does not alter another stream.
5. Complete the versioned antenna-aperture schema with valid parabolic-reflector and flat slotted-waveguide examples plus invalid-record tests. This is data-contract work, not antenna physics.

Use the Stage 0.5 exit criteria in `docs/implementation-roadmap/README.md` and the implementation-readiness gate. Do not mark a criterion complete without executable test evidence.

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
