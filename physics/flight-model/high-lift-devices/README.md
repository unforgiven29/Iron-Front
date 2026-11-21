# High-lift, lift-dump and drag-device integration

**Owner:** physics/flight-model/high-lift-devices owns the shared device taxonomy, configuration and schedule interfaces. Aircraft packages own exact fitted devices and schedules. Actuator, resource and aerodynamic owners execute actual motion and aerodynamic effects. **Status:** architecture only; no device runtime exists.

This subsystem covers high-lift devices, primary controls with dual functions, spoilers/lift dump, speedbrakes/airbrakes and other movable aerodynamic devices. Every device is aircraft-specific in presence, geometry, movement, actuator, schedule, interlocks and aerodynamic effect.

## 1. Do not collapse device types

A shared data model must distinguish at least:

| Device type | Physical geometry / function | Typical aerodynamic consequence |
|---|---|---|
| Leading-edge slat | Movable leading-edge element that opens a slot between slat and main element | Changes leading-edge flow and usable AoA/separation behavior; may increase lift and drag |
| Leading-edge flap (LEF) | Leading-edge surface changes camber/shape; it does not necessarily form a slot | Changes lift, pitching moment, drag and stall progression |
| Trailing-edge flap | Plain, split, single-/double-slotted, Fowler or other actual flap geometry | Changes camber and sometimes effective area; changes lift, drag, pitching moment and control effectiveness |
| Flaperon | Trailing-edge surface with both flap and roll-control duties | Combines scheduled symmetric flap displacement with differential roll command; needs separate command components and mixing |
| Aileron | Differential roll-control surface | Produces rolling moment, adverse yaw and local lift/drag changes |
| Elevator / stabilator / taileron | Pitch control, with possible differential roll duties for tailerons/stabilators | Pitching and/or rolling moment; all-moving geometry differs from hinged elevator |
| Rudder | Yaw control | Yawing moment and side force; may be coupled to roll or high-AoA augmentation |
| Spoiler / spoileron | Upper-surface panel that disrupts local lift; may be lift dump, roll assist or drag device | Reduces local lift, adds drag and may create roll/yaw/pitch moments |
| Ground spoiler / lift dump | Spoiler arrangement deployed under ground/landing conditions | Rapid lift reduction and added drag; requires weight-on-wheels/arming/interlock logic |
| Speedbrake / airbrake | Dedicated drag surface, often fuselage- or wing-mounted | Adds drag and hinge/load effects; may also produce pitch/yaw moments or local flow changes |
| Trim tab / balance tab / servo tab | Small auxiliary surface linked to a primary control | Changes hinge moment, trim force or control feel; only model functions confirmed for the aircraft |
| Fixed LERX/LEX / strake | Fixed shaping feature, not a movable device | May create vortical flow and alter high-AoA lift/flow; geometry/flow model, not an actuator |

A device name alone does not establish its physical mechanism. In particular:
- A slat is not interchangeable with a leading-edge flap.
- A speedbrake is not automatically a spoiler.
- A spoiler that dumps lift is not equivalent to a symmetric airbrake.
- A flaperon needs overlapping flap and roll-control behavior, not two duplicate independent surfaces occupying the same area.
- Fixed LERX/LEX geometry must never be given a movable actuator unless the exact aircraft contains a movable device.

## 2. Three independent layers

1. **Command and schedule:** pilot, automatic flight-control system or ground/landing logic requests a target/mode. Aircraft-specific laws determine command scheduling and interlocks.
2. **Physical device/actuator:** electrical, hydraulic, pneumatic or mechanical actuators determine the achieved position, rate, force and symmetry under hinge load, friction, stops, damage and resource loss.
3. **Aerodynamic effect:** local aerodynamic elements consume actual achieved geometry/deflection and evaluate the corresponding device-state coefficient data or validated interaction model.

Keep command, scheduled target, actuator target, achieved surface position, measured feedback and cockpit indication separate. A switch or FLCS request does not prove that a surface moved.

## 3. Required device configuration record

Every device/segment requires:

- Stable ID, aircraft/product/variant/software applicability, side and segment.
- Device taxonomy and physical mechanism; do not rely on a free-text label alone.
- Hinge/pivot axis, hinge line, chord/span extent, area, gap/overlap and neutral geometry.
- Motion limits, sign convention, mechanical stop, hinge moment and structural/load limit where known.
- Actuator type, count/location, linkage, transmission ratio, powered supply and feedback sensor.
- Command schedule inputs, modes, interlocks, hysteresis/debounce and failure fallback.
- Travel time, rate/acceleration, load-dependent behavior, backlash/free play/friction if modeled.
- Panel/element overlap and how base wing coefficients account for the movable portion.
- Aero data by actual position/configuration, validity envelope and coupling to other devices.
- Damage/icing/contamination zones, asymmetry monitor and cockpit indication.
- Source record, exact page/figure, provenance, uncertainty and review state.

## 4. Scheduling and control logic

Schedules can depend on actual aircraft state and selected aircraft logic, including:
- angle of attack, Mach, calibrated/indicated airspeed, altitude or dynamic pressure;
- gear handle, weight-on-wheels, air-ground state and landing/takeoff mode;
- flap/LEF mode, alternate-flap selection, stores/configuration and operating restrictions;
- flight-control law/gain mode, hydraulic/electrical supply, measured device position and fault state;
- pilot input, autopilot/stability augmentation and emergency/reversion selection.

Do not assume one universal flap schedule. Do not place a single hardcoded speed threshold in shared code. Put platform schedules in the exact aircraft configuration with source applicability.

## 5. Aerodynamic and mechanical effects

The model must consider only effects supported by the chosen aircraft model/data:
- lift/side-force/drag and pitching/rolling/yawing moment changes;
- local AoA, effective camber, separation onset and reattachment/slot-flow behavior;
- downwash/sidewash and interaction with wing, fuselage, tail, LERX/LEX or propulsion flow;
- hinge moment, actuator load, structural load, aeroelastic deflection and rate/load limiting;
- asymmetric deployment, jam, blow-back, detached/damaged panel and position-sensor disagreement;
- changes to control effectiveness, adverse yaw, trim demand and aircraft stability.

Avoid double counting: if a coefficient table already includes a particular flap/slat configuration, do not add the same lift/drag increment again as a separate generic force.

## 6. Aircraft-specific examples in this project

### F-16C Block 50
- Primary controls include left/right horizontal stabilators, flaperons and rudder.
- The flaperons also perform trailing-edge flap duty (TEF).
- Leading-edge flaps (LEF) are scheduled by the FLCS.
- Split fuselage speedbrakes are drag devices; do not represent them as wing spoilers.
- No separate wing spoiler is identified in the current source set. Keep it provisional/not-fitted pending exact-baseline confirmation.
- Do not relabel LEFs as conventional slats without evidence that the geometry forms a slot.

See [F-16 platform evidence package](../../../docs/platform-reference-program/aircraft/F-16C-Block-50.md).

### MiG-29 product 9.13
- Public manual sources describe leading-edge flaps/LEF and trailing-edge flaps; some simulator documentation calls the leading-edge devices slats. Preserve original nomenclature and verify actual slot geometry for the exact product.
- Upper/lower fuselage speedbrakes are described in the GAF T.O.; they are not wing spoilers.
- Fixed LERX/forebody extensions are geometry/flow features, not movable slats.
- No wing spoilers are identified in the current source set; do not add them without exact evidence.

See [MiG-29 product 9.13 platform evidence package](../../../docs/platform-reference-program/aircraft/MiG-29-product-9-13.md).

## 7. Failure and degraded operation

Test individually and in combinations where supported:
- asymmetric extension/retraction, actuator jam or runaway;
- pressure/flow loss, electrical servo/control loss or pneumatic loss where applicable;
- hinge damage, linkage disconnection, panel deformation/separation and mechanical stop;
- failed position feedback, disagreeing sensors or schedule computer failure;
- blow-back / load-limiting behavior and emergency retraction;
- interlock inhibition (wrong gear/ground/stores/configuration state);
- ice/contamination and surface roughness only where the model includes them.

The actual aircraft response is platform evidence, not a generic fallback table.

## 8. Validation checklist

- Geometry, hinge/pivot axes, panel area and no duplicate wing/control-surface area.
- Correct type classification and slot/camber mechanism.
- Schedule input/output tables and threshold/hysteresis behavior.
- Commanded versus achieved position/rate/feedback under normal and degraded resources.
- Symmetric and asymmetric deployment; force/moment signs and CG reference.
- Lift/drag/pitch and control-effectiveness trends against source or controlled model checks.
- Cross-coupling with other surfaces, stores, gear and local flow.
- Failure, reversion, interlock, blow-back and ground-spoiler logic as fitted.
- Deterministic replay and measured per-device browser cost.
