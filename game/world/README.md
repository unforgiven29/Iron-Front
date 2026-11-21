# World simulation and content

**Owner:** game/world for authoritative spatial content and procedural placement. Core owns generic spatial transforms/indexes; physics owns collision/propagation; sensors own detection; renderer owns visual representation; campaign owns strategic rules.

## Domains
terrain = elevation/surface/slope/roughness. structures = buildings/bridges/facilities and destruction. vegetation = biome/species/density/occlusion proxies. water = coast/rivers/lakes/sea/depth. infrastructure = roads/rail/airfields/ports/depots/refineries/power/communications. streaming = chunk identity/lifecycle/cache.

## Two world-content modes
- **Generated campaign theatre:** scenario-seeded terrain, biome, town/city, roads, airfields, facilities and force placement. New campaigns may rearrange settlements and installations while preserving generator/version determinism for a saved seed.
- **Geospatial Earth:** real-coordinate continents, countries/borders, elevation, settlements, airports, roads/rail, rivers/coastlines and selected infrastructure from licensed/provenanced datasets. Region/tile streaming keeps memory bounded. A real airport/place name does not guarantee that every local detail or current military attribute is accurate.

Both use the same coordinate, entity and query contracts. Mark every data item as source-reported, derived, estimated, synthetic or hand-authored; retain dataset version/licence and quality. A theatre may be fictional or geospatial, but must not silently mix synthetic terrain with real coordinates without a declared transform.

## Truth versus presentation
Stable world IDs and physical/material/operational state are authoritative. Render mesh is a derived representation. Sensors query physical LOS/propagation and never renderer visibility. Campaign references world IDs; it does not own geometry.

## Continuous operations and environment
The active sortie/battle and campaign world share authoritative entity identities, time references and event interfaces. Time-of-day, seasons, weather, visibility, fog, precipitation, wind and environmental hazards affect relevant physics, sensors, movement and civilian services; visual effects do not independently decide those effects. A local battle must be able to load around a real place while the strategic war continues under declared coarse/aggregate update rules elsewhere.

## Procedural generation
Use scenario seed + generator ID/version + geospatial origin/region and biome constraints. Keep templates separate from per-campaign edits. Reproducible generated content stays stable; hand edits require serialized overrides/change records.

## Streaming
Render chunk unload is not entity destruction. Preserve mission-critical entities/facilities/objectives across visual unload. Use bounded caches, collision/visibility proxies and deterministic rehydration.

## Destruction propagation
World publishes authoritative change event. Collision, navigation, radar/optical path, AI and renderer update their own representations. Validate seams, generation repeatability, obstruction, destruction, route graph, streaming reload and memory.
