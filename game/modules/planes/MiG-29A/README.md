# MiG-29 product 9.13 — aircraft integration package

**Internal identity:** single-seat product 9.13. Folder/display label MiG-29A must not cause 9.12, 9.13S, 9.13B, 9.13SE or later modernization data to be merged. **Status:** research/architecture only; no functional aircraft.

## Baseline discipline
Product 9.13 is the enlarged-spine aircraft selected for the second-platform proof. Do not import 9.13S N019M/TWS2/R-77 or later upgrades into plain 9.13 without evidence. DCS 9-12 material is contextual, not an exact plain-9.13 manual. Beryoza RWR designation/fit remains provisional where sources conflict.

## Package owns
Exact geometry/mass/CG/inertia including spine fuel; surface/aero data; control/stability augmentation and actuators; twin RD-33 installations; fuel/feed/transfer topology; electrical/hydraulic/cooling; gear/brakes; confirmed N019/RLPK-29 fit; provisional/confirmed RWR and optical equipment; avionics/cockpit/weapon-control; stores/hardpoints; damage routing, assets and sources.

## Architecture proof
Use the same shared rigidbody, aero, atmosphere, propulsion, systems, radar, RWR, optics, damage and presentation services. Package provides two engine installations and exact equipment adapters. Do not copy F-16 solvers or add MiG name branches to shared engines.

## Acceptance
Demonstrate materially different geometry, engine installation, control response, sensor/cockpit composition and failure behavior using identical shared contracts. All disputed values remain visible as unknown/provisional with provenance.
