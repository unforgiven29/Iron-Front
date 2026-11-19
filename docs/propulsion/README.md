# Propulsion and Engine Simulation Architecture

**Status: engineering specification and planned boundaries only. No engine thermodynamic solver is implemented by this document.**

Iron-Front needs aircraft-specific propulsion models that produce thrust, torque, fuel consumption, heat, pressure, vibration and failure effects from engine state. Throttle position is a command, not thrust. Engine response must be dynamic and constrained by hardware, atmosphere, aircraft installation and damage.

## 1. Simulation objectives

Build a reusable propulsion framework with distinct engine-family models:
- Turbojet and low-/high-bypass turbofan.
- Afterburning turbofan and reheated turbojet.
- Turboprop and turboshaft.
- Piston/reciprocating engines where aircraft require them.
- Electric/hybrid propulsion only if a supported aircraft requires it.

A family shares physical principles and interfaces, not one universal equation set. Each engine designation/variant has its own configuration, component maps, control system, limits and validation envelope.

## 2. Required causal chain

`pilot/AI command → throttle linkage → engine control unit → fuel/ignition/geometry actuators → gas-path/shaft dynamics → nozzle/propulsor → installed forces and moments → aircraft response`

The engine must not read a desired aircraft speed or directly set aircraft velocity. It reports forces, moments, fuel flow, temperatures, pressures, shaft power and health to their owning systems.

## 3. Gas-turbine component model

Represent the flow path with named stations and explicit state variables. Depending on fidelity and engine type, model:
- Inlet/diffuser pressure recovery and distortion.
- Fan and compressor stages or calibrated compressor maps.
- Combustor fuel-air energy addition, efficiency and pressure loss.
- Turbine work extraction and shaft power balance.
- Core and bypass streams for turbofans.
- Mixer, augmentor/afterburner and variable-area nozzle where fitted.
- Accessory gearbox, generators, pumps and bleed-air extraction.
- Cooling flows and component thermal states.

Use map-based or reduced-order component relationships with documented validity envelopes. Do not claim a full multi-stage CFD/combustion solver. Preserve energy/mass-flow consistency to the selected fidelity.

## 4. Dynamic response and operating limits

Engine state is not instantaneous. Include:
- Separate spool speeds and inertias (N1/N2 or engine-appropriate equivalents).
- Acceleration/deceleration response and transient fuel scheduling.
- Corrected speed/flow relationships and altitude/Mach effects.
- Compressor operating margin, surge/stall boundary and recovery logic.
- Flameout, relight envelope, windmilling and starter-assisted start.
- Temperature, pressure, RPM, vibration and time-at-limit constraints.
- Oil pressure/temperature, lubrication and accessory loads where applicable.
- Thermal soak, heat-up/cool-down and transient limits.
- Idle, military power, maximum continuous and emergency/afterburning regimes as applicable.

A limiter must act through the control system and actuators; it must not silently clamp thrust after the model has calculated an impossible state.

## 5. Engine control and cockpit interaction

Separate pilot command, control-system demand, actuator position, fuel schedule and actual engine response. Aircraft-specific control architectures may include hydromechanical controls, FADEC or mixed analog/digital control.

Model relevant:
- Throttle detents, gates, friction and linkage.
- Start switch/sequence, starter, ignition and fuel enable.
- Fuel scheduling, acceleration limiting and temperature limiting.
- Variable stators, bleed valves, inlet ramps/cones and nozzle area where fitted.
- Afterburner light-off, staging, stability and cutout.
- Engine instruments: RPM, EGT/ITT/TIT, fuel flow, oil, nozzle position, vibration and warnings.
- Built-in test, fault annunciation and maintenance records.

Cockpit indications must be derived from sensor/instrument models and may lag or fail; do not display hidden exact simulation state as a perfect gauge.

## 6. Installed propulsion and aircraft coupling

The engine's installation matters:
- Inlet recovery/distortion depends on aircraft attitude, sideslip, configuration and local flow.
- Nozzle thrust vector and installation geometry determine force and moment location.
- Engine mass, CG and inertia contribute to aircraft mass properties.
- Bleed air, generators, pumps and cooling impose loads.
- Engine heat and exhaust affect nearby structures and thermal/IR signatures.
- Asymmetric thrust, nozzle failure or engine damage create real moments.
- Fuel flow and tank feed alter aircraft fuel state and CG through the fuel-system owner.

Do not duplicate fuel tank management in the engine. The fuel system supplies available fuel/pressure/temperature and receives demand/flow; the engine owns metering and combustion response.

## 7. Failures, degradation and damage

Failures must have causes, state transitions and downstream consequences. Include configurable models for:
- Flameout, hot/hung/no-light start and failed relight.
- Compressor stall/surge and foreign-object/inlet damage.
- Fuel-control, ignition, sensor, actuator and FADEC faults.
- Oil starvation, overheating, bearing and shaft damage.
- Turbine/compressor damage, blade loss and vibration.
- Nozzle/augmentor faults, stuck geometry and afterburner failure.
- Fire, fire detection, shutoff and extinguishing-system interaction.
- Progressive wear, maintenance condition and component replacement.

Avoid random instant engine death without an initiating event, severity, warning and failure progression unless the scenario explicitly defines a catastrophic event.

## 8. Performance maps and data provenance

Each engine definition must identify:
- Exact engine designation, dash number, aircraft fit and software/control baseline.
- Rated operating regimes and environmental envelope.
- Thrust or power maps over altitude, Mach, throttle and configuration.
- Fuel-flow/TSFC or BSFC data where available.
- Spool inertia/response, limits and transient behavior.
- Inlet/nozzle installation assumptions.
- Source references, confidence, measured/estimated/synthetic labels and uncertainty.
- Interpolation/extrapolation behavior and unsupported regions.

Never invent precise classified values and present them as documented facts. If only public performance points exist, fit a conservative model and label the interpolation and uncertainty.

## 9. Runtime contracts and ownership

- `physics/propulsion/`: generic engine-family solvers, component dynamics, performance maps and failure physics.
- Aircraft variant module: exact engine fit, installation, control laws, limits and cockpit mapping.
- Fuel system: tanks, pumps, valves, feed pressure, transfer and quantity.
- Electrical/hydraulic systems: accessory demand and available power/pressure.
- Aircraft rigid-body solver: consumes engine force/moment outputs.
- Atmosphere: supplies pressure, temperature, density and air-relative state.
- Graphics/audio: visualize and sound engine state; never determine thrust or failures.

Separate immutable configuration from mutable runtime state. Use typed contracts, SI units, simulation timestamps and deterministic seeds.

## 10. Validation and definition of done

Validate static thrust/power trends, altitude/Mach lapse, fuel flow, spool transients, start sequences, relight boundaries, throttle chops, acceleration limits, afterburner transitions, temperature/pressure limits, inlet distortion, asymmetric thrust, accessory loading and failure responses. Include timestep sensitivity, deterministic replay and performance tests.

A model is not complete because an engine mesh spins or an RPM gauge moves. Completion requires physical inputs/outputs, data provenance, boundary/failure tests, aircraft integration and a documented validity envelope.
