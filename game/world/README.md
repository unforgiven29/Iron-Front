# World simulation and content

**Owner:** game/world for authoritative spatial content and procedural placement. Core owns generic spatial transforms/indexes; physics owns collision/propagation; sensors own detection; renderer owns visual representation; campaign owns strategic rules.

## Domains
terrain = elevation/surface/slope/roughness. structures = buildings/bridges/facilities and destruction. vegetation = biome/species/density/occlusion proxies. water = coast/rivers/lakes/sea/depth. infrastructure = roads/rail/airfields/ports/depots/refineries/power/communications. streaming = chunk identity/lifecycle/cache.

## Truth versus presentation
Stable world IDs and physical/material/operational state are authoritative. Render mesh is a derived representation. Sensors query physical LOS/propagation and never renderer visibility. Campaign references world IDs; it does not own geometry.

## Procedural generation
Use scenario seed + generator ID/version + geospatial origin/region and biome constraints. Keep templates separate from per-campaign edits. Reproducible generated content stays stable; hand edits require serialized overrides/change records.

## Streaming
Render chunk unload is not entity destruction. Preserve mission-critical entities/facilities/objectives across visual unload. Use bounded caches, collision/visibility proxies and deterministic rehydration.

## Destruction propagation
World publishes authoritative change event. Collision, navigation, radar/optical path, AI and renderer update their own representations. Validate seams, generation repeatability, obstruction, destruction, route graph, streaming reload and memory.
