# Flight-model structural loads and limit response

**Owner:** physics/flight-model/structural-response for converting FM load results into structural-load/limit requests. Component damage and structural failure are owned by the damage/structural system and aircraft package. **Status:** architecture only; no structural finite-element model exists.

The A-4E-C FM checks overstress and maps damaged airframe sections to aerodynamic elements. Iron-Front should separate the calculation of loads from the decision and damage state applied by the structural owner.

## Inputs and outputs

Inputs include per-element force/application point, total aerodynamic and propulsion loads, rigid-body acceleration/angular rates, mass properties, configuration, material/structure data and existing damage. Outputs include station loads, hinge loads, bending/torsion/shear estimates at defined stations, limit exceedance metrics and structural damage requests with confidence/tick.

## Required distinctions

Limit load, ultimate load, service envelope, fatigue/cumulative damage, hinge/actuator load, flutter/aeroelastic boundary and actual structural break are different concepts. Do not infer wing failure from a single high-G value without an aircraft-specific criterion and duration/state model.

A simplified beam/section load model may be a gameplay approximation, but it must be declared as such. It is not finite-element analysis. Structural integrity and damage zones are aircraft-specific; shared numerical code consumes the configuration.

## Coupling

A structural event changes the connected geometry, control effectiveness, mass properties, damage routes and force elements through their owning interfaces. Do not simply set a generic wing health multiplier if the failure is a local panel, spar, hinge or actuator issue.

## Tests

Force/moment balance; spanwise load distribution; symmetry; positive/negative load cases; transient exceedance duration; fatigue accumulation if implemented; local damage; mass/CG/inertia update; and no breakage for unsupported out-of-envelope guesses.


## Aeroelasticity and flexible-airframe response

Aeroelasticity is a coupled interaction between aerodynamic loads, structural deformation and (where modeled) structural motion. It is not a generic airframe-health value and must not be represented by random wing shaking.

### Separate structural states

Maintain distinct state for:
- rigid-body aircraft motion;
- static structural deflection under current load;
- dynamic elastic/modal displacement and velocity;
- structural stress/load estimates;
- fatigue accumulation and crack/damage state;
- discrete damage/failure events such as panel separation or actuator/hinge failure.

These are separate physical concepts and may have different fidelity and update rates. A limit-load exceedance is not automatically structural failure; a fatigue estimate is not an instantaneous break; a flutter boundary is not a static overload threshold.

### Platform structural configuration

Each aircraft's structural model profile must identify:
- structural stations, load paths and component connectivity;
- wing/fuselage/tail/fin/surface mass distribution and local inertia;
- beam/section properties or reduced stiffness representation;
- bending, torsion and relevant coupled modes;
- modal mass, stiffness, damping and mode shapes where dynamic flexibility is enabled;
- control-surface, hinge, actuator, pylon/store and engine attachment interfaces;
- material and joint properties only where sourced;
- local stress/load evaluation stations and damage-sensitive zones;
- exact aircraft variant, production/block, repair/retrofit state and source provenance.

Do not use the F-16 structural profile for the MiG-29. If real aircraft structural data are unavailable, a simplified structural response must be declared estimated or synthetic-test-only.

### Model tiers

1. **Rigid airframe:** rigid-body 6-DoF with structural load monitoring. No flexible deformation is claimed.
2. **Quasi-static flexibility:** sourced/estimated load-to-deflection maps or reduced compliance for selected flexible components. Deformation updates aerodynamic geometry but has no independent modal inertia.
3. **Reduced-order dynamic flexibility:** selected bending/torsion modes with modal displacement and velocity states. Integrate with a deterministic fixed substep, and feed modal deformation into aerodynamic element geometry/local flow.
4. **Validated aeroelastic analysis:** coupled unsteady aerodynamic and structural modes, stability/damping evaluation and validated flutter/divergence boundaries. This has a much higher evidence burden and must not be claimed from a visual oscillation or simplified beam approximation.

Do not silently promote one tier to another. Aircraft can have different tiers depending on available public data and the capability being represented.

### Coupled update

The coupling contract is:

1. Read the previous committed rigid-body, flexible-mode, mass-property, actual-control and environment snapshots.
2. Construct current deformed geometry from structural/modal state.
3. Evaluate local flow and aerodynamic/propulsive/ground loads on that geometry.
4. Convert distributed loads and application points into generalized structural loads at configured stations/modes.
5. Integrate modal displacement/velocity and structural-load state using the declared fixed step.
6. Update geometry/element stations for the next coupling pass or next tick.
7. If a corrector iteration is required, use a deterministic fixed maximum iteration count and convergence/residual criterion; do not depend on render timing.
8. Commit the new state atomically so another aircraft cannot observe a partially updated flexible shape.

Track energy transfer/dissipation between aerodynamic and structural states where the formulation permits it. A coupled model that injects energy numerically must fail validation rather than be disguised by arbitrary damping or animation.

### Flutter, divergence and buffet boundaries

- **Static divergence** is an aeroelastic stiffness instability; it is not the same as a control-surface stall or structural overload.
- **Flutter** is a dynamic aeroelastic instability involving coupled motion and net negative damping; identifying it requires an adequate unsteady aerodynamic and structural modal model.
- **Buffet** is aerodynamic unsteadiness that can excite the structure; it is not automatically flutter.
- **Control-surface buzz/flutter** involves local surface/hinge/actuator dynamics and requires a distinct model if claimed.

Never invent fighter flutter speeds, mode frequencies, damping ratios or load boundaries. When data are unknown, record them as unknown and limit the simulation envelope rather than inventing a dramatic failure.

### Structural load, fatigue and damage coupling

Structural load calculation publishes station loads, hinge loads, shear/bending/torsion estimates and uncertainty. A separate structural/damage owner decides whether the state causes inspection, repair, fatigue accumulation or failure based on applicable criteria. For accumulated damage, record load spectrum, cycle counting method, material/joint model, residual-strength assumption and uncertainty. Fatigue damage is persistent and mission/history dependent; it is not reset by a sortie reload unless campaign maintenance state says so.

If a component separates or permanently deforms, update its mass, CG/inertia, aerodynamic elements, control path, stores/attachments, drag and damage routes through explicit events. Do not simply reduce total wing health.

### Verification

- Static deflection under known load and correct sign.
- Modal frequency/damping and mode-shape normalization.
- Coupled aero-structural energy and stability under a controlled oscillation.
- Load distribution and hinge-load continuity across adjacent stations.
- Symmetric and asymmetric load cases.
- Gust/maneuver transient response.
- Deformation feedback into local AoA, twist, control alignment and coefficients.
- Damage/separation updates to mass properties and geometry.
- Flutter/dive/limit boundaries only against applicable test/reference evidence.
- Deterministic replay, convergence and substep sensitivity.

Research routes: [advanced flight physics references](../../../../docs/reference-library/advanced-flight-physics.md), especially the aeroelasticity/loads sources.
