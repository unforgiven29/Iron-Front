# Campaign scenarios and initial conditions

**Owner:** campaign/scenarios. **Status:** scenario definition format planning only.

A scenario declares stable ID/version, world generator ID/version/seed, map region/geospatial origin, biome/terrain constraints, town/city/infrastructure placement rules, factions, starting forces/airfields/ports, initial frontline, economic/logistics baseline, civilian population distribution, diplomacy/pre-war tension, mobilisation posture, strategic warning/escalation posture, objective templates and permitted content/modules.

## Scenario phases
A scenario may begin in peacetime, heightened tension, mobilisation/crisis, active war, ceasefire/negotiation, occupation/withdrawal or post-war recovery. Each phase declares its legal transitions, required authority, triggers, timers, force-posture changes and irreversible consequences. Intercept or air-policing missions during a tension phase remain separate from a declared attack/war state; an encounter or false alarm alone must not automatically start a war.

## Map and generation
A scenario may choose a deterministic generated operational theatre or a region of the geospatial Earth. A generated theatre can rearrange named settlements, airfields, roads and infrastructure for each new seed while preserving a saved seed/version for replay. Geospatial scenarios preserve source coordinates and place identities.

Separate reusable templates from generated state and campaign mutations. Deterministic generation must produce same placement from seed + generator version. Hand-authored edits require explicit overrides/change records. Do not encode runtime world truth in scenario metadata.

Validation: region bounds, valid spawn placement, road/river connectivity, runway/port suitability, faction/equipment references, starting resource balance, civilian-area constraints, legal phase transitions, escalation authority, spawn collisions and expected memory/performance.
