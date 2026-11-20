# Ricochet and projectile deflection

**Owner:** physics/armour/ricochet. Evaluate whether an impact continues, penetrates, deflects or ricochets using impact angle, projectile attitude/shape, velocity, material, surface normal and model envelope.

Output direction/velocity/energy change and uncertainty for the subsequent ballistic/damage step. Do not use a single universal angle threshold unless explicitly marked as a coarse gameplay approximation. Preserve probability/uncertainty where empirical data supports it.

Test grazing/normal impacts, angle transitions, material changes, projectile nose/attitude assumptions, energy/direction bounds and reproducible Monte Carlo cases.
