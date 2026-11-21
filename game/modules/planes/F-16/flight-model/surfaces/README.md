# F-16C Block 50 — aerodynamic surface geometry

**Owner:** F-16 aircraft package data. Shared element evaluation lives in physics/flight-model/aerodynamic-elements and physics/aerodynamics. **Status:** geometry record specification only; no validated surface geometry/aerodynamic database is implemented.

## Surface inventory to resolve

The selected F-16C Block 50 dataset needs individually identified and station-located records for:

- Fuselage and wing-body lifting/drag contributions, including inlet/radome/forebody geometry at the fidelity supported.
- Left/right wing panels: planform, sections, twist, sweep, dihedral, incidence, local reference frames and LERX/forebody geometry.
- Left/right horizontal stabilators: all-moving pivot/hinge geometry, separate left/right states, symmetric pitch and differential roll effects as fitted.
- Left/right flaperons / trailing-edge flaps (TEF): combined primary roll-control and scheduled trailing-edge flap functions. Keep flap-schedule and roll-command components distinct before mixing.
- Left/right leading-edge flaps (LEF): segmented geometry, hinge axes and FLCS command schedule.
- Rudder and vertical tail geometry.
- Split fuselage speedbrake panels: separate panels and stations, deployment geometry, symmetry, drag and moment.
- Landing gear, doors, wheels, pylons, tanks and stores for configuration-dependent drag/interference.
- Fixed shaping features and flow surfaces (including the F-16 strake/forebody contributions) as fixed geometry, not actuated slats/spoilers.

## Device classification — avoid false additions

The current F-16 Block 50 source set identifies LEFs, TEF flaperons, stabilators, rudder and fuselage speedbrakes. It does **not** identify a separate wing spoiler system. Do not add wing spoilers just to complete a generic aircraft checklist. Record them as provisional `not-fitted` only after checking the exact applicable technical baseline.

The leading-edge devices are called leading-edge flaps (LEFs) in the F-16 manual references. Do not rename them to conventional slats; a slat has a physical slot/gap mechanism that must be confirmed in the geometry.

## Element/panel record

Every element declares a stable ID; platform and variant applicability; parent surface; left/right or symmetry metadata; local aerodynamic reference point; local chord/span/normal axes; exposed planform area and panel boundaries; control-surface overlap and hinge relationship; coefficient dataset ID; damage/icing/contamination zones; reference datum; and provenance.

For each movable surface record physical device type, hinge/pivot axis, segment, actual movement limits, control/FLCS command mapping, actuator and hydraulic/electrical interface, position feedback and configuration-dependent aerodynamic data. Panel areas must reconcile with published reference geometry within declared approximations. Do not include the same planform area in both base wing and control-surface elements unless the coefficient/area formulation explicitly defines how overlap is handled.

## Local flow and force

Each panel samples its own local air-relative flow and angular-rate velocity at its reference point. Its returned force must retain the application point and frame. Use r × F once about current CG. Left/right panel output is independently evaluated; asymmetrical stores, damage, surface position or local airflow must not be averaged away.

## Validation

Test geometric symmetry, surface areas, stations, transforms, control hinge axes, force application points, total reference area/span/chord consistency, gear/store configurations, actual flap/LEF/TEF/speedbrake deflections and asymmetry after one-sided damage or store release. All measurements remain provisional until a selected Block 50 source or verified geometry record supports them.
