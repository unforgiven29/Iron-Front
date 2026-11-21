# Flight-model test strategy

**Owner:** physics/flight-model/tests. **Status:** test plan only; no full flight-model implementation exists.

The A-4E-C ExternalFM tree separates unit tests from verification utilities. Iron-Front should also test small components independently, then test full aircraft configurations and compare scenario outputs. Tests must run in the browser-compatible TypeScript environment where practical and headlessly without a renderer.

## Unit tests

- Vector/frame transformations, force/moment sign, r × F and reference-CG changes.
- Coefficient dataset schema, exact knots, interpolation, unsupported bounds and provenance.
- Local flow at a surface station including angular velocity and wind.
- Element area, geometry, orientation, mirrored surface and force generation.
- Control mixing and surface sign/range.
- Actuator rate/force/pressure/power limitation and fault behavior.
- Engine installation transform and single/twin contribution accounting.
- Air-data physical-vs-indicated separation.
- Structural load aggregation/limit calculation where implemented.

## Integration tests

- Deterministic assembly order and no double-counted force/moment.
- Actual actuator position drives aerodynamic effect.
- Electrical/hydraulic/pneumatic/cooling failures change only connected installed components.
- Engine fuel loss and engine output flow into thrust and mass state exactly once.
- Fuel/store changes update rigid-body mass properties and aircraft trim.
- Damage and asymmetry alter the correct elements and control paths.
- Save/load/replay includes all stateful filters, actuator and flow-interaction history.

## Acceptance scenarios

Use per-aircraft acceptance suites for trim, climb, acceleration, cruise, turning, roll response, high-AoA, stall/recovery, engine-out, asymmetric thrust/stores, high-lift configurations, gear extension, ground effect and resource/damage failures. Only mark a scenario externally validated when a qualified reference and stated tolerance exist.

## Determinism and performance

Run fixed tick, fixed input stream, recorded configuration/data versions and deterministic random streams. Measure FM assembly cost separately from rigid-body integration, renderer and sensor cost. Track cost per surface element and per interaction feature. Use profiling before reducing fidelity; do not silently reduce panel counts or coefficient precision based on frame rate.

## Test report

Each report records test ID, aircraft variant, software/data versions, source/provenance, seed, tick, initial state, input sequence, asserted outputs, tolerance, result and known limitations. Distinguish unit consistency, synthetic regression, comparison with simulation logs and independent real-world validation.
