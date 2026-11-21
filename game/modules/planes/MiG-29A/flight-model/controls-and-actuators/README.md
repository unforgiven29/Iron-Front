# MiG-29 product 9.13 — control surfaces and actuator installation

**Owner:** MiG-29 aircraft control-system/platform configuration. Shared command mapping and actuator contracts live under physics/flight-model. Electrical and hydraulic networks own the actual power/pressure/flow. **Status:** research/install map only.

## Configuration to resolve

Record pilot stick/pedal/trim channels; SAU/stability-augmentation and control-law modes; surface mixing and limit logic; all-moving horizontal stabilizer/taileron command and pivot mapping; aileron/rudder/flap/slat controls; actuator count and location; chamber-to-hydraulic-circuit routing; electrical command/servo-valve supply; sensor feedback; mechanical stops; failure/reversion modes; cockpit controls/indications; and exact variant/software applicability.

Do not assume one control axis maps directly to one surface angle. The twin tail, actuator and flight-control system composition must be represented from the selected configuration.

## Hydraulic/electrical coupling

Use the MiG-29 systems installation guides for main and boost hydraulic circuits, dual-chamber actuator arrangements and electric control dependencies. The GAF manual's topology is a source-described installation but its exact applicability to product 9.13 remains to be confirmed. Do not treat its stated circuit architecture or numerical values as product 9.13 fact until verified.

Actual surface position comes from actuator behavior under the delivered pressure/flow, electrical supply, mechanical load and damage. FM coefficients consume actual position. A control law can request motion while the actuator is stalled or degraded.

## Failure cases

Cover one hydraulic circuit lost; one actuator/chamber degraded; asymmetric tail/aileron/rudder response; electrical control/servo supply lost; sensor/feedback failure; linkage jam/disconnect; surface damage/separation; and control augmentation failure. The correct residual control authority must be source-supported, not guessed.

## Acceptance

Verify command-to-surface mapping, correct sign/range, rates under normal/degraded pressure, dual-chamber partial failure, asymmetric response, control mode switching, feedback validity and deterministic replay. Compare both circuit-loss cases independently.


## Movable-device state and schedule checklist

Keep independent command and actual-state channels for:
- taileron symmetric pitch and differential roll;
- aileron roll control;
- twin rudders/yaw control;
- leading-edge flap/slat mechanism (retain original source terminology until physical slot geometry is confirmed);
- trailing-edge flap movement and cockpit flap selection;
- upper/lower fuselage speedbrake motion, including possible non-synchronous achieved position and any documented blow-back/interlock.

The GAF T.O. source describes the speedbrake panels as electrically controlled/hydraulically operated and says the two panels operate simultaneously but are not synchronized. Preserve this distinction; do not force identical actual positions by sharing a single animation scalar. Exact blow-back thresholds, flap schedules and interlocks require confirmed applicability to product 9.13.

The DCS manual's numeric slat/flap/speedbrake behavior is simulator-reference material only. Do not promote it to product 9.13 technical data without independent confirmation.
