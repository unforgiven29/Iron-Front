# MiG-29 product 9.13 — aircraft integration package

**Internal identity:** single-seat product 9.13. Folder/display label MiG-29A must not cause 9.12, 9.13S, 9.13B, 9.13SE or later modernization data to be merged. **Status:** research/architecture only; no functional aircraft.

## Baseline discipline

Product 9.13 is the enlarged-spine aircraft selected for the second-platform proof. Do not import 9.13S N019M/TWS2/R-77 or later upgrades into plain 9.13 without evidence. DCS 9-12 material is contextual, not an exact plain-9.13 manual. Beryoza RWR designation/fit remains provisional where sources conflict.

## Package owns

Exact geometry/mass/CG/inertia including spine fuel; surface/aero data; control/stability augmentation and actuators; twin RD-33 installations; fuel/feed/transfer topology; electrical/hydraulic/pneumatic/cooling and auxiliary system topology; gear/brakes; confirmed N019/RLPK-29 fit; provisional/confirmed RWR and optical equipment; avionics/cockpit/weapon-control; stores/hardpoints; damage routing, assets and sources.

## Aircraft systems dossier

Read [the MiG-29 systems index](systems/README.md) and its focused [electrical](systems/electrical.md), [hydraulic](systems/hydraulics.md), [pneumatic](systems/pneumatics.md) and [auxiliary/environmental](systems/auxiliary-environmental.md) guides. The GAF T.O. 1F-MIG29-1 is a useful installation reference, but its exact applicability to selected product 9.13 is not established. Treat transferred values and topology as provisional until confirmed by exact 9.13 documentation.

## Architecture proof

Use the same shared rigidbody, aero, atmosphere, propulsion, electrical/hydraulic/pneumatic/fuel/cooling, radar, RWR, optics, damage and presentation services. Package provides two engine installations and exact equipment adapters. Do not copy F-16 solvers or add MiG name branches to shared engines. The source-described electrical and hydraulic architectures are materially different from the selected F-16 reference and should remain different.

## Acceptance

The second-platform systems suite is [MiG-29 product 9.13 systems architecture](../../../tests/acceptance/MiG-29-platform-systems.md). It verifies that the different electrical, hydraulic, pneumatic and auxiliary configuration uses the same shared contracts without borrowing F-16 architecture.

Demonstrate materially different geometry, engine installation, control response, electrical sources/buses, hydraulic chambers/circuits, emergency systems, sensor/cockpit composition and failure behavior using identical shared contracts. All disputed values remain visible as unknown/provisional with provenance.
