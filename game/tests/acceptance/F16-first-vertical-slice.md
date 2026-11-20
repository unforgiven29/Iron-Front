# F-16C Block 50 — first vertical-slice acceptance suite

**Purpose:** Define what "the first aircraft works" means before aircraft implementation begins. These are acceptance requirements, not claims the F-16 simulation exists.

**Target:** F-16C Block 50, using the selected baseline in `game/modules/planes/F-16/docs/variant-baseline.md`. Re-check operator/date/equipment applicability before detailed data is accepted.

## Entry conditions

- Stages 0–2 of docs/implementation-roadmap/ have passed.
- Aircraft package has a schema-valid manifest and exact variant configuration.
- Physical parameters have units, provenance, uncertainty and supported envelope.
- Required shared providers resolve; optional absent equipment is explicitly unavailable.
- Tests run headlessly with fixed tick, known scenario seed and recorded module/data versions.

## Acceptance scenarios

### F16-01 — Exact variant and dependency resolution
The F-16C Block 50 package loads only when required capabilities/version ranges are available. Missing/incompatible providers fail with actionable diagnostics. No Block 40/42/52 or export-specific fit is silently substituted.

### F16-02 — Configuration provenance
Every used mass, geometry, engine, aerodynamic, control and system parameter resolves to a schema-valid record with units and applicability. Unknown parameters remain unknown and cause an explicit fidelity limitation where needed.

### F16-03 — Coordinate and transform consistency
Aircraft body FRD, world ENU and local component transforms are consistent. Geometry/antenna/hardpoint/gear stations transform correctly. Round-trip and sign-convention tests pass.

### F16-04 — Mass properties and loading
Dry mass, fuel distribution and stores produce total mass, CG and inertia through the shared mass-property service. Fuel burn/transfer and store release update mass properties correctly within the sourced data envelope. No arbitrary handling multiplier is used.

### F16-05 — Flight-control command chain
Pilot input becomes a typed command; selected flight-control law/mechanical mapping and available actuator resources produce actual surface position. Saturation, rate limits, trim and failures are observable. Aerodynamics consume actual surface state, not requested input.

### F16-06 — Propulsion causal chain
The configured F110-GE-129 installation uses a shared turbofan family implementation. Throttle/start commands, spool state, fuel feed, temperature/pressure limits, thrust and failure states are causally connected. Accessory output is published only when available.

### F16-07 — Fuel, electrical, hydraulic and cooling dependencies
Fuel feed interruption affects engine operation; electrical allocation affects connected equipment; hydraulic loss affects only connected actuators/gear/brakes; cooling faults affect connected equipment. Diagnostics identify causal chain and unrelated systems remain isolated.

### F16-08 — Rigid-body and aerodynamic response
Forces/moments from configured surfaces, propulsion and contact systems feed shared 6-DoF solver. Static/trim and maneuver outputs fall within sourced/declared uncertainty envelopes. Timestep convergence and deterministic repeatability pass.

### F16-09 — Startup and cockpit interaction
Startup is a stateful sequence with prerequisites, timing, resource state, faults and recovery. Cockpit switches issue typed commands; instruments consume snapshots and show invalid/stale/degraded states. No control directly edits physics internals.

### F16-10 — Damage and failure propagation
Damage to a configured zone changes connected structural/resource/sensor/control behaviors. Partial damage differs from total failure. Faults are diagnosable and repairs follow declared lifecycle rules.

### F16-11 — Save, load and replay
A save records module/data versions, tick, configuration identity and subsystem-owned state. Load validates compatibility and migrations. Replaying commands and seed reproduces authoritative state within documented numerical tolerances.

### F16-12 — Performance and resource budget
Measure physics tick cost, render cost separately, memory and allocations in a documented desktop baseline. Do not invent numeric performance targets before a reference build is profiled; establish a baseline before expanding entity counts.

## Required evidence

For each scenario record test ID, fixture, module/data versions, seed, source dataset, assertions, tolerance, result and limitation. A visual demo or cockpit model alone is not acceptance.

Do not fabricate F-16 performance figures to pass a test. Where public data is insufficient, test internal consistency and explicitly mark the external validation gap.
