# MiG-29 product 9.13 — aerodynamic surface geometry

**Owner:** MiG-29 aircraft package data. Shared aerodynamic element equations and local-flow evaluation remain under physics/flight-model and physics/aerodynamics. **Status:** geometry record specification only.

## Surface inventory to resolve

The selected product 9.13 package requires source-verified geometry and station records for:
- Fuselage and wing-body contribution.
- Left/right wings, including planform, sweep, twist, incidence, dihedral and root/leading-edge extension geometry.
- Leading-edge flap/slat segments and trailing-edge flap segments, if confirmed for selected configuration.
- Aileron and any other roll-control geometry, including exact span, hinge and control overlap.
- Left/right all-moving horizontal stabilizers/tailerons and their actual pivot axes.
- Twin vertical fins and rudders, including cant/toe and exact placement.
- Engine nacelles/inlet/nozzle and other installed body interference geometry where the chosen model supports it.
- Landing gear, doors, pylons, tanks and stores for configuration-dependent drag/interference.

Do not infer aerodynamic station values from a visual model or substitute dimensions from a different MiG-29 product variant.

## LERX and flow-interaction distinction

The leading-edge root extension is part of the aerodynamic geometry. Any vortex lift, breakdown, high-AoA interaction or tail blanking model is a separate flow-interaction capability with its own data/envelope. Do not create a movable LERX actuator or count LERX vortex lift as a visual effect.

## Panel record

Each element/panel needs stable ID, side/segment, local station, area/boundaries, chord/span/normal axes, reference point, control linkage if movable, coefficient dataset, damage zone, flow-interaction references and exact product/source applicability.

The twin-tail and twin-engine arrangement must be represented as distinct left/right elements/installations so engine-out, asymmetric control or damage can produce real asymmetric forces/moments.

## Validation

Verify dimensions, panel areas, station transforms, left/right symmetry, all-moving tail pivot axes, LERX root geometry, control-surface overlap and thrust installation reference points. Keep all unconfirmed values provisional.


## Movable-device classification and source caution

The public GAF T.O. uses the term leading-edge flaps (LEF) and describes trailing-edge flaps, while simulator material may call the leading-edge devices slats. Preserve exact quoted terminology, source diagram and variant applicability. Do not classify them as slot-forming slats until the geometry/kinematics are established. Slat slot flow and LEF camber change use different aerodynamic models.

The GAF manual describes two fuselage speedbrake surfaces above and below the aft fuselage/drag-chute compartment. It describes them as electrically controlled and hydraulically operated; the two surfaces are operated simultaneously but are not synchronized. Model left/right or upper/lower surface geometry and actual position separately as the selected documentation supports. These are speedbrakes, not wing spoilers.

No wing spoiler device is identified in the current product 9.13 source set. Do not create a wing spoiler merely because the generic simulation architecture supports spoilers. Retain `unknown/not-yet-confirmed` until exact product documentation supports `not-fitted`.
