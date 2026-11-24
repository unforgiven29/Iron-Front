# systems/fuel

Owner of fuel-tank physics: tank contents, capacity-limited transfers, engine draw from feed
tanks, and each tank's contribution to mass, CG and inertia (point masses at tank centroids).

Each aircraft package supplies its OWN `FuelSystemModel` (tanks, pumps, valves, transfer
sequence, warnings) built on `TankSet`:

- F-16: `platforms/aircraft/f16c-block50/F16FuelSystem.ts` (secondary-reported tank layout, fwd/aft balancing).
- MiG-29: `platforms/aircraft/mig29/MiG29FuelSystem.ts` (GAF T.O. 1F-MIG29-1 tank capacities and transfer sequence).

The runtime (`FixedWingAircraft`) uses the package model when `AircraftDefinition.createFuelSystem`
exists: mass = zero-fuel mass + tanks; CG = zero-fuel CG (`mass.cgFractionMac`) shifted by the
fuel moment over `mass.macM`; inertia = zero-fuel inertia + fuel point masses about the new CG.

Not modelled: slosh and attitude-dependent fuel centroids, negative-g accumulators, external
tanks on the F-16, air refuelling, fuel temperature, and moving the gear/thrust reference points
with the CG (only the aerodynamic moment reference and inertia follow it).
