# Flight-control actuator coupling

**Owner:** physics/flight-model/actuator-coupling for the FM-to-actuator contract; actual actuator hardware and resource behavior remain with game/systems and the aircraft installation. **Status:** architecture only.

The A-4E-C source has an Actuator component with target position, finite motion speed and damage-dependent degradation. Iron-Front should preserve the important idea—surface position changes over time and can be degraded—while improving the coupling to the hydraulic/electrical systems already being specified in game/systems.

## Inputs

An actuator request identifies a physical actuator and driven surface/linkage, target position, command priority, relevant control mode, current mechanical load, and tick. The actuator owner receives actual available resources: hydraulic pressure/flow at ports, electrical power/voltage at the servo/valve, mechanical drive if applicable, component health and fault state.

## Outputs

Publish actual actuator displacement/angle, rate, force/torque where modeled, stroke/stop state, resource demand and actual supply, tracking error, saturation/stall, fault state and feedback validity. The FM reads this result and computes aerodynamic effects from actual control geometry.

## Required dynamics

At minimum support finite rate, finite force/torque, travel limits, backlash/deadband where sourced, load-dependent speed, friction/damping, leakage/compliance where relevant, jam/partial travel, power/pressure loss, damage and sensor feedback. An actuator must not reach target instantly solely because a command changed.

Hydraulic actuator motion is limited by pressure and flow, effective area, chamber arrangement, mechanical load and valve response. Dual-circuit/dual-chamber arrangements must use the actual aircraft port mapping. Electrical actuators and electrohydraulic servo valves have their own power/response dependencies.

## Failure distinctions

A failed command computer, lost electrical servo supply, lost hydraulic supply, broken line, pump failure, actuator seizure, linkage disconnect and surface damage are different failures. Preserve the causal chain in diagnostics. A damaged actuator need not imply the entire hydraulic circuit fails unless the leak/path topology makes that true.

## Numerical integration and performance

Actuator states update on a deterministic fixed tick or declared substep, not render cadence. Use stable rate/force limits and bounded solver iterations. Many small actuators can be aggregated only when their individual load, pressure and failure behavior do not affect the output fidelity.

## Tests

Step input/rate limiting; load changes; low pressure/flow; bus loss; dual-circuit degradation; asymmetric actuator failure; mechanical stops; jam/leak; feedback failure; save/restore; replay; and proof that FM output follows actual position rather than command target.
