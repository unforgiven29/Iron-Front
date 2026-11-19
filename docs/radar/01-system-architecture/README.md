# 01 — System Architecture

## Purpose
Define radar subsystem boundaries, lifecycle, data ownership, timing, and the complete signal-chain orchestration.

## Categories
- **System composition:** radar set, replaceable modules, installed options, and platform interfaces.
- **Configuration and variants:** equipment selection, hardware options, software baseline, and capability restrictions for each platform.
- **Signal-chain orchestration:** dependencies from transmit scheduling through measurement and track output.
- **Lifecycle:** power-up, warm-up, built-in test, standby, transmit, receive, cooling, shutdown, and fault states.
- **Time and scheduling:** pulse events, dwell intervals, revisit periods, timestamps, and synchronization.
- **Coordinate frames:** body, world, antenna, local-level, and target-relative frames; axis and angle conventions.
- **Interfaces and ownership:** which subsystem owns each state value and which systems may change it.
- **State and telemetry:** readiness, health, modes, temperatures, resource use, and diagnostics.

## Interactions
Coordinates hardware, antenna, waveform, propagation, target, receiver, processing, detection, tracking, display, and platform systems. No display or mission layer may bypass the signal chain.

## Boundary
This folder defines composition and orchestration. Detailed physics belong in their dedicated folders; aircraft-specific installations belong in folder 20.
