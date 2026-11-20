# MiG-29 product 9.13 — hydraulic installation

**Shared owner:** [game/systems/hydraulics](../../../../systems/hydraulics/README.md). **Selected platform:** single-seat product 9.13. **Status:** source-based architecture outline; the GAF manual's exact variant applicability to product 9.13 is not yet proven.

## Source-described main and boost circuits

GAF T.O. 1F-MIG29-1 describes two independent hydraulic systems:
- **Main hydraulic system:** supplies the second chamber of the taileron, aileron, rudder and AOA-limiter hydraulic actuators; landing gear; flaps/leading-edge flaps; speedbrakes; variable intake ramps; APU exhaust door; nose-wheel steering/damper; and rudder-feel-force actuator.
- **Hydraulic boost system:** supplies the first chamber of the dual-chamber taileron, aileron, rudder and AOA-limiter actuators.

This is a deliberate dual-chamber control architecture. It is not merely two interchangeable utility circuits. Model both chambers and their actual servo/actuator force contribution, pressure/flow feedback, isolation and degraded authority. Confirm the selected product 9.13's actuator/chamber arrangement before making this source topology authoritative.

The manual describes one variable-displacement piston pump per system, each mounted on and driven by the gearbox. It gives normal pump pressure in the range 19–22 MPa. The main-system pressure limiter/isolation valve disconnects non-flight-control consumers below 13 MPa and preserves a reduced control-surface/LEF/AOA-limiter supply through one chamber. Relief valves in both systems protect against overpressure.

## Emergency hydraulic pump

An emergency pump is installed in the hydraulic boost system. The source says it is driven by fuel pressure and activates automatically when both hydraulic pressures fall below 10 MPa; it may also be activated manually. It requires both engines to be at least 85% RPM to support basic control. Although pressure may rise as high as 24 MPa at zero delivery, the delivery rate supports only severely degraded aircraft control.

Important simulation implication: pressure alone is not a usable-capacity indicator. The emergency pump may create a high static pressure indication while delivering too little flow for useful actuator motion. The warning can extinguish when pressure rises above the threshold even though the condition must still be treated as a double hydraulic failure. Model pressure, flow, actuator rate and emergency-pump mode independently.

Do not equate this fuel-pressure-driven emergency boost pump with the F-16 EPU. It is not documented as a combined emergency electrical generator and hydraulic pump.

## Reservoir, accumulator, pneumatic and cooling connections

The source places both reservoirs inside fuel tank 3. Their two-chamber arrangement is described as maintaining pump feed under negative-G flight conditions. They are pressurized with low-pressure compressed air from the **main pneumatic system** through a pressure-regulating valve; relief valves prevent overpressure. This is a real cross-system coupling:
- Pneumatics supplies the reservoir gas-space pressure.
- Hydraulics conserves/updates hydraulic fluid inventory and pump inlet conditions.
- A pneumatic pressure loss can cause hydraulic pump inlet starvation/cavitation risk without directly emptying hydraulic fluid.

Each circuit has a nitrogen-charged hydraulic accumulator. The source gives 8 MPa nitrogen precharge and says accumulators damp pressure surges from sudden flow changes. Model their finite fluid capacity and precharge curve, not a permanent pressure bonus.

The reservoirs' location inside fuel tank 3 provides hydraulic fluid cooling through heat exchange with fuel in the source-described installation. Link hydraulic thermal state to the actual fuel temperature/flow/quantity and installed heat-exchange model. Do not directly set hydraulic temperature equal to fuel temperature.

## Indications and control interactions

The combined pressure indicator (CPI) shows main and boost hydraulic pressure and other pneumatic/accumulator indications. The source says the hydraulic pressure display uses 115 VAC from the AC generator. Therefore loss of AC generation can invalidate the gauge even if hydraulic pressure and actuation persist. A pressure warning is generated from its installed sensor/circuit; AFCS disengagement is described when both hydraulic pressures fall below 10 MPa until pressure is restored.

The platform package must represent sensor power, indication failure, stale/invalid display and actual underlying pressure separately. The landing gear selector is electrically controlled and hydraulically actuated. Nose-wheel steering has hydraulic/mechanical actuation plus electrical mode/control dependencies. These are cross-domain mechanisms, not all-hydraulic or all-electrical features.

## Failure and degraded-state matrix

| Fault | Expected response |
|---|---|
| Main pump/drive loss | Main pressure/flow decays; normal gear/flap/speedbrake/utility consumers connected only to main are affected; boost chamber remains only where its independent pump/lines work |
| Boost pump/drive loss | First chambers lose boost; second chambers retain main-circuit supply; flight control degrades according to dual-chamber actuator design |
| Main pressure below isolation threshold | Non-flight-control consumers are isolated by the documented limiter; a reduced one-chamber flight-control/LEF/AOA supply remains |
| Both circuits below emergency threshold | Fuel-pressure-driven emergency pump may start subject to both-engine RPM condition; low flow means severely degraded control |
| Reservoir pressure loss | Reduced pump inlet margin; cavitation/flow interruption risk; do not instantly remove all hydraulic fluid |
| Pneumatic main-system loss | Reservoir pressurization path is lost; hydraulic pressure may persist temporarily but pump inlet behavior can degrade |
| Accumulator precharge loss | Reduced transient buffering; steady pump capability remains if otherwise healthy |
| Fuel-tank cooling path failure | Fluid temperature rises under use; viscosity/pump/actuator performance responds to validated thermal limits |
| AC generation loss | CPI electrical indication may fail while actual hydraulic state remains |
| Hydraulic leak/rupture | Finite fluid loss and pressure/flow collapse only along connected lines/circuit; isolation and accumulator discharge are explicit |

## Exact 9.13 research gaps

Verify the GAF source's applicability to product 9.13; pump manufacturer/part numbers and curves; circuit pressure/flow values; fluid type/volume; reservoir geometry and pressurization setpoint; accumulator capacity/precharge; emergency-pump drive circuit, trigger logic and output; actuator dual-chamber port map and surviving authority; and detailed line/valve diagrams. Keep source-based numbers labeled as provisional until confirmed.

## Acceptance scenarios

- Independent main/boost pump operation and separate pressure/flow state.
- Simultaneous dual-chamber control movement with correct flow/pressure allocation.
- Main-circuit pressure loss and isolation of utility consumers while retaining reduced control capability.
- Boost-circuit loss and degraded single-chamber control.
- Dual loss, emergency pump trigger, engine RPM prerequisite, low-flow limitation and pressure-indicator caveat.
- Pneumatic reservoir-pressurization loss, negative-G feed behavior and accumulator depletion.
- Fuel/hydraulic thermal coupling and heat-exchanger failure.
- AC-powered CPI failure while hydraulic actuation persists.
- Landing gear electrically commanded/hydraulically actuated plus separate pneumatic emergency lowering.
- Deterministic replay and fluid/energy conservation.
