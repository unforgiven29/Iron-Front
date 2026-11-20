# Navigation equipment and state estimation

**Owner:** game/systems/navigation. **Status:** architecture only; no complete navigation runtime exists.

## Responsibility
Provide navigation estimates from installed inertial, satellite, radio, air-data, magnetic/heading and map/terrain aids. Exact equipment fit, error models, alignment procedure and cockpit display mapping are platform/equipment configuration.

## Estimate, not truth
Publish estimated position, velocity, attitude/heading, altitude and time with source, acquisition tick, frame, validity, quality and uncertainty. Navigation must not read exact world entity state. Bias/noise/drift and source quality are equipment-specific and should evolve over time.

## Source behavior
INS alignment, bias and drift; satellite availability/interference/spoofing; radio beacon geometry/outage; air-data/static pressure errors; magnetic interference; terrain/map matching where fitted. Fusion may reconcile sources but must preserve disagreement and confidence.

## Consumers
Flight controls, radar stabilization, weapon navigation, AI route planning, cockpit and mission systems consume estimates and must handle stale/invalid/unavailable data.

## Tests
Known trajectories, drift accumulation, alignment, source outage, bias/noise, frame conversion, conflicting sources, spoofing/jamming abstraction, uncertainty growth and replay determinism.
