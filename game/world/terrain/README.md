# Terrain data and physical surface queries

**Owner:** game/world/terrain. **Status:** heightfield tiles, validated surface queries and a deterministic synthetic generator are implemented in `game/src/world/terrain/Terrain.ts` (tests: `game/tests/unit/Terrain.test.ts`). Not yet implemented: measured geodata import, geodetic CRS/datum transforms, materials/friction/roughness, streaming, LOS/propagation and navigation representations, and render-mesh derivation.

## Implemented contract
- A tile declares a stable id, version, ENU origin, spacing, size, row-major heights (NaN = no data), vertical datum and provenance (`measured`/`synthetic` plus source). Bad definitions are rejected with every problem listed. The data is copied on load.
- A surface rejects duplicates, overlapping interiors, mixed vertical datums, and seams that disagree beyond a tolerance (1 mm by default). A point on a shared edge is owned by the first tile in id order.
- `sample(x, y)` returns `valid` (bilinear height, unit normal, slope, tile id/version, provenance), `no-data` or `outside-coverage`. Missing terrain is never reported as flat. `heightAboveTerrain` passes those statuses through.
- `generateSyntheticTile` builds fractal value noise keyed only by world position and seed. Neighbouring synthetic tiles therefore meet exactly, and the result is labelled synthetic.

Terrain tiles declare stable ID, coordinate reference/geodetic origin, horizontal resolution, vertical datum/units, elevation source/quality, no-data policy, material, slope, roughness, friction/soil data and version. Keep measured source and procedural/synthetic content distinct.

Derive separate render mesh, collision heightfield, mobility surface query, LOS/propagation and navigation cost representations from one versioned source. Return validity/source with elevation, normal, slope and surface samples. Unknown terrain must not silently become flat ground.

Validate source checkpoints, tile seams, datum, normals/slope, missing tile, render/physics proxy alignment, mobility/LOS behavior and streaming boundary.
