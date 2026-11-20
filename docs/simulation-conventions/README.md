# Simulation conventions: units, frames, time and determinism

These are the initial project-wide conventions. A change requires an architecture decision and migration plan before dependent systems are implemented.

## Units

Use SI internally:
- distance: metre (m)
- mass: kilogram (kg)
- time: second (s)
- velocity: metre per second (m/s)
- acceleration: metre per second squared (m/s²)
- angle: radian (rad)
- angular velocity: radian per second (rad/s)
- force: newton (N)
- moment/torque: newton metre (N·m)
- pressure: pascal (Pa)
- temperature: kelvin (K)
- energy: joule (J)
- power: watt (W)
- mass flow: kilogram per second (kg/s)
- volume flow: cubic metre per second (m³/s)

Conversions to knots, feet, nautical miles, degrees, psi, Celsius and cockpit/operator units happen at named input/output boundaries. Field names alone never define units.

## Coordinate frames

### World frame

Use a right-handed local East-North-Up frame (ENU):
- +X: east
- +Y: north
- +Z: up
- gravity points along -Z.

A scenario declares its georeferenced origin. Local ENU coordinates are used for regional simulation. Larger theatres use tiled/geospatial coordinates converted to a local ENU origin for physics. Do not feed large geodetic values directly into float32 render buffers.

### Aircraft body frame

Use a right-handed Forward-Right-Down frame (FRD):
- +X: nose/forward
- +Y: starboard/right
- +Z: down.

Body angular rates are p about +X, q about +Y and r about +Z, in rad/s. Positive rotation follows the right-hand rule. Define every aerodynamic angle/sign convention at its owning API and cover it with tests; never infer a sign from a display label.

### Orientations and transforms

Use normalized quaternions stored as [x,y,z,w]. An aircraft attitude quaternion maps body-FRD vectors into world-ENU. The inverse/conjugate maps world vectors into body coordinates. Transforms are explicit and tested; no implicit axis swapping.

Renderer/model coordinate conversions belong in the rendering/asset adapter. Do not let a graphics library's preferred axes redefine simulation coordinates.

## Time and update rates

- Authoritative simulation time is integer ticks plus a fixed documented tick duration.
- Initial rigid-body/control integration target: 120 Hz (dt = 1/120 s).
- Sensor revisit, engine/system, AI/tactical, logistics/strategic and presentation rates are independently declared by their modules.
- Rendering is not the simulation clock. It reads immutable snapshots and interpolates; it never feeds interpolated values back into physics.
- Browser frame clamping after tab suspension is an explicit pause/suspension policy. A simulation overload must be visible; do not silently discard accumulated simulation ticks.
- Event ordering is deterministic: phase, priority and stable insertion/sequence key must be explicit.

120 Hz is the initial engineering target, not proof every eventual system can sustain it. Benchmark before increasing complexity or changing the rate.

## Determinism and randomness

Inject seeded random streams. Derive stable independent streams from scenario seed plus stable subsystem/entity identity so adding one unrelated entity does not reshuffle every random outcome. Record seeds, command inputs, module/data versions and numerical settings for replay.

Avoid nondeterministic iteration order, wall-clock dependence and untracked random APIs in authoritative simulation code. Define tolerances for floating-point replay comparisons.

## Precision

Use JavaScript number/double precision for authoritative regional world and physics state unless a measured need dictates otherwise. Convert to float32 only for rendering/GPU buffers. Large world scenes use local origins/rebasing at render boundaries; origin changes must not teleport or alter authoritative entities.

## Validation

Coordinate conversion round-trips, quaternion normalization, gravity direction, signs, timestep behavior, deterministic repeatability and render/physics separation require automated tests.
