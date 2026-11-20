# World and environment architecture

The world owns authoritative spatial truth: terrain elevation/surface properties, water, vegetation, structures, infrastructure, airfields and world-object placement. It does not own rendering, sensor detection or campaign rules.

## Canonical ownership

- Terrain: elevation, slope, material, roughness, friction and collision/LOS representations.
- Structures: buildings, bridges, shelters, obstacles, destructible state and damage interfaces.
- Vegetation: species/instances, collision/occlusion proxies, density and biome/season variation.
- Infrastructure: roads, rail, bridges, airfields, ports, fuel/power facilities and communications sites.
- Water: coastlines, lakes, rivers, sea regions and relevant surface data.
- Streaming: spatial chunk identity, dependencies, load/unload lifecycle, LOD and memory budgets.

Core spatial services provide transforms/indexes. Physics owns collision/propagation; world supplies geometry/material inputs. Sensors query physical services, never renderer visibility. Graphics renders world snapshots but does not own world truth.

## Procedural generation and persistence

Procedural placement uses versioned seeds, biome/terrain constraints, infrastructure rules and stable IDs. Generated content must be reproducible from scenario seed and generator version or explicitly serialized. Separate reusable templates from per-scenario changes.

## Destruction and performance

A structure/terrain change publishes an authoritative event and updated world state. Collision, LOS, radar/IR propagation, navigation, AI and rendering consume appropriate updated representations. Stream chunks by relevance, maintain bounded caches, use LOD/compact proxies and profile CPU/memory. Unloaded visual detail must not delete mission-critical state.

**Status:** Architecture and folder structure only.
