# Fire-control and weapon-release solution services

**Owner:** game/systems/fire-control. **Status:** architecture only; no firing-solution engine exists.

## Responsibility
Turn permitted target/track observations and own-platform/weapon state into estimated aiming/intercept/release solutions. Sensor owners provide observations; ballistic/weapon physics estimate trajectories; platform packages provide sights, stabilization, control procedures and exact weapon fit.

## Inputs
Track/measurement with source/time/uncertainty; own-platform navigation/state; weapon/station configuration; ballistic tables; range/rate/angle limits; stabilization and actuator state. Reject stale, invalid, incompatible or unsupported data explicitly.

## Outputs
Predicted intercept/release point, time, launch/release envelope, uncertainty, quality, limiting reason and operator cue. It is an estimate, not a guaranteed hit. A release command goes to launcher; launcher owns compatibility, interlocks, consent/arming and separation validation.

## Domain separation
Gun lead, bomb release cue, missile launch cue and ground/naval fire solution may share contracts but have different constraints. The weapon seeker/guidance owns post-release updates. Do not use a hidden target coordinate or bypass sensor/launcher state.

## Tests
Known geometry/kinematics, stale track, uncertainty sensitivity, unavailable navigation, wrong store, outside envelope, stabilization failure, command delay and no hidden-target access.
