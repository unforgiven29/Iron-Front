# Aerodynamic elements and distributed surface loads

**Owner:** physics/flight-model/aerodynamic-elements for the FM element graph and application-point metadata; physics/aerodynamics owns reusable local-flow and aerodynamic force equations. **Status:** architecture only.

The A-4E-C uses individual AeroElement objects positioned on wings and other surfaces rather than relying only on one aircraft-wide lift/drag value. Iron-Front adopts this distributed-surface organization while keeping the reusable aerodynamic solver in physics/aerodynamics.

## Element definition

Each element/panel definition includes a stable ID; platform and variant applicability; parent surface; left/right or symmetry metadata; local aerodynamic reference point; local chord/span/normal axes; exposed planform area and panel boundaries; control-surface overlap and hinge relationship; coefficient dataset ID; reference datum; and optional damage/icing/contamination zones.

A panel is aerodynamic geometry, not a visual mesh fragment. Adjacent panels must not accidentally double-count area. Geometry sums must reconcile with the aircraft's sourced reference area/span within declared approximations.

## Per-tick evaluation

1. Obtain aircraft kinematics, atmosphere/wind and actual configuration/control state.
2. Compute local air-relative velocity at the panel reference point, including the angular-rate contribution from the offset station.
3. Project local flow onto the element's chord/span/normal axes and derive local dynamic pressure, Mach, AoA and sideslip as supported.
4. Query the element's coefficient data at the applicable state and surface deflection.
5. Apply only sourced physical modifiers such as control deflection, high-lift state, damage or installation interference.
6. Return force vector at the element point, plus any independently modeled hinge or distributed moment.
7. Compute moment about the current CG exactly once.

The element must report out-of-domain input, unavailable coefficient data, extrapolation attempt and approximation tier. It must not silently clamp AoA or Mach to the last table row and pretend the result remains valid.

## Surface types

The shared representation should support wing panels, canards where fitted, horizontal stabilizers/stabilators, vertical fins/rudders, ailerons, tailerons, flaperons, elevators, flaps, slats, spoilers and other documented lifting/drag elements. Exact control/effect association belongs in the aircraft installation, not in name-based branches.

Fixed LERX/LEX and other shaping features may be represented as geometry/flow-interaction definitions or dedicated elements when the chosen model supports them. Do not invent a control actuator for a fixed surface.

## Damage and asymmetry

Elements reference local damage/structural zones. A cut or degraded panel modifies only the affected element/connected control path according to the damage model. Left/right elements are not automatically identical at runtime: asymmetrical stores, damage, icing, actuator position and local airflow must remain distinct.

## Diagnostics

Expose local flow vector/speed, dynamic pressure, AoA/sideslip, Mach, coefficient lookup result, force, application point, moment, area, damage and validity. These diagnostics support debugging and verification; they do not expose private internal tracks or sensor state.

## Tests

Test area summation, station transforms, angular-rate local velocity, mirrored geometry, force/moment sign, panel contribution additivity in the linear regime, coefficient boundary behavior, symmetric trim, single-panel damage, asymmetric store loading, and no duplicate area/forces.
