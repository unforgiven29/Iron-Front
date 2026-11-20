# Aircraft hydraulic power and actuation supply

**Owner:** game/systems/hydraulics. **Status:** architecture specification; a complete hydraulic-network solver is not implemented.

This system models hydraulic fluid power as a finite, connected, dynamic network. Aircraft packages define exact circuits, pumps, reservoirs, fluid, accumulators, lines, valves, isolation logic, actuators and emergency supply. The shared solver models those installed components; it must not impose a universal number of circuits or assume all aircraft use the same pressure, fluid, backup or crossfeed arrangement.

## Ownership boundary

- Hydraulics owns fluid inventory in its reservoirs/lines, pressure, flow, pump output, accumulator state, temperature/contamination, valve/line state, circuit isolation and delivered actuator supply.
- game/core/resources arbitrates shared typed resource capacity. It does not set hydraulic pressure or instantly satisfy a flow request.
- physics/propulsion owns engine/gearbox/shaft speed and torque. The aircraft installation couples engine-driven pumps to it. A hydraulic pump's mechanical load feeds back through the correct accessory interface.
- Flight controls, landing gear, brakes, steering, doors, ramps and turrets own their mechanical/actuator response to actual supply. Hydraulics does not teleport a control surface to a requested angle.
- physics/thermal owns heat-transfer mathematics; game/systems/cooling owns installed oil/fuel/air/coolant cooling paths.
- Pneumatic reservoirs and gas circuits are owned by game/systems/pneumatics; pneumatic pressure may pressurize a hydraulic reservoir or operate an emergency device through an explicit interface, but the fluids/circuit solvers remain separate.

## Installation components

Represent only fitted components, with stable IDs and explicit topology:

- Engine-, gearbox-, APU-, EPU-, electric- or other driven pumps; fixed/displacement-controlled or variable-displacement pump behavior.
- Independent circuits, dedicated boost/utility circuits, shared reservoirs or isolated reservoirs, return manifolds and case drains.
- Reservoirs with fluid capacity, usable volume, head/pressurization, pickup geometry, baffles, vent/pressurization interface and low-level indication.
- Pressure/return/suction lines, hoses, unions, filters, restrictions, orifices, check valves, isolation valves, pressure regulators, relief valves, priority valves and crossfeed valves.
- Accumulators: bladder/piston/spring or other supported architecture, gas type/precharge, fluid volume, pressure-volume characteristic, check/isolation and thermal state.
- Servo valves, proportional valves, actuators, motors, brakes, steering units, landing-gear actuators, flight-control cylinders and load-sensing devices.
- Pressure/quantity/temperature/flow sensors and the actual instruments or caution circuits that read them.

A circuit graph must preserve physical separation. Two circuits may share an actuator with separate chambers, a common component, a return path or an emergency source; encode the documented common-mode risks. Do not make independent circuits crossfeed just because both exist.

## Runtime physics

Track pressure and flow through time, not a constant pressure field. At the declared fidelity, model pump pressure-flow capability versus drive speed, displacement/control, inlet conditions, fluid temperature and wear; fluid compressibility/bulk modulus, line volume, line resistance/restriction and local losses; reservoir usable inventory, pressurization, gas ingestion/cavitation margin, acceleration/gravity effects and negative/low-G feed behavior where installed; accumulator gas precharge and pressure/volume curve, stored usable fluid, discharge rate, recharge time and check-valve isolation; valve spool/command/response, finite movement time and stuck/leaking behavior; and actuator demand as pressure × effective area or motor torque relationship, flow as displacement × speed, mechanical load, friction, leakage, rate limit, stroke, stops and feedback.

Pressure, flow, force and actuator motion are related but not interchangeable. Pressure without sufficient flow may maintain a static load while failing to move a surface at commanded rate. A pump cannot instantly refill an accumulator or restore pressure after a rupture. A high pressure indication at a trapped accumulator may coexist with near-zero useful circuit delivery.

Start with a conservative lumped hydraulic network (pump curves, node pressures, branch flow and finite fluid compliance) and increase fidelity only where it changes actuator behavior or failure propagation. Declare the model envelope and numerical stability limits.

## Actuator/consumer contract

Every consumer declares circuit port(s), actuator geometry, operating pressure range, required flow versus commanded movement, maximum force/torque, stroke, response/rate limit, load profile, fail-safe position/locking behavior, leakage and sensor feedback. Dual-chamber actuators must expose which chamber is supplied by which circuit and how differential pressure produces force. Mechanical linkages and surface mixing are outside the network owner.

A consumer receives actual delivered pressure/flow and faults. It returns its actual motion/demand and may stall, slow, hold, drift or lose authority. A cockpit command is a requested action, not a direct position write.

## Failure and backup behavior

Support independent component/circuit failures: pump seizure or loss of drive; pump wear/low output; reservoir depletion; suction starvation/cavitation; line rupture, leak or restriction; filter blockage; relief valve stuck open/closed; check valve failure; isolation/priority/crossfeed valve stuck; accumulator precharge loss or bladder failure; actuator internal/external leakage; contamination; fluid overheating; gas ingestion; pressure sensor failure and wiring/power loss.

Backups are modeled as explicit physical paths with their own prerequisites, capacity, start time, endurance and degraded performance:
- A second independent pump/circuit can retain only the functions connected to it.
- A dual-chamber actuator may retain reduced authority if one chamber is lost, depending on its mechanical design.
- An accumulator is short-duration stored hydraulic energy, not a continuously replenishing alternate pump.
- An emergency pump may require fuel pressure, engine RPM, electrical command or another input and may have insufficient flow for normal maneuvering.
- A pneumatically extended landing gear is an alternate deployment mechanism, not proof that the normal hydraulic actuator network is restored.
- A common emergency unit can feed both electrical and hydraulic systems. Its output and consumable/fuel limits must be shared, not independently duplicated.

Do not call an aircraft hydraulically redundant without specifying the surviving loads, pressure, flow, rate, control authority, time/endurance and common failure points.

## Update and integration order

After mechanical drive state is known, compute pump capability and reservoir/accumulator state; solve circuit flow/pressure and protection/isolation; publish actual consumer port supply; then update actuators and mechanisms; finally publish feedback/indications and thermal loads. Use fixed time and deterministic solver ordering. If the aircraft has separate hydraulic systems, solve their state independently and exchange only through explicit hardware paths.

Hydraulic pressure warning logic is an aircraft/equipment installation, not a universal global threshold. Cockpit indicators may use an electrically powered transmitter/instrument; the underlying hydraulic behavior still exists when that instrument loses electrical power.

## Required validation

- Pump pressure/flow curves across shaft RPM, displacement, fluid temperature and inlet pressure.
- Static hold, rapid repeated actuator movements and simultaneous peak demand.
- Pressure drop and flow allocation across realistic line restrictions.
- Accumulator charge/discharge, precharge loss and isolated trapped pressure.
- Reservoir quantity, pressurization, cavitation, negative-G feed and low-level behavior where installed.
- Single-circuit failure with exact surviving/failed consumers and actuator rate/authority.
- Leak location, rupture size, isolation time and finite fluid loss.
- Emergency pump activation prerequisites, response delay, low-flow degraded control and endurance.
- Landing-gear normal and emergency extension as separate paths.
- Coupled electrical/hydraulic/EPU failure and recovery.
- Save/load/replay, unit checks, numerical stability, energy/fluid conservation and performance.

## Data and evidence rules

Every pump, circuit, pressure, fluid type, capacity, reservoir location, valve, accumulator precharge, line and actuator port map needs exact variant applicability, units, source document/page, revision/date, confidence and review state. Unknown crossfeed or backup topology remains unknown; never fabricate a second pump, emergency ram, accumulator or pressure threshold to make a platform resilient.

## First implementation slice

Implement validated topology and component state, one engine-driven pump, one reservoir, pressure/return lines, a valve, an accumulator, one loaded actuator and one leak/isolation fault. Prove finite flow, pressure decay, rate degradation and replay before adding multi-circuit redundancy. The exact F-16 and MiG-29 guides are separate installation records, not templates for shared solver assumptions.
