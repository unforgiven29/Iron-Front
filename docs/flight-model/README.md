# Flight Model and Aircraft Physics

**Documentation and empty source placeholders only. No aerodynamic, propulsion or rigid-body solver is implemented by this change.**

The goal is an advanced browser flight model built from shared physics foundations and aircraft-specific data/configuration—not one generic flight controller with different speed limits.

## Ownership
- `physics/rigidbody/`: 6-DoF state, forces/moments, integration, inertia and contact interfaces.
- `physics/aerodynamics/`: local airflow, lifting surfaces, airfoils, drag, stall, high-AoA, compressibility and aeroelastic approximations.
- `physics/propulsion/`: engine-family behavior, spool, thrust, fuel flow, inlet/nozzle, thermal and failure behavior.
- `physics/enviroment/`: existing legacy path for atmosphere, wind, turbulence, icing and weather effects. Preserve the spelling for compatibility.
- `game/core/simulation/`: fixed-step clock, scheduling, lifecycle and deterministic update order.
- `game/modules/planes/<aircraft>/`: aircraft-specific geometry, mass, aero data, engine fit, controls, systems, cockpit and damage.
- Rendering consumes simulation state; it never decides lift, stall, damage, collision or weapon outcomes.

## Non-negotiable physics rules
1. SI units internally; convert only at input/display boundaries.
2. Document world/body frames, handedness, axis directions, angle signs and quaternion conventions.
3. Calculate forces and moments, then integrate motion. Never set velocity directly to force a turn.
4. Separate aero, propulsion, gravity, landing-gear/contact and external forces.
5. Calculate local flow at each surface, including angular-rate contributions; wing, tail and control surfaces do not share one identical airflow value.
6. Use aircraft-specific coefficient curves/tables with source, uncertainty and validity envelope. Unknown real data stays unknown; synthetic values are labeled.
7. Pilot inputs pass through trim, control laws, actuators, hydraulic/electric availability and surface limits.
8. Physics timestep is independent of render frame rate. Use fixed/controlled stepping, bounded catch-up and visual interpolation.
9. Damage, stores, fuel burn and asymmetric loading change mass properties and forces through the normal model.
10. Expose AoA, sideslip, Mach, dynamic pressure, load factor, stall margin, force/moment breakdown, engine state and control deflections for diagnostics.

## Causal pipeline
`pilot/AI command → cockpit controls → linkage/actuator → flight-control law → surface/engine commands → local airflow → aero/propulsive/contact forces → rigid-body integration → aircraft state → instruments`

AI requests maneuvers but uses the same control path and limitations as the player. No teleporting or direct velocity writes.

## Fidelity tiers
- Tier 0: data, units and frame validation.
- Tier 1: stable 6-DoF rigid body, gravity, thrust, basic lift/drag and control authority.
- Tier 2: per-surface aero, local flow, nonlinear lift/stall, trim and engine spool.
- Tier 3: high-AoA departures, compressibility, detailed control laws, asymmetric stores, ground effect and landing gear.
- Tier 4: selected dynamic stall, aeroelastic approximations, inlet distortion, propulsion/airframe coupling and damage-flow effects.

Tiers are explicit; performance pressure must not silently change physics meaning.

## Performance
Use multirate simulation: high-rate rigid-body/control integration; lower-rate thermal, maintenance and campaign systems; event-driven damage. Profile before optimizing. Use workers/typed buffers only when measured gains justify complexity. Keep deterministic test scenarios and seeded randomness.
