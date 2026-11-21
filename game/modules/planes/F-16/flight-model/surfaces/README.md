# F-16C Block 50 — aerodynamic surface geometry

**Owner:** F-16 aircraft package data. Shared element evaluation lives in physics/flight-model/aerodynamic-elements and physics/aerodynamics. **Status:** geometry record specification only.

## Surface inventory to resolve

The selected F-16C Block 50 dataset needs individually identified and station-located records for:
- Fuselage and wing-body lifting/drag contributions.
- Left/right wing panels and their exact planform/sections, twist, sweep, dihedral, incidence and local reference frames.
- Left/right trailing-edge control surfaces (verify exact flaperon/control segmentation for selected block and source).
- Leading-edge flap segments and their schedules.
- All-moving horizontal stabilators and their aerodynamic/control geometry.
- Vertical tail/rudder geometry and installed orientation.
- Speedbrake panels and their separate aerodynamic drag contribution.
- Landing-gear components, doors, wheels and configuration-dependent drag.
- Pylons, tanks and stores, each with mass/CG/inertia records elsewhere and supported aerodynamic interference/drag records here.

Do not assume the rendered mesh, a generic F-16 CAD model or a different block's surface stations are authoritative.

## Element/panel record

Every element declares a stable ID; platform and variant applicability; parent surface; left/right or symmetry metadata; local aerodynamic reference point; local chord/span/normal axes; exposed planform area and panel boundaries; control-surface overlap and hinge relationship; coefficient dataset ID; damage/icing/contamination zones; reference datum; and provenance.

Panel areas must reconcile with published reference geometry within declared approximations. Do not include the same planform area in both base wing and control-surface elements unless the coefficient/area formulation explicitly defines how overlap is handled.

## Local flow and force

Each panel samples its own local air-relative flow and angular-rate velocity at its reference point. Its returned force must retain the application point and frame. Use r × F once about current CG. Left/right panel output is independently evaluated; asymmetrical stores, damage or controls must not be averaged away.

## Validation

Test geometric symmetry, surface areas, stations, transforms, control hinge axes, force application points, total reference area/span/chord consistency, gear/store configurations, and asymmetry after one-sided damage or store release. All measurements remain provisional until a selected Block 50 source or verified geometry record supports them.
