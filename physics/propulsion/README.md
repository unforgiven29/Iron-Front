# Propulsion and engine-family models

**Owner:** physics/propulsion. **Status:** mixed-flow afterburning turbofan gas-path model implemented in `game/src/physics/propulsion/MixedFlowTurbofan.ts` (tests: `game/tests/unit/MixedFlowTurbofan.test.ts`). Other engine families, real component maps, stall/surge, variable geometry, bleed/power extraction, nozzle scheduling, start/relight and damage are not implemented.

## Implemented contract
- **0-D quasi-steady cycle:** freestream → MIL-E-5008B inlet recovery → fan → core compressor → burner (5 % pressure loss) → turbine (energy balance with fan and compressor work) → energy-balance mixer → afterburner → ideally expanded nozzle (Cv). Net thrust = gross − ram drag. Fuel flow comes from burner and afterburner energy balance with kerosene LHV.
- **Fidelity tier:** "generic-map cycle". Corrected flow ∝ Nc, pressure rise ∝ Nc², TIT scheduled with Nc. Altitude/Mach lapse, ram drag and the afterburner fuel penalty are emergent. Accuracy away from the calibration point is not validated against engine data.
- **`calibrate()`** solves the design TIT and max AB temperature so sea-level static thrust matches published dry and AB ratings.
- **`MixedFlowTurbofan`:** throttle with AB detent; first-order spool up/down; afterburner only above 97 % spool after a light delay, rate-limited; fuel starvation causes flameout and spool-down.

Model dynamic propulsion families: turbojet, low/high-bypass turbofan, afterburning turbofan, piston, turboprop, turboshaft and rocket motor as applicable. Shared interfaces do not justify one generic curve with family multipliers.

Inputs: throttle/control request, ambient state, inlet recovery/distortion, spool state, fuel grant/pressure/flow, accessory load, nozzle/afterburner configuration and health. Outputs: thrust vector, fuel demand, spool transient, temperatures, pressures, mass flow, exhaust/thermal state, torque/accessory power, limits and faults.

Capture transient spool inertia/rate limits, corrected maps, inlet/nozzle installation, combustion/reheat, altitude/Mach lapse, start/stop/relight, thermal limits and failures only to a validated tier. Aircraft provides exact engine fit, installation, control mapping and source data. Fuel inventory is owned by game/systems/fuel; rigidbody integrates thrust.

Validate steady and transient maps, altitude/Mach trends, start/shutdown/relight, afterburner stages, starvation, inlet fault, thermal limits, damage and replay. Unknown/classified values remain unknown.
