# Claude Implementation Guide — Sensor Suite

Audit existing radar, IRST, RWR/ESM, EO/FLIR, IFF, datalink, navigation, cockpit and graphics code before adding anything. Preserve working systems and assign one canonical owner to each capability.

## Rules

1. No sensor receives a perfect list of world entities.
2. Sensor physics creates measurements; detection logic creates detections; tracking estimates state; classification estimates identity.
3. Reports carry timestamps, coordinate frames, uncertainty, quality, source and validity.
4. Remote/datalink reports remain distinguishable from onboard observations.
5. Sensor fusion must account for time alignment, uncertainty and correlated information.
6. Hardware readiness, power, cooling, alignment, damage and software limits affect capability.
7. A sensor's physical mechanism must remain distinct: radar is active RF, IRST passive IR, RWR/ESM passive RF interception, EO/FLIR optical imaging.
8. Graphics visualizes sensor output; it never determines it.
9. Use aircraft-specific equipment fits and variant baselines; never grant a capability merely because another aircraft has it.
10. Do not invent classified performance data. Mark estimated/synthetic values.

## RWR/ESM implementation

Use [the dedicated RWR implementation guide](../../sensors/RWR/CLAUDE_IMPLEMENTATION_GUIDE.md) and [validation/data standard](../../sensors/RWR/README.md). The RWR must intercept actual time-bounded radar/RF emissions through the shared RF environment. It must not read radar tracks or campaign truth. Model antenna installation, receiver sensitivity/bandwidth/dynamic range, scan/channel dwell, pulse measurements, deinterleaving, probabilistic library matching, bearing uncertainty, emitter tracks and separate threat assessment. A single bearing does not provide range. A detection does not prove hostile identity, lock or launch.

## Implementation workflow

For each sensor, deliver: repository audit, ownership map, data contract, one end-to-end equipment fit, deterministic tests, degraded/failure behavior, cockpit integration, performance profile and limitations. Implement fusion only after independent sensor reports are trustworthy. Keep shared interfaces generic but keep the actual physics and equipment behavior specific.

## Acceptance criteria

A sensor feature is not done because a cone, scope, glowing target or contact icon appears. It is done when observations arise through the appropriate physical chain, uncertain measurements are produced, tracks degrade when updates are missed, failures propagate, tests cover normal and edge cases, and performance is measured in representative browser scenes.
