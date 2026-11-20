# World content streaming

Own chunk identity, dependencies, load/unload lifecycle, caches, content versions and memory policy. Streaming does not decide whether an entity exists.

Chunk records include stable spatial ID/bounds, version, data/assets, neighbor references, load priority, memory estimate and unload policy. Separate physics/sensor/mission-critical proxies from optional render detail. Failed validation never exposes partial state.

Lifecycle: unrequested → queued → loading → validating → resident/queryable → cooling/unloading → evicted. Active entities and campaign state persist through visual unload. Procedural content uses scenario seed/generator version and stable boundaries.

Test load-order independence, tile seams, failed chunk, entity unload/reload identity, cache eviction, mission content retention, memory ceilings and mobile profiles.
