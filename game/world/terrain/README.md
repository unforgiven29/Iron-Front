# Terrain data and physical surface queries

Terrain tiles declare stable ID, coordinate reference/geodetic origin, horizontal resolution, vertical datum/units, elevation source/quality, no-data policy, material, slope, roughness, friction/soil data and version. Keep measured source and procedural/synthetic content distinct.

Derive separate render mesh, collision heightfield, mobility surface query, LOS/propagation and navigation cost representations from one versioned source. Return validity/source with elevation, normal, slope and surface samples. Unknown terrain must not silently become flat ground.

Validate source checkpoints, tile seams, datum, normals/slope, missing tile, render/physics proxy alignment, mobility/LOS behavior and streaming boundary.
