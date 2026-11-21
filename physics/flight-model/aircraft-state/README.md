# Flight-model aircraft state inputs

**Owner:** physics/flight-model/aircraft-state for the FM's derived, read-only state view. **Status:** architecture only.

This folder defines the state contract consumed by flight-model components. It does not create a second aircraft truth object. Position, velocity, attitude, angular velocity, centre of mass, mass and inertia are authoritative in physics/rigidbody. Atmosphere and wind are supplied by physics/environment. The FM builds a consistent per-tick view and derives local quantities needed by elements.

## State groups

**Kinematics:** world position; body-to-world orientation; world and body linear velocity; angular velocity; angular acceleration where supported; current centre of mass; current mass/inertia reference; ground-relative velocity when available.

**Air-relative state:** wind and gust at the aircraft reference point; body-relative air velocity; true airspeed; Mach from local speed of sound; angle of attack; sideslip; air density; static pressure; ambient temperature; speed of sound; dynamic pressure. Derived values must record their source frame and tick.

**Configuration:** exact aircraft/variant/data version; stores and external tank configuration; flap/slat/spoiler/speedbrake positions; gear and hook state; damage/icing/contamination state; engine configuration; flight-control mode and actual actuator positions.

**Ground/environment context:** terrain/surface height and normal, ground-relative velocity, surface material/friction interface, wind field and model validity. This is only exposed to the FM components that need it.

## Derivation conventions

Use one documented convention for aircraft body axes, wind axes, ENU world axes, positive AoA/sideslip and quaternion direction. Do not infer one convention from a variable name or reproduce DCS's host callback coordinate convention. Convert at an adapter boundary and test cardinal cases.

Airspeed at an aerodynamic element differs from the CG airspeed because of angular motion. The element owner computes its station-local velocity from the aircraft air-relative state and angular velocity using the defined local offset. The assembly must not compute one global AoA and pass it to every element.

Keep true/physical state separate from instrument measurements. A failed pitot/static system can corrupt indicated airspeed/altitude while the physical velocity and atmospheric state remain unchanged.

## Validity and freshness

Each derived quantity carries tick, units, frame, validity and uncertainty/precision tier. Reject zero/negative density, invalid speed of sound, non-finite quaternion, stale rigid-body state or mismatched configuration version according to explicit policy. A value can be mathematically valid but outside the coefficient dataset's supported envelope.

## Tests

Verify body/world transforms; zero-wind and crosswind air-relative velocity; AoA/sideslip sign; station velocity under pure roll/pitch/yaw rate; dynamic pressure; Mach; atmospheric boundary cases; CG shift; frame conversion; invalid/NaN input rejection; and identical state derivation on deterministic replay.
