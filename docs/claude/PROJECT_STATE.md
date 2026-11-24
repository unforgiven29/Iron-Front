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

**Stage 1 exit criteria are met by tests:** missing/incompatible/cyclic dependencies are rejected (`ModuleResolver.test.ts`); two test modules compose through one interface (`ModuleComposition.test.ts`); replay reproduces state (`SaveReplay.test.ts`); resource failures report causes (`ResourceArbiter.test.ts`). Stage 1 is complete once these pass in CI on `main`. The next work is Stage 2 (physics and world foundations).

### Stage 2 progress
1. **Done:** rigid-body 6-DoF state, force/moment contract and RK4 integrator (`game/src/physics/rigidbody/RigidBody.ts`; see `physics/rigidbody/README.md`).
2. **Done:** standard atmosphere, gravity, wind-field contract and local airflow (`game/src/physics/environment/Atmosphere.ts`; see `physics/environment/README.md`).
3. **Done:** terrain heightfield tiles, validated surface queries with explicit no-data/outside-coverage, and a seeded synthetic generator (`game/src/world/terrain/Terrain.ts`; see `game/world/terrain/README.md`).
4. **Done:** spatial broad-phase index and collision queries (`game/src/core/spatial/SpatialIndex.ts`, `game/src/physics/collision/Collision.ts`).
5. **Done:** Stage 2 exit scenario (`game/tests/integration/Stage2Physics.test.ts`): rigid body, atmosphere, wind, terrain and collision on the scheduler give identical results at 30/60/144 fps and through save/load, and missing terrain yields `unknown`, never flat ground.

### Stage 3 progress (provisional)
1. **Done, provisional data:** F-16C Block 50 flight-model slice (`game/src/platforms/aircraft/f16c-block50/`). Uses NASA TP-1538/Stevens & Lewis low-speed tables (not Block 50 data), an estimated F110 engine and a project-designed FLCS. Every value is labelled; see `game/modules/planes/F-16/flight-model/README.md`. **This is not a validated Block 50 model**, and Stage 3 exit is not met.
2. **Done:** control registry (`game/src/core/controls/ControlRegistry.ts`). Switches are data with an owner. Views and keys only request a position, and the owner accepts or rejects it. F-16 test switches: **FLCS NORM/DIRECT** (DIRECT = no augmentation, trim captured on entry) and **CG test** (0.35/0.40/0.45 MAC, using the same unmodified tables). Neither is a real F-16 control. Measured: at the 0.40 CG, DIRECT departs within 3 s while NORM holds.
5. **Done, provisional data:** high-fidelity NASA TP-1538 aero (43 tables, α to 90°, β-dependence, LEF increments) with the published LEF schedule is now the default F-16 aero model. The FLCS roll loop gained an integral term, needed because the real data has a small roll asymmetry at β = 0.
6. **Done, partly estimated:** physics-based F110 gas-path engine (`game/src/physics/propulsion/MixedFlowTurbofan.ts`), calibrated to published SLS dry and AB thrust. Altitude/Mach lapse, ram drag and fuel flow are emergent.
7. **Done:** modular aircraft architecture. The shared `FixedWingAircraft` runtime flies any `AircraftDefinition` (`game/src/platforms/aircraft/common/`). The F-16 is a package implementing that contract and is loaded through the module system (`game/src/app/AircraftCatalog.ts`). How to add an aircraft: `docs/claude/adding-an-aircraft.md`. A test-only twin-engine package proves a structurally different aircraft flies on the same runtime.
8. **Done, partly estimated:** F-16 high-speed and performance accuracy pass.
   - Supersonic aero from **NASA TP-3355** F-16C wind-tunnel data (CDmin, CLα, induced drag, aerodynamic-centre shift at M 1.6–2.16); the transonic band is estimated.
   - The F110 inlet is an exact normal-shock pitot inlet, with installation and Reynolds losses (estimated). A compressor-exit temperature limit is derived from two published speed points.
   - Fuel-driven mass (USAF 8,936 kg empty + fuel) and speedbrake (estimated drag).
   - Fly-by-wire features documented for the F-16: AoA/g limiter, roll-rate fade with AoA, ARI, stability-axis roll, washout yaw damper and pedal fade (gains estimated).
   - Shared steady-state performance calculator. Validated: max level speed ≈M1.26 at sea level (published ≈1.2) and M1.89 at 40,000 ft (published max sustained 1.89); ceiling above 50,000 ft. Sea-level climb ≈68,000 ft/min sits inside the published 50,000 (generic/early F-16) to 72,000 ft/min (quoted for Block 50/52) range; neither figure states a weight.
9. **Done, partly estimated:** F-16 handling pass against NASA TP-1538 (primary, from NTRS).
   - TP-1538 confirms that the dataset's roll control is flaperons with differential tail at 4:1 (fig. 13 matches the "aileron" tables within reading accuracy), so roll power was already correct.
   - FLCS pitch law restructured to the documented F-16 form: g command with alpha (rate-led) fed into the same integrated error, a hard alpha backstop at the limit, and over-g protection. The integrator is stored in stabilator degrees, which removed a 6.3 g cap supersonic.
   - Roll: TAS-scheduled feedforward (282–311°/s at 300–500 KCAS, was 173–201) and the TP-1538 "control system B" roll-rate limiting (q, alpha, nose-down stabilator; minimum 80°/s). 308°/s is now attributed to TP-1538.
   - Supersonic aerodynamic-centre shift now applies at every alpha. Fading it with attached flow had created an artificial pitch-up above ≈15° supersonic.
   - Control power changes with Mach (estimated: scaled by the wing's lift-curve-slope ratio).
   - Remaining estimated: transonic aero, control power vs Mach, engine component maps, all FLCS gains. M 1.6 at 40,000 ft reaches ≈7.5 g in 5 s with the stabilator near full travel.
10. **Done, schedules estimated:** engine control and modular split.
   - Shared `Fadec` (physics/propulsion) between throttle and engine: throttle map, model-based T3 / TIT / corrected-speed / minimum-burner-pressure limiters, acceleration and deceleration schedules, afterburner sequencing and light-off envelope, primary/backup modes. `MixedFlowTurbofan` is now only the plant (cycle + rotor lag).
   - F-16 `F110Engine.ts` holds the F110 design and FADEC schedule; ENG CONT switch (N key) selects PRI/SEC; ENG MFD page shows mode, speed demand and active limiters; HUD caution in backup.
   - F-16 FLCS split into `flcs/PitchChannel.ts`, `RollChannel.ts`, `YawChannel.ts` (same behaviour, all tests unchanged).
11. **Done, geometry estimated:** engine inlet and nozzle as components (`physics/propulsion/components/`).
   - Variable convergent–divergent nozzle: throat (choked/subsonic), linked exit area, isentropic expansion, momentum + pressure thrust, separation approximation. Cycle back-pressure matching raises turbine temperature when a held throat is too small.
   - FADEC commands the throat and gains a TIT limiter (derived: calibrated MIL TIT + 30 K). F-16 SEC now holds the nozzle closed; the thrust loss (≈92 % of MIL at sea level) emerges from back-pressure + TIT limit instead of a fixed cap.
   - (Superseded by item 12 for the F110.) F110 nozzle areas were sized from the calibrated cycle (closed = 0.9 × SLS MIL need, open = 1.3 × SLS max-AB need; A9/A8 1.1–1.3, Cfg 0.98; all estimated). Top speed is unchanged within 0.02 Mach (SL M1.27, 40,000 ft M1.87).
12. **Done, partly derived:** data-driven F110-GE-129 engine.
   - Source: NASA TM-104326 (1996), GE F110-GE-129 cycle-deck outputs with measured engine-face conditions (ground run idle→MIL and 19 flight points), transcribed in `F110DeckData.ts`.
   - New shared component `physics/propulsion/components/GasGeneratorDeck.ts`: dry gas generator from corrected-parameter tables against corrected fan speed N1c (the parameter that collapses ground and flight data; core speed does not because of variable geometry).
   - Tables built from the ground run only; the 19 flight points are held out. Validation (`F110Deck.test.ts`): gross thrust mean error < 2.5 %, worst 5.4 %; nozzle flow < 3.5 %; fuel flow < 6 %.
   - Nozzle exit/throat ratio vs NPR and thrust coefficient (0.96 → 0.978) from the same report; closed throat = MIL position (data), so SEC keeps MIL thrust.
   - FADEC: throttle map, idle N1 and the MIL limit from the deck. MIL is a corrected-N1 'T2 lapse': ≈1.006 up to θ1 1.05, then −0.35 per unit θ1 (deck to θ1 1.13; linear extrapolation beyond, supersonic). The tuned 1020 K compressor-exit limit was removed.
   - Engine calibration now targets UNINSTALLED ratings (test-stand values); before, the installed thrust was calibrated to them, overstating the engine by the installation loss (≈5 %).
   - Afterburner: thermodynamic, max temperature calibrated to 29,000 lbf uninstalled (no AB data).
   - Max level speed: sea level M1.25 (published ≈1.2, +4 %), 40,000 ft M1.81 (published 1.89 sustained, −4 %). Remaining uncertainty: the MIL lapse beyond θ1 1.13 is extrapolated; installation loss and afterburner are estimated. Sea-level best climb ≈65,800 ft/min.
13. **Done, sourced:** F-16 FLCS replaced by the NASA TP-1538 appendix A control laws (figures 62–65) plus that report's control-system-B protections (roll-rate limiting, roll-coupling pseudo-alpha).
   - Files: `flcs/PitchChannel.ts`, `RollChannel.ts`, `YawChannel.ts`, `Filters.ts` (exact ZOH first-order sections, Tustin biquad for the roll notch).
   - Deviations, documented in each file: 9 g limit (source simulator 8 g), automatic roll trim (source: pilot trim input), linear pedal gradient (figure 65b not read).
   - Validation: reproduces TP-1538 figure 30 (full-stick roll from 1 g at the AoA limit, 30,000 ft): max roll rate 54°/s vs ≈70°/s published, AoA ≤ 25.5° vs ≤ 26°, sideslip 4.4° vs < 3°.
   - Behaviour change vs the previous project-designed law: slower g onset (PI g loop with washed-out pitch-rate blending; ≈6 g in 1 s, ≈8.7 g peak at M0.9/10,000 ft), roll ≈215–240°/s at 300–500 KCAS (proportional roll loop), crisp roll stop. Tests were re-baselined to the published law.
14. **Done, sizes estimated:** shared hydraulic network `game/src/systems/hydraulics/HydraulicNetwork.ts` (owner `game/systems/hydraulics`).
   - Lumped circuits (fluid + accumulator compliance), pressure-compensated engine-driven pumps following engine core speed, accumulators, an emergency unit (auto-start, delay, endurance), leakage/relief, injected faults.
   - Actuator authority from servo-valve physics (rate ∝ √(1 − load/force capacity)); surfaces with no supply hold position. Actual surface motion is the network's flow demand.
   - F-16 installation (`F16Hydraulics.ts`): systems A and B at 3000 psi, F110-driven pumps, FLCS accumulators, EPU pump on A; stabilator/roll/rudder dual-fed, speedbrake on A. Test switch H (pump faults); FLCS MFD shows HYD A/B psi and EPU state; HYD PRESS / EPU cautions.
   - Not modelled: utilities on B (gear, brakes, NWS…), LEF actuators, EPU electrical half, reservoirs, temperature, hinge-moment loads (constant design load fraction).
15. **Done, values mostly estimated:** ground operations and the remaining actuation gaps.
   - Shared ground handling `game/src/physics/ground-handling/LandingGear.ts` (owner physics/ground-handling): strut spring/damper with bottoming, tyre rolling/brake/cornering forces on a friction circle with ideal anti-skid, nose-wheel steering, gear extension/retraction powered by a hydraulic circuit, squat-switch interlock, weight-on-wheels, gear-collapse (sink rate), gear-up landing and airframe-strike crash detection. Forces go to the rigid body; nothing moves the aircraft directly.
   - F-16 gear (`F16LandingGear.ts`): published track/wheelbase, estimated stations/struts/tyres/brakes/NWS; gear, brakes and NWS on hydraulic System B; gear drag (estimated); G = gear handle, Space = brakes, pedals steer on the ground. FLCS pitch integrator held at zero with weight on wheels.
   - Airfield (`game/src/world/infrastructure/Airfield.ts`, owner world/infrastructure): runway geometry, deterministic terrain flattening with blend, line-up positions; the game's test range has a 3,000 m runway; the game starts lined up on it ("Air start" keeps the old airborne start). Runways are drawn in the 3D view.
   - Leading-edge flaps are now a hydraulic actuator (TP-1538: 0.136 s, 25°/s, 0–25°) fed by A and B. Scheduled devices can command actuators.
   - Hinge loads: actuator speed now depends on dynamic pressure, deflection and whether the air load opposes or aids the motion (servo-valve law; linear hinge-load estimate, no F-16 hinge-moment data). One hydraulic system costs rate mainly at high q̄.
   - Validation so far: rest on brakes, taxi turn, interlock, afterburner takeoff (liftoff < 1,000 m), stabilised landing and stop, gear collapse at 6 m/s sink, gear-up crash. Not modelled: wheel spin-up, tyre relaxation, runway surface classes, brake heating, gear doors, emergency extension, ground effect, F-16 takeoff/landing FLCS gains.
16. **Done:** ground effect, shared `game/src/physics/aerodynamics/GroundEffect.ts` (owner physics/aerodynamics): McCormick induced-drag factor φ = (16h/b)²/(1+(16h/b)²) and lift-slope increase from the effective aspect ratio A/φ (DATCOM/Helmbold). The runtime passes CG height above terrain to the aero model (`AeroInput.heightAboveGroundM`). F-16: at gear height (1.64 m) induced drag ×0.89 and attached-flow lift slope ×1.056, fading out by about one span. Not modelled: tail-downwash pitching moment, bank asymmetry, dynamic (sink-rate) ground effect.
4. **Done:** app routes. `/` is the full-screen F-16 game with a start/pause menu (`game/src/app/GameScreen.ts`, `F16Session.ts`). `/#debug` is the developer tools page (foundation status, runtime monitor, debug flyer).
3. **Done, provisional renderer:** untextured Three.js F-16 cockpit with world, HUD and two MFDs (`game/src/rendering/three/`, `game/src/app/F16CockpitSection.ts`; ADR-0002). The cockpit geometry is approximate and visual-only.

**Stage 2 exit criteria have passing tests.** Remaining Stage 2 gaps are listed in each owner README. The next work is Stage 3 (F-16C Block 50 vertical slice), which needs sourced aircraft data per the platform dossier. A debug flyer (`game/src/debug/`) exercises these services with a fictional, synthetic-data airframe; it is not an aircraft model.


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
