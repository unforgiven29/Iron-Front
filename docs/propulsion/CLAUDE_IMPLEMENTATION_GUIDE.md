# Claude Implementation Guide — Propulsion and Engine Systems

This is an implementation brief, not a claim that engine simulation already exists. The propulsion folders currently contain placeholders. Audit the repository before writing code.

## 1. Audit first; do not build a parallel engine

Inspect the current runtime, aircraft modules, fuel/electrical/hydraulic systems, atmosphere, rigid-body solver, damage, cockpit, audio and test/build setup. Identify existing engine/thrust code and its callers. Produce a short migration plan showing what will be reused, replaced or adapted. Preserve current gameplay until replacement models pass regression tests.

Do not assume a framework, physics library or file layout that is not present. Do not migrate the build system merely to implement engines.

## 2. Canonical ownership

- `physics/propulsion/`: reusable family solvers, component models, maps, transient dynamics and engine failure physics.
- `game/modules/planes/<variant>/`: exact engine fit, installation, control architecture, aircraft limits and instrument mapping.
- Existing fuel-system owner: tank inventory, pumps, valves, feed/transfer and fuel quantity.
- Existing electrical/hydraulic owners: available bus power and pressure; engine accessories are consumers/providers through explicit contracts.
- Atmosphere owner: ambient pressure, temperature, density and air-relative conditions.
- Rigid-body owner: applies engine forces and moments at correct locations.
- Graphics/audio: presentation only.

Choose one canonical owner for each responsibility. Do not create a second fuel system, atmosphere or aircraft state model.

## 3. Build an end-to-end thin slice

Implement one documented engine/aircraft pairing first. The first slice must include:
1. Typed engine configuration and runtime state.
2. Explicit units, coordinate frames and simulation-time contract.
3. Throttle command and aircraft-specific control path.
4. Dynamic spool state and a sourced/clearly estimated thrust map.
5. Fuel demand/flow interface.
6. Ambient pressure/temperature/Mach effects.
7. Force/moment output to the aircraft solver.
8. RPM/temperature/fuel-flow instrument outputs.
9. Deterministic tests and a small diagnostic scenario.

Only after this slice validates should you generalize the family interface or add another engine.

## 4. Non-negotiable rules

- Throttle is not thrust; model transient response.
- Never set aircraft speed or acceleration directly from throttle.
- Never use one generic thrust multiplier for all engine types.
- Keep configuration separate from runtime state.
- Engine does not own aircraft fuel tanks or cockpit rendering.
- Use actual aircraft/engine variant data; label estimates and synthetic data.
- Model limits through control scheduling and component state, not arbitrary post-hoc clamps.
- Failure effects must propagate through real dependencies.
- Player and AI aircraft use the same engine physics contract.
- Physics time is fixed/controlled and independent of render delta.
- Never silently downgrade player engine physics to meet frame rate.

## 5. Model stages in order

A practical progression:
- **Stage A — baseline:** static thrust/power maps and a spool-response model.
- **Stage B — environment:** altitude, Mach, ambient temperature and inlet recovery.
- **Stage C — gas path:** family-specific compressor/fan, combustor, turbine, bypass and nozzle reduced-order states.
- **Stage D — control:** hydromechanical/FADEC logic, fuel schedule, start and relight.
- **Stage E — secondary systems:** bleed, accessory loads, oil, cooling and instruments.
- **Stage F — degradation:** surge/stall, overtemperature, damage, wear, fire and maintenance.
- **Stage G — installation:** inlet distortion, nozzle location, asymmetric thrust, mass/CG and heat coupling.

Do not implement every family at once. Choose a representative aircraft and define a measurable envelope.

## 6. Data and numerical requirements

Use SI internally and explicit conversion at UI/data boundaries. Define sign conventions for thrust, torque and engine axes. Document map axes, interpolation and extrapolation. Clamp only where physically justified; expose when a query leaves the source data envelope. Use bounded integrators, deterministic ordering and tests for timestep sensitivity.

Do not invent classified compressor maps, turbine temperatures or exact FADEC schedules. Use public values, transparent approximations and uncertainty metadata. Keep sources with the aircraft/engine data.

## 7. Required tests

Include cold/hot start sequences, failed start, idle stabilization, throttle acceleration/deceleration, altitude/Mach lapse, fuel starvation, relight attempt, temperature limit, surge/stall boundary, afterburner light-off/cutout, accessory load, inlet distortion, asymmetric thrust and engine damage. Test deterministic replay and long-run numerical stability.

## 8. Browser performance

Use measured profiling before optimization. Avoid per-render-frame component-map rebuilds, unbounded particle/smoke simulation and per-engine expensive fluid calculations. Cache immutable maps, use appropriate engine update rates, pool transient effects and separate visual exhaust from physical thrust. Any lower-rate distant-AI update must preserve coherent spool and fuel state.

## 9. Claude's required delivery report

For every implementation PR, report:
- Files and responsibilities changed.
- Existing systems reused and systems deliberately replaced.
- Equations/models and their validity envelope.
- Source data and estimated/synthetic values.
- Tests run and results.
- Performance measurements and test hardware/browser.
- Known omissions and next implementation stage.

Do not claim a PFM-quality engine or full thermodynamic simulation based on a moving nozzle, RPM gauge or static thrust curve.
