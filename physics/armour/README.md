# Armour interaction and terminal effects

**Owner:** physics/armour. **Status:** architecture only; no penetration/terminal solver exists.

Evaluate impact geometry and projectile/warhead interaction with a platform-supplied material/layer map. Inputs include impact location, velocity/energy, obliquity, projectile attitude, target normal, layer material/thickness/spacing and uncertainty. Outputs are structured penetration/residual-effect reports for shared damage service; this system does not own vehicle health, crew state or campaign casualty records.

Separate penetration, non-penetrating damage, ricochet/deflection, projectile breakup, residual energy, spall/behind-armour effects and blast/fragmentation where supported. Each approximation tier states omissions and validity. Armor data must not be invented or made universal for an entire vehicle.

Tests cover obliquity/material trends, layer order, energy accounting, residual effects, ricochet boundary, internal component exposure, uncertainty and sourced reference conditions.
