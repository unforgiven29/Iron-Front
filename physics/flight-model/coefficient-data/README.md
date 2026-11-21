# Aircraft aerodynamic coefficient datasets

**Owner:** physics/flight-model/coefficient-data for dataset schemas, aircraft-data packaging and validation rules. physics/aerodynamics owns generic interpolation/evaluation algorithms. **Status:** architecture only.

Coefficient tables are first-class, versioned simulation data, not undocumented constants buried in a flight-model constructor. The A-4E-C ExternalFM demonstrates the practical use of lookup tables for lift, drag and stability/control derivatives; Iron-Front must extend that pattern into auditable multidimensional datasets with applicability and validity envelopes.

## Dataset families

Depending on the available source and selected fidelity, an aircraft may require:
- Section/profile or panel lift and drag coefficients.
- Whole-aircraft lift, drag and side-force coefficients.
- Pitch, roll and yaw stability/control derivatives.
- Control-surface effectiveness, hinge moments and control interaction.
- Mach/compressibility and Reynolds effects.
- AoA/sideslip nonlinear behavior, stall/post-stall and hysteresis where evidence exists.
- Flap/slat/spoiler/speedbrake/gear/store configuration effects.
- Ground-effect or other interaction corrections when independently validated.

Not every axis belongs in every table. Avoid giant sparse tables that imply unsupported cross-coupling. Select an explicit model form and state what it cannot represent.

## Axis and record requirements

Every dataset declares stable ID/version; exact platform/variant/block/operator applicability; coefficient symbol/meaning; SI or dimensionless units; reference area/span/chord and reference point; coordinate/sign convention; independent axes and units (for example Mach, AoA, sideslip, control deflection, Reynolds number and configuration); interpolation method; permitted domain; extrapolation policy; uncertainty; source/revision/page/test conditions; and review status.

Data must state whether AoA is radians or degrees, whether coefficients use body/stability/wind axes, and whether rates are dimensional or normalized (for example p b/(2V)). No implicit conversions.

## Interpolation and bounds

Use deterministic interpolation with an explicit policy for each axis. Preserve knots and source metadata. Never extrapolate beyond the supported domain without a documented model and validity warning. Do not silently return zero for missing values or clamp to a boundary row. Missing data should produce a clear unsupported/estimated state.

Interpolation across discrete aircraft configurations must not occur. Flap-up and flap-down, different stores, aircraft blocks or engine variants are separate configurations unless the source defines a continuous axis.

## Combining data and physics

Do not apply a global lift multiplier to hide missing panel geometry, nor a generic drag number to every store. Separate base coefficients, control/high-lift increments and installation/interference corrections so the same effect cannot be counted twice. If a complete aircraft coefficient set and panel-level geometry model both contribute to the same lift, define one as a validation target rather than summing both.

## Provenance tiers

Tag each field as sourced/test-measured, derived from sourced values, estimated with stated method, synthetic for software tests, or gameplay-tuned. Only sourced and validated data may be presented as documented performance. Synthetic fixtures must never ship as authoritative aircraft values.

## Tests

Test units and axis monotonicity; exact knot retrieval; interpolation between knots; boundary and out-of-envelope behavior; discontinuous configurations; uncertainty propagation; schema invalid cases; reproducible file hashes/versioning; and agreement with independent reference points where available.
