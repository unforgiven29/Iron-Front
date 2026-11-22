# Passive ESM and radar-warning receiver

**Status: folder scaffold and README only for this task. This task added no ESM/RWR implementation code.**

This directory is reserved for future passive RF interception, emitter measurement, threat-library and warning-receiver systems. It is distinct from active radar: an ESM/RWR receiver listens to emissions and does not transmit an interrogation signal.

## Planned responsibilities

- Receiver tuning, instantaneous bandwidth, channelization, sensitivity, noise figure and dynamic range.
- Pulse/continuous-wave emission intercept and pulse descriptor measurements.
- Frequency, bandwidth, pulse width, PRI/PRF, modulation, scan characteristics and signal strength estimates.
- Bearing measurement architectures (amplitude, phase/interferometer, correlative and time-difference where supported by the installation).
- Bearing-only contact association, emitter track lifecycle and uncertainty.
- Threat-library matching with confidence and ambiguity, not guaranteed identity.
- Priority/alert logic, cockpit RWR display, audio warnings and operator controls.
- Cooperative ESM/DF and network geolocation only when multiple legitimate sensor observations are available.
- Connections to radar emissions, electronic attack, mission data and aircraft electrical/avionics systems.

## Information boundary

Passive observations must not contain a hidden emitter entity ID or perfect emitter position. A single receiver normally supplies bearing and signal characteristics, not direct range. Classification should preserve unknown/ambiguous emitters and confidence. Multi-platform triangulation requires separate geometry, time synchronization, measurement error and track association.

## Key failure and environment cases

Out-of-band emissions, low signal-to-noise ratio, antenna nulls, scan-dependent intercept probability, terrain masking, multipath, co-channel emitters, frequency agility, pulse-on-pulse overlap, receiver saturation, blanking, damage, calibration drift, threat-library mismatch and false/deceptive emissions.

## Relationship to other folders

- Radar generation and RF hardware: [radar source area](../radar/README.md).
- Shared RF propagation and scattering: [shared radar physics](../../../physics/radar/README.md).
- Platform-specific RWR hardware, antennas and threat libraries belong to exact aircraft equipment profiles.
- Cockpit presentation belongs to the aircraft/avionics display integration, not the RF receiver itself.

This README describes planned architecture only. It is not evidence of a working RWR, ESM tracker or aircraft warning display.
