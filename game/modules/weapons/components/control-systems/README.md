# Weapon autopilot, control allocation and actuators

**Owner:** weapon component configuration and control-interface contract. Shared guidance laws live in physics/guidance; actuator/rigid-body response is part of the selected vehicle model. **Status:** architecture only.

Guidance does not directly move the weapon. It generates a bounded command; the autopilot/control system translates that request into actuator commands; actual fin/TVC/jet-vane movement and vehicle response determine the realized path.

## Product configuration

Define installed control architecture: fin/tail/canard arrangement, thrust-vectoring/jet-vane capability if fitted, actuator type and count, command/feedback sensors, power/thermal dependency, travel/deflection limits, rate limits, force/torque capability, response delay, mechanical stops, damping/stability control and any stage-dependent configuration.

## Runtime state

Track commanded attitude/acceleration/turn rate, actual actuator commands, actual surface/TVC positions, actuator rates, saturation, tracking error, health, power and damage. Separate requested and achieved control. A fin stuck at neutral is not equivalent to a functioning fin receiving zero command.

## Failure/degradation

Model actuator jam, surface damage, hinge failure, power interruption, sensor/feedback failure, cable/driver fault, loss of TVC authority, asymmetric actuation and structural overload only where the configuration supports those components. A damaged actuator affects control authority and may affect drag/force, but does not automatically imply loss of the entire missile.

## Interfaces

Inputs: timestamped bounded guidance command, body attitude/rates, measured/estimated navigation/seeker state where used, actuator health and power. Outputs: actual actuator state, control limits, realized control authority and diagnostics for vehicle dynamics. No direct target-state access.

## Validation

Test command step/rate limits, saturation, stability/oscillation, actuator lag, asymmetric faults, power loss, fin/TVC damage, guidance-command change and deterministic replay. Verify the trajectory follows achieved actuator motion, not the desired command.
