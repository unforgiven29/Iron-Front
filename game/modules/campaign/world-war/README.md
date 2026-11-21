# World-war scale campaigns and geospatial theatres

**Owner:** game/modules/campaign/world-war. **Status:** architecture only; no global war runtime exists.

Own the large-scale political/military state of a world war and the selection/creation of operational theatres. It composes game/world, campaign, logistics, AI, naval and platform modules; it does not replace their local authorities.

## Two world profiles
1. **Generated operational theatre:** a bounded campaign region with seed/version-controlled terrain, biomes, towns, airports, roads, airfields and initial force placements. The same template/generator can produce different town/city/infrastructure arrangements for separate campaigns.
2. **Geospatial Earth:** a real-coordinate world assembled from explicitly licensed/provenanced elevation, country/border, airport, settlement, road/rail, river/coast and infrastructure datasets. Battles and sorties reference actual geography and stable place IDs. Stream detail by region; never require the whole Earth mesh in memory.

Both profiles use one coordinate/spatial contract. Real data, synthetic data and hand-authored edits remain distinguishable. Real-world place identity does not imply current real-world military data or accuracy.

## War state
Own global alignments/coalitions, war entry/exit, fronts and sectors, occupied areas, air/naval theatres, national force summaries, diplomatic relations and recorded changes. Tactical units and sorties remain separate entities; country summaries are projections of owned unit/personnel/logistics records, not duplicate force truth.

## Continuous conflict
Campaign time advances through declared multi-rate systems. Ground/air/sea operations, AI tasking, infrastructure attacks, logistics, economy, civilian conditions and political events continue while a player flies or fights on foot. Streaming a distant theatre out of view cannot pause its authoritative strategic state; use bounded aggregate simulation where full entity fidelity is not needed.

## Validation
Coordinate/frame consistency; reproducible seeded theatre generation; dataset provenance/licensing; stable real-place identity; geospatial seam/scale handling; theatre activation/deactivation; global time acceleration; force/economy reconciliation; deterministic campaign replay.
