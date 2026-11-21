# Weapon navigation, midcourse and guidance laws

**Owner:** physics/guidance. Weapon-specific navigation equipment, update modes and supported laws are selected in the weapon package. **Status:** architecture specification only.

This guide describes navigation and steering layers shared by many guidance architectures.

## Navigation / target-state sources

Possible sources include strapdown inertial navigation, with alignment error, bias, drift, update and fault states; GNSS/GPS or other external navigation, with availability, quality, outage, interference and integrity limits; prebriefed coordinates/waypoints/aimpoints with coordinate and datum uncertainty; launcher/aircraft/ship/ground director target-state cue; datalink updates from authorized sources, including age, latency, packet loss, association and covariance; terminal weapon seeker observations, which are local measurements and may disagree with the launch cue; and command guidance updates from an external director.

Each observation or update records source, time, coordinate frame, state estimate, uncertainty, validity and trust/association. A newer report is not automatically better if its quality is poor.

## Guidance laws are not seeker types

The guidance law consumes an estimated relative state and computes a command. Examples of abstract families include proportional navigation, augmented proportional-navigation variants, pursuit/lead-pursuit, command-to-line-of-sight, beam-centering, waypoint following and loft/trajectory shaping. The exact law and parameters must be justified for a given product. Do not assign a law based only on a marketing term or seeker label.

Law definitions specify required measurements, reference frame, update interval, gains or tabulated parameters, acceleration/turn command limits, target maneuver assumptions, navigation delay, terminal transition and behavior when measurements become stale.

## Autopilot and actuator boundary

Guidance command → autopilot/control allocation → actuator and fin/TVC state → actual vehicle forces/moments. Guidance must not directly teleport attitude or velocity. Guidance request, autopilot command, actuator output and realized acceleration remain separate. Saturation or damaged controls can prevent requested motion.

## Lifecycle and mode transitions

Use explicit mode transitions such as pre-launch initialization, midcourse, terminal acquisition, terminal track, coast, reacquisition, lost guidance, abort and end-of-life. Not all weapons support every phase. Each transition has triggering evidence, time, permitted inputs, timeouts and terminal behavior.

## Validation

Use analytical geometry cases and synthetic trajectories for sign, frame and continuity; then verify acceleration-command limits, navigation drift, update latency, target maneuver, mode handoff, actuator saturation, link loss and deterministic replay. No perfect target extrapolation or hidden target correction.
