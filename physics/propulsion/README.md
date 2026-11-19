# Propulsion

**Status: placeholder source structure plus design documentation. No engine thermodynamic solver is implemented yet.**

Propulsion models must produce thrust, torque/power, fuel demand, thermal state, pressures, operating limits and failures from dynamic engine state. Throttle is a command, not instantaneous thrust. Different engine families must use distinct physical models and aircraft-specific data.

Read:
- [Propulsion architecture](../../docs/propulsion/README.md)
- [Claude implementation guide](../../docs/propulsion/CLAUDE_IMPLEMENTATION_GUIDE.md)
- [Professional flight model integration](../../docs/flight-model/README.md)

## Folder responsibilities

| Area | Responsibility |
|---|---|
| engine-families | Family-specific turbojet, turbofan, piston, turboprop and turboshaft behavior |
| spool-dynamics | Rotating spool inertia, acceleration/deceleration and transient response |
| thrust-maps | Engine-specific performance maps and environmental lapse |
| combustion | Fuel-air energy addition, efficiency, pressure loss and flame stability abstractions |
| inlets | Inlet recovery, distortion and aircraft-installation effects |
| nozzles | Fixed/variable nozzle area, expansion and thrust-vector installation |
| afterburner | Reheat fuel scheduling, light-off, staging, limits and failure |
| fuel-flow | Engine fuel metering/demand interface; tank ownership remains with the fuel system |
| startup-shutdown | Start sequencing, ignition, starter, stabilization, shutdown and relight |
| thermal-limits | Component temperatures, pressure limits, transient exceedances and cooling |
| failures | Surge/stall, flameout, fire, damage, wear, sensor/actuator and control faults |
| propellers | Propeller aerodynamic/load and governor interfaces for applicable engines |
| data | Engine designation, variant, maps, source provenance and uncertainty |
| validation | Reference cases, transient tests, boundary tests and performance profiles |

## Non-negotiable boundaries

- Engine models do not set aircraft velocity or own aircraft fuel tanks.
- Engine force/moment outputs are consumed by the rigid-body solver.
- Atmosphere supplies ambient conditions; engine installation handles inlet/nozzle effects.
- Aircraft variants select exact engine fit, controls, limits and cockpit instruments.
- Graphics and audio visualize engine state but never determine thrust or failure.
- Do not use one generic thrust curve for every engine family or aircraft.
