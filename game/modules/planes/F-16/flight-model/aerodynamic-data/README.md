# F-16C Block 50 — aerodynamic coefficient data

**Owner:** F-16 aircraft data package. Generic schema/interpolation is physics/flight-model/coefficient-data; generic equations live in physics/aerodynamics. **Status:** no authoritative coefficient dataset is populated.

## Required data families

The eventual dataset may need per-surface lift/drag/side-force curves; whole-aircraft force coefficients; roll/pitch/yaw stability and control derivatives; Mach/compressibility effects; AoA/sideslip nonlinear behavior; stabilator/aileron/rudder effectiveness; leading-edge flap and trailing-edge surface increments; speedbrake/gear/store configuration; and supported ground-effect or high-AoA interaction data.

A dataset must identify whether it represents a clean airframe, a given flap/slat setting, a store fit or a particular flight-control state. Separate tables/configurations where source data describes discrete configurations.

## Required axes and metadata

For each table record coefficient symbol/meaning; units and sign; axes/units such as Mach, AoA, sideslip, normalized rates, Reynolds number and control deflection; reference area/span/chord; body/stability/wind axes; interpolation method; valid domain and out-of-domain behavior; uncertainty; source/revision/page/test conditions; and exact F-16 block/engine/operator applicability.

Use radians/degrees explicitly. Rate derivatives must state dimensional or normalized form. A derivative normalized with p b/(2V) must not be confused with raw roll rate. Preserve source knots and provenance in any transformed dataset.

## Known limitation and research order

No numeric F-16 coefficient table should be invented from generic online values or copied from a DCS/other-game FM. Research source/test data for the exact F-16C Block 50 configuration; identify the supported envelope; then populate the shared data schema. Synthetic tables may be used in unit tests only and must have synthetic-test provenance.

## Validation

Check symmetric trim, lift/drag trends, stability derivative signs, control effectiveness, Mach/AoA range boundaries, high-AoA/post-stall support and agreement against independent reference points. If sources cover only a limited envelope, the FM reports unsupported outside it rather than extrapolating silently.
