# Air-domain AI behaviors

Own reusable air-agent task and tactical policies, not flight dynamics, sensors or aircraft autopilot internals. Behaviors include navigation, formation, takeoff/landing requests, patrol/CAP, intercept, escort, BVR/WVR policy, disengage, refueling rendezvous, recovery and emergency tasking.

Agents consume onboard/remote sensor reports with uncertainty and age. They issue tasks/control requests through aircraft adapters. Physical turn/energy/control limits, sensor scan limits and weapon envelopes come from actual platform/equipment snapshots. Doctrine is data, not platform-name branching.

Test formation in wind/damage, lost comms, stale target, low fuel, sensor degradation, unsupported stores, disengagement and deterministic decision replay.
