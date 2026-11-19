# Claude Implementation Guide — Flight Model

These are planned boundaries, not completed code. Audit the repository and preserve existing behavior before implementation.

## Before coding
Inspect all source files, script tags, build/deployment configuration and GitHub Pages base paths. Search for existing aircraft movement, collision, weapons, inputs and physics. Do not create a second flight engine beside existing code. Propose a staged migration before replacing anything.

## Aircraft definition contract
Each aircraft/variant should reference:
- Geometry: wing/tail planform, reference area/chord, control surfaces, stations and datum.
- Mass: empty/basic mass, fuel/store mass, CG envelope, inertia tensor and changing-mass rules.
- Aerodynamics: lift/drag/moment curves, stability derivatives, control effectiveness, Mach/Reynolds range, high-lift and stall data.
- Propulsion: engine family/count, position/orientation, thrust maps, spool response, fuel use, limits, inlet/nozzle and failure modes.
- Flight controls: direct/hydraulic/electric actuation, mixing, rate/position limits, trim, stability augmentation, autopilot and flight-control laws.
- Systems: electrical, hydraulic, pneumatic, fuel, oxygen, gear, brakes, pressurization, anti-ice and sensors.
- Stores: mass, drag, station, release state and asymmetric load effects.
- Damage: component locations, structural limits and subsystem-specific failure effects.
- Cockpit: controls, bindings, instrument inputs, warnings and startup dependencies.

## Physics requirements
### Rigid body
Use a 6-DoF state with world position/velocity, attitude, body angular velocity, mass and inertia. Define frame conventions. Sum forces/moments consistently. Update mass, CG and inertia as fuel/stores change. Use a stable integrator and document timestep limits.

### Aerodynamics
Derive air-relative velocity from aircraft motion and wind; compute dynamic pressure, Mach, Reynolds, AoA and sideslip. Calculate local flow at each surface, including angular-rate contributions. Use coefficient curves with explicit interpolation/extrapolation behavior. Include lift, profile/induced/wave drag where supported, moments, downwash, interference and control effectiveness. Stall is nonlinear; avoid a binary on/off threshold and arbitrary lift multipliers.

### Propulsion
Separate throttle command from engine response. Model spool up/down, altitude/Mach/temperature thrust lapse, fuel flow, thermal/pressure limits, startup/shutdown, relight/flameout where appropriate, afterburner where fitted, nozzle/propeller effects, inlet distortion and damage. Turbofan, turbojet, turboprop, piston and turboshaft behavior must not be collapsed into one fake engine.

### Controls and ground handling
Distinguish commanded, actual and measured surface positions. Include actuator rate/position limits, power availability, saturation, jams and reversion modes. Ground handling includes gear geometry, suspension, tire contact, friction, steering, braking, runway slope/roughness, weight-on-wheels and brake/gear damage.

### Coupling
Electrical power can limit avionics, pumps and actuators. Hydraulic pressure limits controls, brakes and gear. Fuel transfer changes CG and engine feed. Bleed air affects pressurization/anti-ice when applicable. Icing and temperature affect performance. Damage cascades only through explicit dependencies, not unrelated random penalties.

## Test gates
Unit/dimensional and frame tests; trimmed level flight; steady turns; stall entry/recovery; compressibility; control saturation; engine spool/start/failure/fuel burn; takeoff/landing/bounce/braking; gear failures; store release/asymmetry/CG; deterministic replay across frame rates; many-aircraft performance.

## Implementation order
1. Units, frames, simulation clock and 6-DoF state.
2. Rigid-body integration, gravity and force interfaces.
3. Atmosphere and air-relative flow.
4. One test airframe with documented coefficients.
5. Lift/drag/moments and trim validation.
6. Per-surface flow, actuators and nonlinear stall.
7. Engine spool/thrust/fuel and installation.
8. Gear, ground handling and stores.
9. Electrical/hydraulic/fuel/oxygen/pressurization coupling.
10. Damage, failures, cockpit instruments and AI controls.
11. Additional aircraft/variants and higher fidelity.
12. Profiling, replay and regression suite.

At every stage state what works, what is approximate, sources, tests and unsupported behavior. A cockpit mesh or animation is not a completed subsystem.
