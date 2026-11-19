# Claude Implementation Guide — DCS-Style Professional Flight Model

This guide supersedes any interpretation of the flight model as an arcade flight controller. Target a DCS-inspired PFM architecture: aircraft-specific nonlinear aerodynamics, coupled aircraft systems, a simulated 3D atmosphere and local air interaction.

**Do not claim DCS parity.** Implement and validate the physical model progressively. The new folders are placeholders; no solver is supplied by this documentation change.

## First: audit and architecture proposal
Inspect the current repository and identify existing flight movement, aircraft data, environment/weather, collision, rendering and simulation loops. Do not create parallel systems. Produce a diagram of data ownership and propose a staged migration. Preserve the existing game until replacement components pass tests.

## Required top-level ownership
- `physics/rigidbody/`: 6-DoF state and integration.
- `physics/aerodynamics/`: aircraft geometry, surface-level flow and aerodynamic loads.
- `physics/atmosphere/` or the existing environment owner: ambient 3D air state, thermodynamics, wind and weather. Avoid duplicate atmosphere implementations; choose one canonical owner and document migration.
- `physics/wake/`: aircraft-generated wake/vortices and wake encounter sampling.
- `physics/propulsion/`: engine-family and installation models.
- `physics/ground/`: landing gear, runway contact and ground effect ownership (coordinate with aerodynamics).
- `game/core/simulation/`: clock, deterministic update order and scheduling.
- `game/modules/planes/<variant>/`: unique aircraft geometry/data, engine fit, control laws, systems, cockpit and damage.

## Non-negotiable simulation rules
1. Aircraft state is 6-DoF and authoritative; render transforms are outputs.
2. The atmosphere is a world-space field queried by position and simulation time, not a single global wind constant.
3. Aircraft aerodynamic response uses air-relative velocity, not ground velocity.
4. Every lifting/control surface receives local airflow based on its position, aircraft angular velocity, ambient wind and modeled induced flow.
5. Forces and moments are integrated; do not set aircraft velocity/rotation to achieve desired handling.
6. Pilot and AI use the same actuator/control-law path.
7. Aircraft variants have distinct, sourced aerodynamic and propulsion data.
8. Failures and damage affect the responsible physical subsystem and propagate through explicit dependencies.
9. Physics runs on deterministic fixed/controlled timesteps independent of rendering.
10. Never read hidden world truth to provide perfect sensor/AI knowledge.

## Air simulation contract
An atmosphere query takes world position and simulation time and returns pressure, temperature, density, speed of sound, humidity/moisture if supported, mean wind vector, gust/turbulence contribution and weather metadata. Include field identity/configuration and validity. Interpolate spatially/vertically without discontinuities. Wind conventions and units must be explicit.

Separate:
- Baseline atmosphere (standard atmosphere and mission weather profile).
- Mean wind field (altitude/position/time dependent).
- Wind shear and gust events.
- Turbulence (seeded, bounded stochastic or spectral model; never unseeded per-frame noise).
- Thermals/downdrafts and terrain-induced flow.
- Precipitation/icing/weather state.
- Aircraft wake/vortex fields.

Do not create independent random turbulence for every surface. Nearby surfaces and nearby aircraft must sample correlated air motion from the same underlying field.

## Surface airflow contract
For each aerodynamic element at body offset r, calculate local rigid-body velocity contribution using angular velocity cross r. Transform to world coordinates, subtract the local air velocity to obtain air-relative flow, then include only physically justified induced-flow contributions. Derive local dynamic pressure, AoA, sideslip and supported Mach/Reynolds values.

Wing panels, horizontal tail, vertical tail, control surfaces and other lifting surfaces need separate local conditions. Model downwash/sidewash and interference. Surface loads are integrated into aircraft force/moment totals at the appropriate reference point.

## Aerodynamic model
Use aircraft-specific geometry and coefficient data. Define lift/drag/moment coefficient maps across AoA, sideslip, Mach, control deflection and configuration. Include validity envelope, provenance, uncertainty, interpolation and extrapolation behavior. Implement nonlinear stall/separation and post-stall response only to the fidelity supported by the data. No binary stall toggle or arbitrary speed-based lift multiplier.

Add unsteady behavior (lag, dynamic stall, hysteresis) as explicit stateful models with validation, not decorative random oscillation. Include compressibility and transonic effects with clear applicability limits.

## Wake and vortex model
Aircraft emit wake from a documented lift/circulation estimate. Represent wake as a sparse set of vortex elements/segments or another validated reduced-order model. Wake is convected by aircraft motion and ambient wind, evolves/decays with age and atmospheric conditions, and is queried at receiving aircraft surface locations. The receiving aircraft experiences induced velocity; its own aero solver produces forces and response. Include spatial indexing, maximum element count, core radius, decay and deterministic ordering. Never script a random upset.

## Solver architecture and performance
Use a hybrid reduced-order model rather than full-world CFD:
- Analytic/layered atmospheric fields.
- Surface/panel/strip aerodynamic evaluation.
- Induced-flow and vortex approximations.
- Stateful unsteady models where justified.
- Sparse wake fields with bounded lifetime and spatial queries.
- Optional expensive research/test-lab models behind explicit fidelity settings.

Document update rate, accuracy, spatial scope, memory/performance budget and degradation policy for each model. The player aircraft must not silently downgrade to arcade behavior. Distant AI can use lower update rates only if state transitions remain physically coherent and validated.

## Aircraft-specific PFM package
For each aircraft variant provide geometry, mass/CG/inertia, aerodynamic datasets, control surface geometry, flight-control architecture, engine model/installation, stores, damage, system dependencies and cockpit instrumentation. Do not assume F-16 and MiG-29 share aerodynamic curves or control laws. Different blocks/variants can differ.

## Validation required before calling it PFM
- Atmosphere reference profiles and continuity.
- Air-relative flow and wind shear.
- Surface local-flow and angular-rate checks.
- Trim and stability across speed/altitude/configuration.
- Lift/drag/moment data comparison.
- Climb, acceleration, turn and energy performance.
- Stall/departure/recovery within known data envelope.
- Engine transients and control response.
- Ground effect, landing and crosswind.
- Stores, fuel burn, CG and asymmetric damage.
- Wake encounter and formation tests.
- Deterministic replay, timestep convergence and stress profiling.

Keep a per-aircraft validation matrix. Mark every result as measured, sourced, estimated or synthetic. Unknown data must remain unknown rather than be filled with false precision.

## Suggested implementation stages
1. Contracts and atmosphere.
2. 6-DoF state/integration.
3. One test aircraft and surface-level aerodynamics.
4. Engine/control/aircraft systems coupling.
5. Weather, turbulence, terrain flow and wake.
6. Aircraft-specific tuning and validation.
7. More aircraft and optimized multirate execution.

At each stage report code actually implemented, tests run, data sources, limitations and next blockers. Do not add placeholder code that merely looks sophisticated.
