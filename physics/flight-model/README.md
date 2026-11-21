# Aircraft flight-model assembly

**Owner:** physics/flight-model. **Status:** architecture and directory structure only; no aircraft flight-model assembly/runtime exists.

This subsystem is the aircraft-specific bridge between the aircraft package and shared physical solvers. It composes an aircraft's lifting surfaces, control-surface definitions, coefficient datasets, actuator outputs, propulsion installations and configuration-dependent drag into a deterministic set of force/moment contributions for the rigid-body solver.

It is deliberately inspired by the component separation visible in the Community A-4E-C ExternalFM project: a central flight-model coordinator alongside aircraft state, aerodynamic elements, airframe/control mechanisms, engine/fuel components, data tables, tests and standalone verification. Iron-Front adapts those ideas to its own browser simulation. It does not copy the A-4 implementation or its DCS DLL API.

> **Important — this is a shared framework, not a universal aircraft flight model.** Each aircraft owns a separate aircraft-specific flight model in its platform package. This directory owns reusable orchestration/contracts and the shared force/moment assembly infrastructure. It must not force every aircraft to use the same aerodynamic representation, coefficient tables, panelization, control response or handling. A shared rigid-body integrator and reusable aerodynamic mathematics do not make two aircraft share a flight model.

## Research references

Use [the annotated flight-dynamics reference guide](../../docs/reference-library/flight-dynamics.md) before selecting an aerodynamic representation or interpreting DATCOM/NASA/simulator data. Keep each aircraft's own validated model and dataset; the reference library is not a universal coefficient source.

## Shared framework versus aircraft-specific model

Keep these responsibilities distinct:

- **Shared physics infrastructure:** rigid-body numerical integration; reusable local-flow and aerodynamic mathematics; coordinate/frame/unit utilities; common force/moment contribution contracts; deterministic accumulation and diagnostics.
- **Aircraft-specific flight model:** the actual model selected and parameterized for one exact aircraft variant; geometry and reference stations; aerodynamic surfaces or other model representation; coefficient maps/tables/equations; compressibility/separation/stall behavior within its supported model; control laws and trim; actuator/surface mapping; mass and inertia configuration; propulsion installation; ground-effect and configuration effects; validity envelope and validation data.
- **Aircraft-specific installation systems:** engine, fuel, electrical, hydraulic, pneumatic, cooling, sensors and damage topology remain in the aircraft package and their canonical shared behavior owners.

The shared framework may host several model strategies behind stable interfaces where that is useful, but it must not flatten materially different aircraft into one generic coefficient set or response curve. The F-16C Block 50 and MiG-29 product 9.13 require separate model instances, separate data, separate validation suites and separate handling. No F-16-derived coefficient, geometry, control law or tuning value may silently flow into the MiG-29 model, or vice versa.

## What this owner does — and does not do

**Owns**
- Aircraft force/moment assembly and its fixed update sequence.
- Configuration of aircraft-specific aerodynamic elements and their application stations.
- The interface between installed control surfaces/actuators and aerodynamic element state.
- Selection and validation of aircraft-specific coefficient datasets.
- Attribution of each contribution to a source component, application point, frame, tick and validity state.
- Flight-model diagnostics and component-level verification fixtures.

**Does not own**
- Six-degree-of-freedom position, velocity, attitude, mass-property integration or rigid-body numerical integration: physics/rigidbody.
- General local-flow, coefficient-evaluation and aerodynamic equations: physics/aerodynamics.
- Engine-family spool/thrust physics: physics/propulsion.
- Fuel inventory, electrical supply, hydraulic pressure/flow, pneumatic supply or cooling: game/systems.
- Aircraft-specific command laws, equipment selection, geometry, mass, engine installation or exact real-aircraft data: game/modules/planes/<aircraft>.
- Cockpit, visual animation or HUD decisions: game/graphics-engine.

The flight-model assembly may request state from these owners and submit outputs through their contracts. It must not maintain shadow copies of their authoritative state.

## Main calculation pipeline

The order is a contract, not a UI/frame-loop suggestion:

1. **Read tick snapshot.** Receive rigid-body kinematics, body/world frames, atmosphere/wind, mass properties, configuration identity, damage state and resource/actuator feedback for one simulation tick.
2. **Resolve pilot and automation commands.** The aircraft-specific flight-control package maps pilot inputs, trim, stability augmentation and mode commands into desired actuator/surface commands.
3. **Resolve actual actuator positions.** Shared actuator/resource systems apply rate, force, pressure/flow, electrical supply, mechanical stops and damage limits. The FM consumes actual measured/estimated surface state, never the requested position as if it were achieved.
4. **Update propulsion installation.** Consume the engine model's actual thrust, torque/accessory output, exhaust state and validity. The aircraft package supplies engine position, orientation, inlet/nozzle installation and number of engines. The engine model remains the source of thrust.
5. **Evaluate aerodynamic elements.** Each configured element samples its own local airflow, evaluates the appropriate coefficient data and returns local forces/moments with application point and validity.
6. **Add other owned contributions by interface.** Landing gear, stores, external tanks, speed brakes, airbrakes, propwash/jet interactions and ground-contact aerodynamics are included only through the owning subsystem's force contribution. Do not duplicate their physical model in the assembly.
7. **Apply damage/configuration modifiers.** Only explicit physical state changes affect the element/installation. Damage, stores, configuration, icing/contamination and control degradation are separate typed inputs, not arbitrary global multipliers.
8. **Aggregate and publish.** Sum deterministically ordered contributions, compute diagnostic totals, and submit forces/moments to physics/rigidbody. The rigid-body solver integrates the resulting state.
9. **Publish telemetry.** Emit per-element and aggregate force/moment, local flow, coefficient lookup status, actual control position, engine contribution and data-validity diagnostics.

No calculation may depend on browser render delta. Each owner declares its own fixed-tick/substep contract.

## Force and moment contract

Every contribution identifies:
- Stable source/component ID and configuration version.
- Force vector, moment vector if already resolved, application point and coordinate frame.
- Units (N and N·m), acquisition/evaluation tick and validity.
- Source dataset/version, uncertainty or confidence tier, and any approximation flag.
- Whether the contribution is already expressed about the current centre of mass.

For a force applied at position **r** relative to the current centre of mass, its moment contribution is **r × F**. This translation must happen exactly once. The assembly must not double-count a surface's internally computed moment and the moment generated by its force at an offset station.

Symmetric left/right elements must use explicit mirrored geometry/data where appropriate. Do not assume identical loads if stores, damage, control positions, local flow or geometry differ.

## Aircraft definition and data separation

The aircraft package supplies immutable data: surface/panel geometry; span/chord/area; reference datum and stations; local axes/normals; control-surface association; aerodynamic coefficient datasets; engine installation transforms; gear/store configuration and exact mass-property references. Runtime state includes actual surface positions, local flow, lookup results, damage, thermal/icing state and current forces.

Keep geometry independent from render meshes. Blender/GLTF mesh vertices are not automatically aerodynamic panels. A dedicated aerodynamic geometry record must define aerodynamic reference area and span, local axes, panel boundaries, control overlap and force application point.

## Required fidelity ladder

- **Tier 0 — contract/diagnostics:** deterministic data loading, frame/unit checks, contribution aggregation and no aerodynamic claim.
- **Tier 1 — quasi-steady surface model:** per-element local dynamic pressure and validated coefficient lookup, with explicit limitations.
- **Tier 2 — nonlinear/configuration model:** control deflection, high-lift devices, sideslip, Mach/configuration dependencies, stall/post-stall data, damage and stores.
- **Tier 3 — unsteady and interaction models:** rate/hysteresis effects, downwash/sidewash, wake/vortex/LEX effects, propwash/jet interactions and ground effect where sourced/validated.
- **Tier 4 — advanced structural/flow coupling:** aeroelastic deformation or higher-order flow calculations only when a validated method and performance budget exist. Do not call a panel model CFD.

The aircraft's claimed fidelity is limited by its weakest material input dataset and validation envelope. Do not label the entire flight model “advanced” because one subsystem has a detailed implementation.

## Directory map

- assembly: deterministic composition, lifecycle and update order.
- aircraft-state: input snapshot and derived flight-state contract; rigidbody remains authoritative for motion.
- aerodynamic-elements: surface/panel representation and per-element force records.
- coefficient-data: coefficient dataset format, axes, interpolation, provenance and envelope.
- control-surfaces: command/mixing contracts and actual aerodynamic geometry association.
- actuator-coupling: mapping from actual actuator state/resources to physical surface motion.
- high-lift-devices: flaps, slats, spoilers, airbrakes and leading-edge devices.
- propulsion-integration: installation transforms and force contribution contract; engine equations stay in physics/propulsion.
- air-data: derived air data and imperfect instrument measurements.
- flow-interactions: ground effect, downwash, wake, vortices, LERX/LEX and powered-lift interactions.
- structural-response: load extraction and structural-limit/damage interfaces; not a finite-element solver.
- verification: standalone scenario/log comparison and validation evidence.
- tests: unit, integration, acceptance, replay and performance test requirements.

## Flight-model reference hierarchy

**Primary public architecture reference: Falcon BMS.** Its developer notes describe a deliberate split between mechanical/mass properties, aerodynamics, input/output, engine, ground interaction and equations of motion. They also discuss keeping data-driven advanced-flight-model paths distinct from legacy/AI paths, using either distributed local-surface loads or validated global coefficient data, and recomputing mass, CG and inertia as fuel/weapons change. These are useful architectural decisions to study for Iron-Front.

- [BMS physics-engine development and module boundaries](https://falcon-bms.com/blog/the-development-of-the-physics-engine)
- [BMS aerodynamics: local surface loads and global coefficient models](https://www.falcon-bms.com/blog/the-aero-module)
- [BMS mechanical model: mass, CG, inertia and fuel/store distribution](https://www.falcon-bms.com/blog/the-mechanical-module)

Do not copy BMS private source, hidden data or aircraft-specific coefficients. Its published articles explain design intent, not a complete public implementation. Iron-Front should keep one canonical rigid-body truth and explicit fidelity profiles; an AI/low-cost approximation must not become a separate, inconsistent player-aircraft physics truth.

**Secondary code-organization reference: Community A-4E-C ExternalFM.** Its public tree separates a flight-model coordinator, local aerodynamic elements, airframe/control/actuator classes, aircraft state, propulsion/fuel components, DCS host interface, unit tests and verification programs. Its FM computes local flow at individual element stations using aircraft angular motion and accumulates force/moment contributions. This is a valuable example of small classes and focused responsibilities.

The A-4E's coefficient choices, aircraft constants, force equations, control assumptions and DCS callback sequencing are A-4-specific and are not Iron-Front specifications. The DCS DLL supplies state to and receives forces from an external host; Iron-Front's shared rigid-body solver owns its own integration. See the [A-4E-C ExternalFM source tree](https://github.com/Community-A-4E/community-a4e-c/tree/master/A-4E-C/ExternalFM).

**Weapon-model caution from BMS:** its public [AIM-120 acquisition discussion](https://www.falcon-bms.com/blog/aim-120-bms-acquisition-model) is useful for staged midcourse/search/terminal acquisition and uncertainty propagation. The authors explicitly caution that the 4.37.3 model includes assumptions and estimates and is not an engineering-accurate missile simulation. Borrow the separation of phases and validation questions, not its numeric values or unverified behaviors.

## Implementation status and first slice

No runtime implementation is implied by this directory. First build schema-validated aircraft surface definitions and coefficient tables; implement a deterministic per-element local-flow/force result using physics/aerodynamics; aggregate forces and application-point moments; integrate the output through physics/rigidbody; then add actual actuator positions and propulsion installation. Test symmetric level trim and one controlled maneuver before adding high-AoA or flow-interaction features.
