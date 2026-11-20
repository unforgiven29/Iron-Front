# F-16C Block 50 — first vertical-slice acceptance suite

**Purpose:** Define what "the first aircraft works" means before aircraft implementation begins. These are acceptance requirements, not claims the F-16 simulation exists.

**Target:** F-16C Block 50, using the selected baseline in game/modules/planes/F-16/docs/variant-baseline.md. Re-check operator/date/equipment applicability before detailed data is accepted. See the aircraft installation dossier in game/modules/planes/F-16/systems/.

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

### F16-13 — Normal electrical generation and distribution
Battery-only pre-start, external ground power acceptance/rejection, main and standby source availability, AC/DC conversion, bus voltage/frequency, branch load accounting and protection behave according to the exact installation. A connected load receives only the waveform and power actually delivered by its bus.

### F16-14 — Electrical source failure, transfer and load shedding
Test main generator loss, standby failure, bus tie/contactor failure, converter fault, battery depletion and local short/open faults separately. Verify only connected loads are affected, transfer delay is observable, and the configured emergency/non-emergency load-shedding list is applied. Restoration does not instantly reset equipment that requires restart/warm-up.

### F16-15 — Dedicated flight-control electrical supply
Test the FLCS PMG and each configured FLCS electrical branch/relay independently. Verify the documented battery transfer/backup path, branch-specific failures, monitoring and degraded behavior. Do not infer that the main avionics battery bus is interchangeable with dedicated FLCS supply.

### F16-16 — Hydraulic A/B circuit split and partial authority
With both circuits healthy, simultaneous flight-control and utility demands produce finite pressure/flow and correct actuator rates. Fail A only, B only, a pump drive, a line or a valve: prove which utilities disappear, which flight-control actuator chambers remain supplied, the actual reduced maximum actuation rate, and isolation of unrelated branches. No automatic crossfeed is allowed unless the exact installation has it.

### F16-17 — Accumulator and stored-pressure behavior
Test each FLCS accumulator and brake/JFS accumulator as finite stored energy with precharge, charge source, isolation/check valves, usable volume, leakage and recharge timing. Verify transient bridging and backup braking/start behavior only within the documented reserve. An accumulator must not behave like a continuously operating pump.

### F16-18 — EPU as one coupled emergency machine
Trigger EPU operation from each documented automatic/manual condition and test DC activation permissives, startup delay, fuel/drive state, emergency AC/DC bus energization, load shedding and System A hydraulic output. Electrical and hydraulic output share one machine state, finite endurance, consumable source and common failure. The EPU must not feed every normal bus or restore every hydraulic consumer.

### F16-19 — Pneumatic emergency landing-gear extension
With normal System B unavailable, execute the actual documented emergency extension sequence and prove gear deployment/locking through the separate pneumatic path. This must not restore System B pressure, normal retraction, brakes, steering or unrelated utilities. Insufficient reserve, leaking bottle, stuck valve and failed indication are distinct cases.

### F16-20 — Cross-domain indication and recovery
Remove electrical power from hydraulic gauges/warning displays while leaving hydraulic source state intact. Verify invalid/stale indication is distinguishable from an actual low-pressure condition. Test simultaneous electrical, hydraulic, pneumatic and cooling faults, then recovery under the installation's restart/reset/maintenance rules.

## Required evidence

For each scenario record test ID, fixture, module/data versions, seed, source dataset, assertions, tolerance, result and limitation. A visual demo or cockpit model alone is not acceptance.

Do not fabricate F-16 performance figures to pass a test. Where public data is insufficient, test internal consistency and explicitly mark the external validation gap. Do not convert a manual covering multiple blocks/engine options into exact F110 Block 50 values without checking applicability.
