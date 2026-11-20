# Campaign scenarios and initial conditions

**Owner:** campaign/scenarios. **Status:** scenario definition format planning only.

A scenario declares stable ID/version, world generator ID/version/seed, map region/geospatial origin, biome/terrain constraints, town/city/infrastructure placement rules, factions, starting forces/airfields/ports, initial frontline, economic/logistics baseline, civilian population distribution, diplomacy/tension, objective templates and permitted content/modules.

Separate reusable templates from generated state and campaign mutations. Deterministic generation must produce same placement from seed + generator version. Hand-authored edits require explicit overrides/change records. Do not encode runtime world truth in scenario metadata.

Validation: region bounds, valid spawn placement, road/river connectivity, runway/port suitability, faction/equipment references, starting resource balance, civilian-area constraints, spawn collisions and expected memory/performance.
