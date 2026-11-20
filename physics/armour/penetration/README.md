# Penetration calculation models

**Owner:** physics/armour/penetration. Consume projectile state, impact geometry, material/layer stack and uncertainty; publish estimated penetration/residual-effect output for damage service. Do not own target component state.

Define model family/fidelity and valid ranges for projectile shape/material, velocity, obliquity, plate hardness/thickness/spacing, backing and multi-layer interaction. Keep empirical/derived equations distinct from synthetic gameplay tuning. Out-of-envelope cases return unsupported/uncertain; do not silently extrapolate as fact.

Test dimensional consistency, normal/oblique trends, velocity/material/thickness trends, layer ordering, residual energy, limiting cases and reference comparisons. No claim of exact armor penetration without validation.
