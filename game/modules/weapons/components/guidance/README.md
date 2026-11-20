# Guidance and autopilot component definitions

Own guidance-law and control configuration, not vehicle physics or target truth. Data declares law family, required seeker/navigation inputs, update rate, reference frame, limits, gains/tables, acceleration/turn constraints, actuator interface, terminal modes and lost-guidance policy.

Guidance computes a command request from estimated state/observations; actuator/rigidbody/propulsion/ballistics produce the actual motion. Validate coordinate frames, sensor delay/uncertainty, saturation, actuator loss, target maneuver, coast/reacquisition and deterministic integration.
