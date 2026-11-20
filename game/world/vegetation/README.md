# Vegetation, biome and foliage

Own vegetation type/placement/density/season and physical/visibility proxies; renderer owns meshes and LOD. Profiles include species/type, height/canopy/ground cover distribution, density, season, moisture/fuel where used, collision/occlusion and provenance.

Model mobility obstruction, collision proxies, optical occlusion/transmission and sensor path effects only through appropriate physics interfaces. A tree is not universally opaque or identical. Deterministic placement derives from scenario seed, tile and generator version. Render LOD may simplify visuals but cannot remove physical/visibility representation outside declared tolerance.

Validate biome transitions, density/path effects, mobility passage, collision proxy coverage, seasonal state, deterministic placement and dense-forest performance.
