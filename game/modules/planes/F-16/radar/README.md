# F-16C Block 50 radar installation

**Selected working baseline:** AN/APG-68(V)5 pending exact operator/software verification. This directory owns installation/fit data only. Shared radar equipment/processing is in sensors/Radar; RF propagation/scattering is in physics/radar.

## Installation contract
Record exact radar designation and software/OFP compatibility, antenna/aperture geometry and boresight frame, mounting position/orientation, stabilization/navigation inputs, scan volume, control/display interfaces, power/cooling demand, built-in test/startup, damage/maintenance routes and supported modes. Record which capabilities are confirmed, provisional or unknown.

## Integration
Avionics sends mode/task commands and receives radar reports through typed contracts. Radar reports preserve detection/track uncertainty and source/time; cockpit pages consume snapshots. Electrical/cooling systems grant actual resources. Damage to antenna, transmitter, receiver, wiring or cooling degrades only connected functions.

## Variant discipline
Do not silently substitute APG-68(V)9, APG-83 AESA or another block/operator software baseline. Do not infer antenna or hardware details from a visual model. Every technical value has source/page/revision/applicability.

## Tests
Configuration compatibility, mounting/boresight, stabilization input, power/cooling loss, control mapping, startup/BIT, damage isolation and radar-lab integration using the same production sensor modules.
