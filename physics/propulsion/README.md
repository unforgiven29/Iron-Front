# Propulsion and engine-family models

**Owner:** physics/propulsion. **Status:** folders/documentation only; no thermodynamic engine solver exists.

Model dynamic propulsion families: turbojet, low/high-bypass turbofan, afterburning turbofan, piston, turboprop, turboshaft and rocket motor as applicable. Shared interfaces do not justify one generic curve with family multipliers.

Inputs: throttle/control request, ambient state, inlet recovery/distortion, spool state, fuel grant/pressure/flow, accessory load, nozzle/afterburner configuration and health. Outputs: thrust vector, fuel demand, spool transient, temperatures, pressures, mass flow, exhaust/thermal state, torque/accessory power, limits and faults.

Capture transient spool inertia/rate limits, corrected maps, inlet/nozzle installation, combustion/reheat, altitude/Mach lapse, start/stop/relight, thermal limits and failures only to a validated tier. Aircraft provides exact engine fit, installation, control mapping and source data. Fuel inventory is owned by game/systems/fuel; rigidbody integrates thrust.

Validate steady and transient maps, altitude/Mach trends, start/shutdown/relight, afterburner stages, starvation, inlet fault, thermal limits, damage and replay. Unknown/classified values remain unknown.
