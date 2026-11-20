# Vehicle-terrain interaction

**Owner:** physics/ground-mobility/terrain-interaction. Consume terrain surface/material/slope/roughness/moisture and vehicle contact loads to estimate mobility resistance, sinkage/bogging/obstacle interaction at the declared fidelity.

Separate terrain truth (game/world) from mobility interaction equation. Do not edit terrain or world position. Outputs are contact force/resistance, sinkage/traction limit, obstacle state and uncertainty. Water/fording needs explicit depth/current/sealing limits; do not infer from render texture.

Validate slope/grade, soil class trends, moisture, rut/bog behavior, obstacle crossing, water depth and surface transitions.
