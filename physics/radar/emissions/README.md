# Shared RF Emission Environment

**Status: architecture specification only. No emission propagation runtime is implemented by this README.**

This folder defines the shared world-space representation of RF emissions for passive receivers such as RWR/ESM. It extends the existing radar physics ownership; it must not become a second radar engine or a generic sensor detection shortcut.

## Ownership boundary

- Radar equipment under `sensors/Radar/` owns transmitter hardware, waveform generation, antenna/beam scheduling, mode state and equipment health.
- This shared physics boundary receives an emission description and evaluates what RF energy can reach a receiver.
- RWR equipment under `sensors/RWR/` owns its installed antenna/receiver, measurement, deinterleaving, classification and tracking.
- The environment does not decide whether an RWR detects, identifies or considers an emitter threatening.

## Emission contract

An emission is a time-bounded physical source description containing emitter/equipment identity, timestamp and duration, frequency characteristics, waveform/pulse timing where applicable, transmitted power or EIRP reference, antenna pattern reference, antenna pointing/orientation, polarization and source validity. It must reflect actual transmitter state and scheduler output.

Do not include hidden radar target tracks, target identity, lock state, campaign allegiance or player-relative threat conclusions. Those are not properties of the RF field.

## Passive interception path

For each candidate emitter/receiver pair, evaluate a direct propagation path and relevant antenna responses. The received signal calculation must use consistent reference planes and account for transmitted power/EIRP, transmitter antenna gain toward receiver, path loss, receiver antenna gain in the arrival direction, polarization mismatch, installation/system losses and modeled environmental effects.

This is not the radar's two-way echo path. Target RCS and radar detection results are not inputs to direct emitter interception. The receiver later applies its own sensitivity, bandwidth, noise, selectivity, dynamic range, channel availability and processing constraints.

## Timing and performance

Use event-driven emission intervals/pulses. Keep event ordering deterministic and timestamped. Spatial indexes and conservative culling may reduce candidate paths, but culling must not remove a physically relevant emitter. Cache static geometry and antenna data; update moving geometry and beam direction at the required simulation rate. Expose approximations and diagnostic path budgets.

## Validation

Test free-space link-budget scaling, antenna pattern orientation, polarization, terrain obstruction, receiver geometry, time-window overlap and deterministic replay. Verify that a radar can be intercepted without tracking the RWR aircraft, and that silent/receive-only equipment produces no emission event. Keep analytical fixtures distinct from public measured reference data and synthetic gameplay values.
