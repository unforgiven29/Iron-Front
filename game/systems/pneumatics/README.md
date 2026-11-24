# Aircraft pneumatic and stored-gas systems

**Owner:** game/systems/pneumatics. **Status:** first slice implemented — `game/src/systems/pneumatics/PneumaticNetwork.ts` (see Implementation status). The rest of this guide is the full specification.

Pneumatics is a distinct stored/compressed-gas system. It is not a hydraulic circuit and must not be simulated as a pressure flag or as a branch of the hydraulic solver. Aircraft packages define gas type, reservoirs/bottles, regulators, isolation, valves, actuators and consumers. The shared system models finite gas inventory, pressure and delivery through those paths.

## Typical installed functions

Only include functions proven for the exact aircraft/variant:
- Emergency landing-gear extension or release/lock actuation.
- Normal or emergency wheel brakes.
- Canopy opening, locking and sealing.
- Drag chute deployment/jettison.
- Fuel shut-off valve actuation.
- Hydraulic reservoir pressurization and anti-cavitation supply.
- Avionics/radar/radio compartment pressurization or ventilation.
- Emergency systems, pneumatic starters or other gas-driven actuators where fitted.

Some aircraft use pneumatic brake accumulators, others hydraulic brakes, and others combine gas storage with hydraulic actuation. These are not interchangeable.

## Model

Represent gas species/composition, bottle volume, initial fill pressure/temperature, allowable pressure, regulator set points, valve state, line volume/restriction/leak, check-valve direction, pressure gauge/transmitter, consumer demand and discharge characteristics. Track gas mass or equivalent conserved inventory; pressure changes with consumption, temperature and connected volume. Include gas expansion cooling and thermal recovery where relevant to the required fidelity.

Each bottle and subsystem has explicit charging/servicing behavior. If a manual states that a system is not charged in flight, it must not recharge itself after each use. Check valves prevent unintended crossfeed when fitted. A shared charging point does not mean main and emergency circuits are cross-connected.

A consumer requests a defined pressure/flow/time profile and reports actual delivery. Emergency deployment may be one-shot or have limited retries. Pressure sufficient to move a mechanism once does not imply enough reserve for another actuation.

## Failure and degradation

Model bottle leakage/depletion, regulator failure, stuck or leaking valve, line rupture/restriction, blocked charging point, check-valve failure, contamination/moisture where appropriate, pressure-indication failure and damage to the connected mechanism. A failure affects only physically connected consumers. A pressure indication can be wrong independently of actual gas state.

## Integration rules

Pneumatic pressure can provide a separate emergency input to a landing-gear mechanism, operate a brake actuator, or pressurize a hydraulic reservoir through a regulator. These are typed cross-system connections:
- Gas is consumed by the pneumatic network.
- Any resulting mechanical action is handled by the mechanism/actuator owner.
- If gas pressure pressurizes hydraulic reservoir headspace, hydraulics receives a boundary pressure input; gas inventory and hydraulic fluid quantity remain separately conserved.
- Electrical anti-skid or valve controls consume electricity even when the braking force itself is pneumatic.
- A pneumatic emergency deployment does not restore normal electrical control or normal hydraulic pressure.

## Required validation

Test bottle fill/servicing, pressure-versus-consumption, temperature response, regulator behavior, check-valve isolation, one-shot and repeated deployment, emergency reserve separation, leak/rupture, low pressure and damage. For emergency landing gear, prove the exact sequence, locking, indications and post-deployment restrictions of the installed mechanism. Include combined electrical/hydraulic/pneumatic failures without granting power or pressure from nonexistent paths.

## Data and provenance

Each gas bottle, fill pressure, volume, consumer, regulator, deployment sequence, recharge restriction and failure threshold needs an exact platform/variant source. Do not reuse the MiG-29's two-bottle system or the F-16's emergency gear-extension arrangement as a generic aircraft standard.

## First implementation slice

Implement a finite nitrogen bottle, regulator, isolation/check valves, a line and a one-shot emergency actuator. Validate gas inventory, pressure decay, actuation completion/insufficient-pressure failure and replay. Add species/thermal complexity only when it changes behavior.

## Implementation status

Implemented (`game/src/systems/pneumatics/PneumaticNetwork.ts`, tests `game/tests/unit/Pneumatics.test.ts`):
- Gas systems as lumped ideal-gas nodes (bottles share a manifold), gas inventory in mol, servicing to a charge pressure, no in-flight recharge, optional thermal relaxation to ambient.
- Check-valve isolation between systems; `check-valve-failed` crossfeeds towards pressure equality (gas conserved).
- Regulators (outlet = min(setpoint, upstream); failed closed/open), consumers with continuous flow and discrete strokes, supply fraction for the mechanism owner.
- Faults: system leak, regulator failure, check-valve failure.
- Aircraft runtime: `AircraftDefinition.pneumatics`, `AircraftSystems.pneumaticLoads` (consumer use, hydraulic pump inlet fraction, alternate gear extension), `FlightSensors.pneumaticPressuresPa`, snapshot `pneumatics`. A landing-gear supply id may name a pneumatic consumer (e.g. brakes).
- Cross-system: `HydraulicStepOptions.pumpInletFraction` (reservoir pressurisation boundary condition); `LandingGear` per-leg extension with alternate extension rates and normal-actuation isolation.

Not implemented: gas species, adiabatic discharge cooling, line volumes/restriction, stuck/leaking consumer valves, line rupture, blocked charging point, pressure-indication failure, save/replay of network state.
