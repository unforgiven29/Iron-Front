# Collision detection and contact response

**Owner:** physics/collision. **Status:** architecture only; no runtime solver exists.

Provide broad-phase candidate queries and narrow-phase contact results for aircraft, vehicles, infantry, structures, terrain, projectiles and debris. Do not own world geometry, mobility suspension, damage rules or visual culling.

Use validated collision proxies: spheres, capsules, OBBs, convex hulls, heightfields or swept volumes as needed. High-speed projectiles require swept tests to avoid tunneling. Contact output includes point, normal, separation/penetration, relative velocity and time-of-impact when supported. Rigidbody/vehicle systems consume contact through their own integration contracts.

Physical collision is not sensor LOS, radar blockage, optical visibility or blast occlusion; separate services/filters are required. Render LOD may not remove mission-critical collision proxies.

Validate analytic primitive pairs, edge/corner cases, sweeps, moving pairs, terrain seams, filters, material response, stable pair ordering and performance.
