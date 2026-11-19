# 15 — Multisensor and Network Integration

## Purpose
Describe how radar measurements/tracks interact with other sensors, aircraft systems, and external participants without confusing source or certainty.

## Categories
- **Datalink exchange:** remote track messages, timestamps, source identity, quality, and update age.
- **Cooperative sensing:** shared observations and coordinated sensor tasking where supported.
- **Sensor fusion:** combining radar with IRST, ESM, optical sensors, AWACS, ground radar, and other sources.
- **Track correlation:** deciding whether reports from different sensors describe the same object.
- **IFF integration:** associate identification responses with measurements while keeping identification separate from physical detection.
- **Navigation/inertial inputs:** platform position, attitude, velocity, timing, and their errors.
- **External C2:** cueing, search assignments, priorities, and control messages.
- **Track provenance:** onboard, remote, fused, extrapolated, or stale source status.
- **Latency/network failure:** delayed messages, packet loss, update gaps, and inconsistent clocks.
- **Security/trust:** distinguish trusted platform data from unknown or potentially misleading reports.

## Interactions
A remote track may cue a radar but must not automatically become an onboard radar detection. Fused tracks retain provenance, age, uncertainty, and confidence.

## Boundary
Handles information exchange and fusion. Individual sensor physics remain in their own subsystems.
