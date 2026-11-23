# Spatial transforms and query services

**Owner:** game/core/spatial for frame transforms and indexes. World owns terrain/structure truth; physics owns collision/physical LOS; sensors own measurement processing. **Status:** uniform-grid broad-phase index implemented in `game/src/core/spatial/SpatialIndex.ts` (tests: `game/tests/unit/SpatialCollision.test.ts`): AABB upsert/remove, overlap queries and overlapping pairs, always in sorted order. Results match brute force and don't depend on insertion order. Not yet implemented: a transform graph with validity/time, float32 rebasing for render buffers, and hierarchical indexes.

## Frames and precision
Spatial values declare named frame, units and time. Current conventions: right-handed local ENU world, aircraft FRD body and normalized [x,y,z,w] body-to-world quaternion. Geodetic origin and vertical datum are scenario metadata. Keep authoritative world coordinates in double precision and convert/rebase for float32 render buffers at boundaries.

## Transform graph
Register transforms with validity/time and source/destination IDs. Reject missing, stale or cyclic transform paths. No implicit axis swaps or graphics coordinate conventions in physics APIs.

## Indexes and queries
Indexes accelerate candidate selection for entities, terrain, structures, emitters and collision. They do not decide actual collision, sensor detection or visibility. Update/invalidation follows authoritative movement/destruction and uses stable query ordering.

## Tests
Frame round trips, quaternion convention, rebasing invariance, index update/removal, deterministic query order, stale transform and proof index acceleration leaves results unchanged.
