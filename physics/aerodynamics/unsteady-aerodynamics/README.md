# Unsteady aerodynamics, dynamic stall and hysteresis

**Owner:** physics/aerodynamics/unsteady-aerodynamics. It owns reusable time-dependent aerodynamic response models. Aircraft packages provide geometry, section/model selection, parameter datasets, valid envelope and validation evidence. `physics/flight-model` composes the model per aircraft element. **Status:** architecture only; no runtime implementation exists.

## Purpose

A steady coefficient lookup is not sufficient for every flight condition. Real aerodynamic loads can depend on the recent motion and flow history of a surface, not only its instantaneous angle of attack. The solver must be able to represent bounded, stateful response such as attached-flow lag, separation delay, dynamic-stall hysteresis, transient vortex lift, reattachment and unsteady pitching moment where the selected aircraft model and evidence support it.

This is a reusable mathematical capability, not one generic dynamic-stall curve shared by every aircraft. It is especially important that the F-16C Block 50 and MiG-29 product 9.13 retain distinct aerodynamic datasets and validity envelopes.

## Ownership and interfaces

**Inputs per aerodynamic element and simulation tick**
- Local air-relative velocity vector and its history/derivative.
- Local Mach, Reynolds estimate, density and dynamic pressure where supported.
- Local angle of attack and sideslip, angular rates, surface motion and control deflection.
- Current and recent flap/LEF/slat/spoiler configuration and structural deformation.
- Aircraft-specific steady coefficient baseline and selected unsteady model profile.
- Element geometry, reference chord, axes, data version and validity envelope.
- Explicit disturbance/flow interaction inputs from their owners (e.g. vortex-induced velocity, wake or inlet/propwash field).

**Outputs**
- Time-dependent force/moment coefficients and dimensional loads.
- Model state for the next tick: lag states, separation state, vortex state or other model-specific internal variables.
- Validity, uncertainty, extrapolation/unsupported flags and the reason for degraded output.
- Diagnostics exposing which physical state caused a load difference.

The unsteady model returns a contribution through the normal aerodynamic element interface. It does not integrate aircraft rigid-body motion, set control-surface position, create random buffeting or read renderer state.

## Required model families

Support distinct selectable model strategies. Do not enable all of them for all aircraft.

1. **Quasi-steady baseline:** instantaneous coefficient lookup. This is an acceptable lower-fidelity baseline only within a stated envelope.
2. **Attached-flow unsteady response:** finite response lag to changing incidence/control inputs; use a documented indicial/state-space or equivalent model when data supports it.
3. **Dynamic separation model:** separation state evolves with flow history and may lag the instantaneous static separation criterion.
4. **Dynamic-stall vortex contribution:** where supported, track onset, growth, convection and decay of a leading-edge vortex contribution and its effect on normal force and pitching moment.
5. **Reattachment/recovery:** separated flow must not instantly return to attached flow when AoA falls below a single threshold. Use a validated recovery state/time constant or table.
6. **Hysteresis:** increasing-AoA and decreasing-AoA paths can produce different loads at the same instantaneous AoA. Hysteresis must arise from state/history rather than random jitter.

A Beddoes–Leishman-family model is one established class of stateful dynamic-stall approaches. It is not automatically appropriate for every fighter surface, Mach/Reynolds range or high-AoA configuration. The selected method, parameters, inputs and assumptions must be documented.

## Physical behavior requirements

Where the selected model supports them, represent:
- attached-flow lag and circulatory/non-circulatory response;
- separation onset and progression rather than a binary stall switch;
- lift/normal-force overshoot after rapid incidence change;
- drag and pitching-moment response as separation develops;
- leading-edge vortex formation/shedding and transient moment changes;
- hysteresis between increasing and decreasing angle-of-attack sweeps;
- reattachment delay and residual separated-flow state;
- dependence on reduced pitch rate, Mach, Reynolds number, airfoil/section geometry and surface configuration;
- interaction with control deflection, LEF/slat/flap states, sideslip and local induced flow.

Do not generalize a rotorcraft airfoil dynamic-stall calibration to a fighter wing without validation. A section model may be used as one element of a 3D aircraft model, but spanwise flow, sweep, finite-wing effects, LERX/LEX vortices, fuselage interference and tail interaction remain separate aircraft-level problems.

## Dynamic state and timing

- Each affected element owns its unsteady internal state; state is not a global aircraft-wide "stall amount".
- Advance the state on fixed simulation time using the element's local air-relative velocity and declared substep.
- Use dimensionless time/ reduced-frequency quantities only with correctly defined local reference chord and velocity.
- Preserve state through save/replay and deterministic rollback.
- When an element is spawned, repaired, reconfigured or loses its data profile, apply a documented initialization/reinitialization rule.
- Nearby panels must not receive independent uncorrelated random airflow. Coherent flow disturbances belong to the shared local-flow/vortex field.
- Rendering frame rate, animation and visual condensation do not advance aerodynamic state.

## Validity and failure behavior

Every model profile states:
- Mach/Reynolds/AoA/sideslip and reduced-rate envelope;
- geometry and airfoil/section applicability;
- surface deflection/configuration limits;
- transient frequencies/amplitudes for which it was identified;
- coefficient data source and uncertainty;
- behavior outside the envelope.

Outside the domain, return explicit unsupported/estimated status or a declared lower-fidelity profile. Never silently clamp to a table edge, invent a stable post-stall curve or transition to a different model because the frame rate falls.

## Validation matrix

1. Steady limit: as motion rate tends to zero, the model approaches its sourced steady baseline.
2. Attached-flow step/pitch response: compare phase/amplitude/lag against analytical or published fixtures.
3. Increasing/decreasing AoA sweep: verify the expected loop and return path.
4. Stall onset/recovery: compare force and moment time histories, not only peak lift.
5. Pitch-rate variation: verify the model's response changes consistently with reduced rate.
6. Mach/Reynolds envelope: test interpolation boundaries and rejected out-of-domain conditions.
7. Device interaction: test LEF/slat/flap and control deflection without double-counting configuration increments.
8. Asymmetric damage: affected elements change while unaffected elements retain their own state.
9. Determinism: repeat the same fixed-tick input history and reproduce the same state/loads.
10. Integration: compare aircraft force/moment, trim and maneuver response with held-out reference cases.
11. Performance: profile state update cost by aerodynamic element and model family.

## Research references

Use [Advanced flight physics references](../../../docs/reference-library/advanced-flight-physics.md) and the general [flight dynamics reference guide](../../../../docs/reference-library/flight-dynamics.md). The cited dynamic-stall sources are methods and research examples; they are not aircraft-specific coefficient sets.
