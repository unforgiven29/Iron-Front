# F-16C Block 50 — hydraulic installation

**Shared owner:** [game/systems/hydraulics](../../../../systems/hydraulics/README.md). **Platform:** F-16C Block 50, GE F110-GE-129. **Status:** first implementation in `game/src/platforms/aircraft/f16c-block50/F16Hydraulics.ts` (A/B circuits, F110-driven pumps, FLCS accumulators, EPU pump on A, dual-fed primary surfaces, speedbrake on A). Component sizes are estimated (see F16_HYDRAULICS in F16Data.ts); utilities, LEF actuators, the EPU's electrical half and the brake/JFS accumulator are not modelled yet.

## Installation described by the available Block 50/52+ manual

The HAF T.O. GR1F16CJ1 describes two independent 3000-psi hydraulic systems, A and B, with independent engine-driven pumps and reservoirs. Both normally operate together and supply primary flight controls and leading-edge flaps. If one system fails, the other can retain sufficient pressure for flight control, but maximum FLCS actuation rate is reduced. This is a degraded mode, not full redundancy.

The same manual assigns utility functions asymmetrically:
- **System A:** primary flight-control/LEF contribution, the FFP (retain the manual's designation until its exact installed component is resolved), and speedbrakes.
- **System B:** the other utility functions listed in the manual, including gun/gun-purge door, aerial-refueling system, landing gear, brakes and nose-wheel steering; it also charges the brake/JFS accumulator under specified engine-running conditions.
- **Both A and B:** each has an isolated FLCS accumulator behind check valves. These buffer rapid surface demand and bridge the period while the EPU comes up after dual-system loss.

The exact actuator-to-port map, return plumbing and F110 accessory-drive applicability still need a component-level diagram. Do not infer that every flight-control actuator uses identical dual-feed plumbing merely from the system-level description.

## Emergency and stored-pressure paths

- **Single A or B failure:** the surviving normal circuit may retain primary flight-control capability at a reduced maximum actuation rate. Utility functions connected only to the failed circuit are lost or degraded; do not move them automatically to the survivor.
- **System B loss:** the manual describes pneumatic emergency landing-gear extension. This deploys the gear; it does not make normal System B pressure available.
- **Brake/JFS accumulator:** System B charges it when the specified engine RPM condition is met. It supplies JFS start power and backup brake pressure. Model charge time, stored energy/pressure, leakage and actual reserve rather than treating it as an unlimited secondary hydraulic pump.
- **Dual A/B pressure loss:** the EPU-driven third hydraulic pump supplies/augments System A. The isolated FLCS accumulators bridge transient startup. The EPU's capacity and runtime are finite.
- **EPU coupling:** the EPU is one emergency machine with both electrical and hydraulic outputs. It is triggered by the documented electrical/hydraulic conditions and requires DC power for activation. Its fuel/drive state, startup delay and common failure must be modeled once and shared by both outputs.

The manual describes the EPU as driven by engine bleed air when sufficient and supplemented by hydrazine when bleed air is insufficient. The precise start mode, switch logic, ground safety and consumable behavior must follow the selected configuration's source rather than a simplified always-on emergency source.

## Thermal and fluid dependencies

The flight manual points to the engine fuel supply system for hydraulic cooling. Model only the documented installed heat-exchange path and its actual flow/temperature coupling. Hydraulic temperature must respond to pump/actuator work, leakage/throttling losses and cooling availability; do not clamp it to ambient or directly map fuel quantity to hydraulic pressure.

Model separate A/B reservoirs and pumps, pressure/return network, check valves, relief/isolation logic, accumulator interfaces, sensors and cockpit indications. Each hydraulic pressure gauge or warning is powered by the actual electrical bus used by the installed instrument; losing the gauge circuit does not instantly remove hydraulic pressure.

## Failure matrix to implement

| Fault | Expected behavior to model |
|---|---|
| A pump/drive loss | A pressure/flow decay; A-only utilities lost; primary controls/LEF continue only to the extent supported by B and installed actuator topology |
| B pump/drive loss | B pressure/flow decay; B-only utility loss; surviving primary control capability with reduced actuation rate; pneumatic gear extension path remains separately available |
| One A/B line rupture | Fluid depletion and pressure collapse isolated to the affected circuit/segment according to installed isolation valves; no automatic global loss |
| Accumulator precharge/bladder fault | Reduced transient flow support/bridge duration; normal pump pressure may still exist |
| Both normal systems lost | EPU startup and its finite System A supply; FLCS accumulators bridge startup; severely degraded/limited operation must be represented |
| Electrical bus loss to valve/control | Only electrically operated valves/controls on the affected bus respond according to their fail position; mechanical/hydraulic paths may persist |
| Cooling path loss | Fluid temperature rises under demand and may derate/fail connected components according to validated limits |

## Data still required before authoritative simulation

1. F110-GE-129-specific accessory gearbox/pump drive map and exact installed pump part numbers.
2. A/B reservoir usable volumes, fluid specification, pressure/flow curves, temperature limits and servicing parameters.
3. Complete A/B pressure/return plumbing and check/priority/relief valve setpoints and response.
4. Primary flight-control actuator chamber map and exact residual authority/rate after A-only or B-only failure.
5. FLCS accumulator type, precharge, usable volume and discharge/recharge curves.
6. Brake/JFS accumulator details and exact recharge/consumer arrangement.
7. EPU pump output curve, trigger logic for this configuration, startup delay, run time and emergency-control envelope.
8. Source pages confirming every value applies to the selected F110 Block 50.

Unverified values stay unknown/provisional. Do not manufacture precise thresholds or actuator rates to make the system appear complete.

## Acceptance scenarios

- Normal A/B operation under simultaneous flight-control, LEF, speedbrake and utility demand.
- A-only and B-only loss with the correct consumer split and reduced control rate.
- Accumulator bridging during rapid control input and EPU startup.
- EPU activation from electrical and hydraulic triggers; both outputs share one state and limited endurance.
- B-system loss followed by pneumatic emergency gear deployment, including the inability to treat it as restored hydraulics.
- Pump/line/valve/accumulator/cooling failures and fault isolation.
- Gauge electrical-power loss with hydraulic state preserved but indication invalid.
- Deterministic replay and mass/thermal/resource accounting.
