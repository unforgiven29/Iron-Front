# Propulsion and engine-family models

**Owner:** physics/propulsion. **Status:** mixed-flow afterburning turbofan plant (`game/src/physics/propulsion/MixedFlowTurbofan.ts`) and a shared FADEC engine control (`game/src/physics/propulsion/Fadec.ts`), tests in `game/tests/unit/MixedFlowTurbofan.test.ts`. Other engine families, real component maps, stall/surge, variable geometry, bleed/power extraction, nozzle scheduling, start/relight, fault detection and damage are not implemented.

## Implemented contract
- **0-D quasi-steady cycle:** freestream → inlet component → fan → core compressor → burner (5 % pressure loss) → turbine (energy balance with fan and compressor work) → energy-balance mixer → afterburner → nozzle component. Net thrust = gross − ram drag. Fuel flow comes from burner and afterburner energy balance with kerosene LHV.
- **Fidelity tier:** "generic-map cycle". Corrected flow ∝ Nc, pressure rise ∝ Nc², TIT scheduled with Nc. Altitude/Mach lapse, ram drag and the afterburner fuel penalty are emergent. Accuracy away from the calibration point is not validated against engine data.
- **`calibrate()`** solves the design TIT and max AB temperature so sea-level static thrust matches published dry and AB ratings.
- **Components (`game/src/physics/propulsion/components/`):** the parts that really differ between engines and airframes are swappable objects in `TurbofanDesign`.
  - `Inlet.ts`: `pitotInlet(subsonicRecovery)` (fixed pitot, exact normal-shock recovery above Mach 1, e.g. F-16) and `milE5008bInlet()` (efficient ramp/cone inlet).
  - `Nozzle.ts`: `idealNozzle(Cfg)` (always perfectly expanded) and `variableConvergentDivergentNozzle(spec)`. The C-D nozzle has a throat area (choked or subsonic flow), a linked exit/throat area ratio, isentropic exit Mach, momentum plus pressure thrust (under-/over-expansion), a separation approximation, and reports the throat area the flow needs.
  - **Back-pressure matching:** if a held throat is too small for the flow, the cycle raises the turbine inlet temperature until the flow passes (the turbine must work harder against the higher pressure). The FADEC's turbine-temperature limiter then slows the engine. This is how a closed nozzle costs thrust.
  - Compressor, burner, turbine and mixer stay inside the cycle: every turbofan has them, so splitting them would add files without adding choices.
- **Signal flow:** throttle → `Fadec` (control) → speed and afterburner demand → `MixedFlowTurbofan` (plant) → thrust. The pilot never sets fuel or spool speed directly.
- **`MixedFlowTurbofan` (plant):** follows the demanded spool speed with a first-order rotor lag; afterburner follows the demand; fuel starvation causes flameout and run-down. No limits live here, and `solveCycle` is a pure cycle with no control logic.
- **`Fadec` (control), configured by a package `FadecSchedule`:** throttle map (idle → MIL, AB detent); model-based limiters using the cycle as the on-board engine model (max physical speed, max corrected speed, compressor-exit temperature, turbine-inlet temperature, minimum burner pressure that raises idle at altitude); acceleration and deceleration rate schedules; afterburner sequencing (core at scheduled max, burner-pressure light-off envelope, light delay, rate); `primary`/`backup` modes (backup: optional speed cap, slower acceleration, optional AB inhibit, optional nozzle held closed). The FADEC also commands the nozzle throat (`auto` = open to what the flow needs). `scheduleSteadyState()` gives the steady operating point for performance tools. Output reports the active limiters.

Model dynamic propulsion families: turbojet, low/high-bypass turbofan, afterburning turbofan, piston, turboprop, turboshaft and rocket motor as applicable. Shared interfaces do not justify one generic curve with family multipliers.

Inputs: throttle/control request, ambient state, inlet recovery/distortion, spool state, fuel grant/pressure/flow, accessory load, nozzle/afterburner configuration and health. Outputs: thrust vector, fuel demand, spool transient, temperatures, pressures, mass flow, exhaust/thermal state, torque/accessory power, limits and faults.

Capture transient spool inertia/rate limits, corrected maps, inlet/nozzle installation, combustion/reheat, altitude/Mach lapse, start/stop/relight, thermal limits and failures only to a validated tier. Aircraft provides exact engine fit, installation, control mapping and source data. Fuel inventory is owned by game/systems/fuel; rigidbody integrates thrust.

Validate steady and transient maps, altitude/Mach trends, start/shutdown/relight, afterburner stages, starvation, inlet fault, thermal limits, damage and replay. Unknown/classified values remain unknown.
