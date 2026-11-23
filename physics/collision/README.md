# Collision detection and contact response

**Owner:** physics/collision. **Status:** sphere contacts, swept sphere time of impact and segment-vs-terrain intersection implemented in `game/src/physics/collision/Collision.ts` (tests: `game/tests/unit/SpatialCollision.test.ts`). Not yet implemented: capsules/OBBs/convex hulls, contact resolution and response, materials and filters.

## Implemented contract
- `sphereContact` reports the exact normal (a → b), penetration, mid-overlap point and closing speed. Touching counts as contact. Coincident centres use a fixed world-up normal rather than NaN.
- `sweptSphereTimeOfImpact` finds the earliest contact time within a tick for constant velocities, so fast pairs cannot tunnel through each other.
- `findSphereContacts` runs a broad phase through `SpatialIndex` and then the exact test. Results are sorted by `(a, b)`, and duplicate ids are rejected.
- `segmentTerrainIntersection` marches a segment at a step no larger than the spacing and bisects each crossing to under 1 mm. It returns `hit` (point, fraction, normal, tile), `clear`, or `unknown` when it crosses no-data or uncovered terrain. Unknown terrain is never treated as clear.

Provide broad-phase candidate queries and narrow-phase contact results for aircraft, vehicles, infantry, structures, terrain, projectiles and debris. Do not own world geometry, mobility suspension, damage rules or visual culling.

Use validated collision proxies: spheres, capsules, OBBs, convex hulls, heightfields or swept volumes as needed. High-speed projectiles require swept tests to avoid tunneling. Contact output includes point, normal, separation/penetration, relative velocity and time-of-impact when supported. Rigidbody/vehicle systems consume contact through their own integration contracts.

Physical collision is not sensor LOS, radar blockage, optical visibility or blast occlusion; separate services/filters are required. Render LOD may not remove mission-critical collision proxies.

Validate analytic primitive pairs, edge/corner cases, sweeps, moving pairs, terrain seams, filters, material response, stable pair ordering and performance.
