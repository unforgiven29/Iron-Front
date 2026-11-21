# Professional Flight Model (PFM) Architecture

**Design target: aircraft-specific, high-fidelity professional flight models inspired by the DCS PFM approach. This repository change adds architecture and empty placeholders only; it does not implement a flight solver.**

Iron-Front must not use an arcade flight controller with speed/pitch multipliers. The aircraft must fly because its physical state, configuration and local air conditions generate forces and moments. The atmosphere is a simulated environment that interacts with aircraft, terrain and other aircraft.

A DCS-style PFM is not synonymous with running full computational fluid dynamics (CFD) over every aircraft in real time. The practical target is a validated, aircraft-specific nonlinear aerodynamic model coupled to a physically meaningful atmosphere and local-flow model. Use high-fidelity engineering models where they matter, and carefully bounded approximations for expensive effects.

## Research references

Start with [the curated flight-dynamics reference guide](../reference-library/flight-dynamics.md). It links USAF Digital DATCOM, NASA TP-1538, NASA F-16XL flight-test work, the Standard Atmosphere, flight-test methodology, Stengel and Falcon BMS developer notes, while explaining exact-aircraft applicability limits. For platform data, use the F-16C Block 50 or MiG-29 product 9.13 source register rather than borrowing another aircraft's data.

## 1. Three coupled simulation domains

### A. Aircraft rigid-body and systems model
- Six-degree-of-freedom translation and rotation, mass, center of gravity and inertia tensor.
- Aircraft-specific geometry, aerodynamic coefficient data, control surfaces and stability characteristics.
- Engine installation and transient engine behavior.
- Flight-control computers, mechanical linkages, actuators, trim and control limits.
- Landing gear, stores, fuel transfer, damage, failures and system power/pressure dependencies.

### B. Atmosphere and world-air model
- Three-dimensional atmospheric state: pressure, temperature, density, humidity and speed of sound.
- Altitude-dependent wind, wind shear, gusts, turbulence and weather.
- Thermals, downdrafts, mountain/terrain-induced flow and boundary-layer effects at appropriate fidelity.
- Precipitation, icing, visibility and atmospheric effects on aircraft performance.
- Air-mass motion is independent of aircraft motion; an aircraft flies relative to the local air, not simply relative to the ground.

### C. Local aerodynamic flow around aircraft
- Local velocity at each aerodynamic surface, accounting for aircraft translation, rotation and ambient wind.
- Wing/tail interference, downwash, sidewash, control-surface effects and separated-flow approximations.
- Leading/trailing vortices, wingtip vortices and wake interaction.
- Propwash/jet effects where physically relevant.
- Ground effect, dynamic pressure gradients and local flow distortion.
- Wake turbulence from other aircraft, with strength, age, convection and decay.

## 2. Required causal simulation loop

`world atmosphere → ambient air sample at aircraft → local flow at each surface → aerodynamic loads → propulsion/contact loads → 6-DoF integration → aircraft motion → wake/vortex emission → updated world flow`

The loop must be time-consistent. Avoid updating aircraft positions and wake fields in arbitrary order. Use a documented simulation tick, staged updates and stable previous/current snapshots. Newly emitted wakes should not create order-dependent forces on aircraft updated earlier in the same tick.

## 3. Atmosphere model

The atmosphere must be a queryable 3D field, not a single global wind vector.

Each query should return a coherent state at a world position and simulation time:
- Static pressure, temperature, density and speed of sound.
- Humidity/moisture state when supported.
- Mean wind vector and gust/turbulence perturbation.
- Optional precipitation, icing potential and visibility/weather metadata.
- Validity, fidelity and source/configuration identifiers.

Support standard-atmosphere baselines and scenario weather profiles. Layered weather must interpolate smoothly in altitude and space. Wind direction conventions, units and coordinate frames must be explicit. Aircraft motion through a moving air mass determines air-relative velocity.

### Atmospheric phenomena
Plan independent models for:
- Altitude lapse rates and pressure/density profiles.
- Vertical and horizontal wind profiles, wind shear and frontal boundaries.
- Deterministic gust events and seeded stochastic turbulence.
- Convective thermals, downdrafts and localized vertical air motion.
- Terrain-following flow, ridge lift, lee-side turbulence and mountain-wave approximations.
- Precipitation, humidity, icing and temperature effects.
- Wake turbulence fields and aircraft-generated vortices.

Not every phenomenon must be enabled in every mission. Fidelity and update rate are configurable.

## 4. Local flow and aerodynamic surfaces

Every aerodynamic surface samples air at its own position. For a surface at body-frame offset `r`, local rigid-body velocity includes the angular-rate contribution `ω × r`; ambient wind and any modeled induced flow are then combined to obtain local air-relative velocity.

For each wing panel, tail surface, fin and control surface, calculate or derive:
- Local velocity vector and dynamic pressure.
- Local angle of attack and sideslip.
- Mach and Reynolds estimates within the model's supported range.
- Surface deflection and effective geometry.
- Induced velocity from downwash, vortices and other modeled flow effects.
- Local flow separation/stall state where supported.

Do not calculate one AoA and one dynamic-pressure value for the entire aircraft and reuse it everywhere. That erases important effects in high-AoA flight, sideslip, rapid rotation, asymmetric damage and wake encounters.

## 5. Aircraft-specific aerodynamic model

Each aircraft variant needs its own documented aerodynamic dataset and geometry:
- Wing/tail/fin planform, reference dimensions and aerodynamic stations.
- Lift, drag and moment coefficient data across supported AoA, sideslip, Mach and control configurations.
- Stability/control derivatives and control effectiveness.
- High-lift devices, speed brakes, leading-edge devices and configuration transitions.
- Nonlinear stall, separated flow, post-stall behavior and departure/recovery behavior to the extent supported by data.
- Compressibility and transonic/supersonic effects appropriate to the aircraft.
- Stores, pylons, fuel state, damage and asymmetric configuration effects.
- Uncertainty, source provenance and extrapolation limits.

The model must preserve nonlinear behavior. Do not hide missing data behind arbitrary multipliers or binary stall flags. If data is unavailable, label a conservative estimate and the affected envelope.

## 6. PFM flight-control and aircraft-systems integration

The pilot does not directly rotate an aerodynamic surface in the physics engine. Inputs pass through aircraft-specific control architecture:
- Mechanical/hydraulic/electric control path.
- Control mixing and trim.
- Actuator rate, position, force and pressure/power limits.
- Stability augmentation and flight-control computer laws, if fitted.
- Control saturation, reversion, damage, jams and hydraulic/electrical failures.
- Distinction between commanded, actual and indicated surface positions.

Aircraft-specific systems must affect the flight model. Hydraulic loss can reduce control authority; electrical loss can disable powered controls; icing can change lift/drag and control response; fuel transfer changes CG/inertia; engine damage changes thrust and asymmetric moments.

## 7. Wake, vortices and aircraft interaction

Aircraft should generate a wake from their lift distribution/weight, speed, configuration and atmospheric conditions. Model wake as a convecting, spreading and decaying field or a set of vortex elements with bounded lifetime. Include:
- Trailing/wingtip vortex strength and circulation estimates.
- Wake convection with ambient wind and aircraft motion.
- Vortex core growth/decay and atmospheric dissipation.
- Encountered induced velocity at other aircraft surfaces.
- Wake turbulence severity and aircraft response through ordinary aerodynamic forces.
- Ground proximity and crosswind effects where supported.

Do not apply a scripted random roll when an aircraft enters a wake. The wake changes local airflow; the receiving aircraft's own aerodynamic model produces the response.

## 8. Practical real-time solver strategy

Do not attempt a full global Navier–Stokes CFD simulation of the whole campaign world. It is too expensive and unnecessary for a real-time browser simulation.

Use a hybrid approach:
1. **Global atmosphere:** analytical/layered weather fields sampled on demand.
2. **Aircraft local flow:** surface/panel or strip-based aerodynamic calculation with aircraft-specific geometry and data.
3. **Induced flow:** downwash, sidewash and vortex models.
4. **Unsteady effects:** stateful lag/separation approximations and selected dynamic models.
5. **Wake interaction:** sparse vortex/wake representation with spatial indexing and bounded lifetime.
6. **Expensive optional fidelity:** localized higher-cost calculations only in test labs or selected scenarios, never an unbounded global fluid grid.

The architecture must allow higher fidelity without changing public subsystem contracts. Each model declares fidelity level, update rate, spatial range, memory budget and validity envelope.

## 9. Units, coordinates and numerics

Use SI internally. Explicitly document world/body/wind/surface frames, handedness, axes, positive angles, quaternion convention and transformations. Use stable integrators and bounded fixed-step simulation. Validate conservation/energy behavior where applicable, timestep convergence, interpolation and deterministic replay. Never mix render-frame delta with authoritative physics time.

## 10. Performance architecture

- Physics update is independent of rendering.
- Use fixed-step or controlled substeps for rigid-body/control integration.
- Atmosphere fields are sampled and cached by spatial/temporal cell where appropriate.
- Wake elements use spatial indexing and bounded count/lifetime.
- Update low-impact weather fields at lower rates than aircraft dynamics.
- Use workers only for measured independent workloads; keep deterministic state ownership.
- Provide quality tiers for distant AI aircraft, but never silently change the player's aircraft to an arcade model.
- Profile dense multiplayer-like scenarios and mobile hardware, not only an empty test map.

## 11. Validation gates

A model is not a PFM because it has many folders. Validate:
- Static atmosphere and altitude profiles against reference values.
- Wind/shear/gust behavior and air-relative velocity.
- Trimmed flight across speed/altitude/configuration.
- Lift/drag/moment curves and stability derivatives against documented data.
- Sustained turns, energy loss, acceleration and climb performance.
- Stall onset, buffet/separation approximations, departure and recovery where supported.
- Control-system response, saturation, failures and reversion.
- Ground effect, landing gear and crosswind handling.
- Stores/fuel/CG changes and asymmetric damage.
- Formation/wake encounters and physically plausible response.
- Deterministic replay, timestep sensitivity and performance budgets.

Every aircraft must have a validation report that identifies supported envelope, data quality, known approximations and unmodeled behavior.

## 12. Implementation order
1. Audit existing runtime and define units/frames/time/state contracts.
2. Implement atmosphere queries and air-relative velocity tests.
3. Implement 6-DoF rigid body and force/moment interfaces.
4. Build a single test aircraft with documented geometry and aero data.
5. Implement surface-level local airflow and validate basic loads.
6. Add trim, control actuation, nonlinear stall and engine transient behavior.
7. Add wind profiles, gusts, turbulence and terrain/weather effects.
8. Add wake/vortex generation and encounter tests.
9. Integrate aircraft systems, damage, stores and cockpit indications.
10. Validate one aircraft to a stable, documented envelope before adding another.
11. Add further aircraft with distinct datasets and systems, not cloned tuning.
12. Profile and optimize without changing the validated physics semantics.

**Do not label the implementation DCS-level or PFM-complete until the aircraft-specific models have data-backed validation across their declared flight envelopes.**

## 4. Advanced, time-dependent flight physics

A high-fidelity aircraft model must be able to represent more than a steady lift/drag lookup. The following are separate stateful/physical capabilities, each enabled only for an aircraft where its geometry, system configuration, data and validation support it.

- **Unsteady aerodynamics and dynamic stall:** `physics/aerodynamics/unsteady-aerodynamics/README.md` describes attached-flow lag, separation state, dynamic-stall hysteresis, transient vortex loading, reattachment and per-element history. Do not implement stall as a binary AoA switch.
- **Compressibility and transonic flow:** `physics/aerodynamics/compressibility/README.md` describes local Mach, critical-Mach/drag-rise behavior, shock-induced separation, transonic buffet and supersonic regime separation. Do not extrapolate subsonic tables.
- **Vortex and wake interactions:** `physics/flight-model/flow-interactions/README.md` describes LEX/LERX/forebody vortices, wingtip vortices, inter-aircraft wakes, convection, decay and tail/fin/inlet effects. Use aircraft-specific geometry and avoid renderer-driven forces.
- **Aeroelasticity and structural response:** `physics/flight-model/structural-response/README.md` describes static flexibility, reduced-order bending/torsion modes, aerodynamic/structural coupling, fatigue and the evidence required to claim flutter/divergence.
- **Installed propulsion interaction:** `physics/flight-model/propulsion-integration/README.md` describes inlet recovery/distortion, spillage drag, engine-face flow, nozzle/exhaust and airframe coupling. Engine-family thermodynamics remain with physics/propulsion.
- **Aircraft ground handling:** `physics/ground-handling/README.md` describes gear deployment, strut/tire contact, steering, braking, anti-skid, touchdown, bounce, runway surface and damage coupling.

These are not one universal fidelity switch. A model can be physically detailed in one region and explicitly unsupported in another. Model state, time constants, valid envelopes, approximation class and error evidence must remain visible.

## 5. Deterministic coupling order

Use staged previous/current snapshots so systems can interact without update-order dependence. At a minimum:

1. Freeze authoritative state and configuration snapshots for the tick (rigid body, flexible structure, environment, damage, actual controls, resources and engine state).
2. Sample atmosphere and world conditions at aircraft/element/inlet/gear locations.
3. Run aircraft-specific flight-control logic and actuator/resource systems to obtain actual achieved device positions.
4. Update each engine's operating state and its installed inlet/nozzle state through the propulsion contract.
5. Build the current aircraft geometry from mass configuration, actual movable devices and any enabled structural deformation.
6. Evaluate per-element local airflow, coherent flow interactions and local Mach/Reynolds as supported.
7. Evaluate steady coefficients plus the selected unsteady, dynamic-stall and compressibility states for each aerodynamic element.
8. Evaluate gear/tire/runway contact when grounded or transitioning; evaluate stores and other installed force contributions.
9. Deterministically aggregate force/moment contributions and generalized structural loads.
10. Advance rigid-body and enabled structural states with declared fixed steps/substeps. Use bounded corrector iterations only when the model requires them.
11. Commit events/snapshots, then emit new wake/vortex state for the next tick and publish renderer-facing observations.

No subsystem may read a half-updated state written by another subsystem during the same tick. No step may depend on browser frame delta. All stateful unsteady/structural/actuator/engine/gear models must be save/replay safe.

