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
