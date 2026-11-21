# Aerodynamic flow interactions and aircraft-specific effects

**Owner:** physics/flight-model/flow-interactions for selecting and configuring aircraft interaction models; reusable local-flow physics belongs to physics/aerodynamics and environment. **Status:** architecture only.

A-4E-C's FM contains an LERX-related component and optional spline-driven visual effects alongside its main element calculations. This points to a general design need: some aircraft depend on flow interactions that cannot be represented by independent isolated panels alone. Iron-Front must keep physical interaction logic separate from the renderer and select it only when data and validation support it.

## Interaction families

Potential model capabilities include:
- Downwash/sidewash and wake from upstream surfaces.
- Vortex lift and vortex breakdown, including LERX/LEX or strake effects.
- Propeller slipstream/propwash or rotor downwash.
- Jet exhaust interaction and powered-lift effects.
- Wing/fuselage/tail interference and local shielding.
- Ground effect and surface-normal influence near runways/decks.
- High-AoA cross-flow, separated-flow and nonlinear control effectiveness.
- Store/pylon/pod interference and inlet-distortion interaction where supported.

Not every aircraft needs every interaction. A fixed extension or strake is geometry; its vortex behavior is a model, not a visual animation.

## Modeling tiers

Start with isolated panel/local flow. Add empirical correction surfaces only when supported by test/reference data. More detailed vortex/wake or unsteady models require explicit validity envelope, temporal state, convergence/stability evidence and browser budget. Never add arbitrary multipliers to force one aircraft to match an anecdotal maneuver.

## Presentation boundary

Vapour, condensation, smoke, contrails and streamlines are visualization outputs derived from physical state. They do not create lift, drag, stall or sensor detection. Visual spline opacity or particle count must never be used as an input to flight forces.

## Tests

Test interaction activation range, sign/magnitude against reference data, ground height/surface dependence, control response with and without interaction, mirrored asymmetry, high-AoA boundaries, temporal stability and cost scaling with number of surfaces.
