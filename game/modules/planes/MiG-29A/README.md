# MiG-29 Product 9.13 Aircraft Module

**Status:** aircraft-specific architecture and implementation plan. This directory is the single-seat product 9.13 variant selected for Iron-Front; keep it distinct from 9.12, 9.13S, 9.13B, 9.13SE and later modernizations.

Read the [MiG-29 product 9.13 technical reference library](docs/README.md) before implementing this module. It includes flight-model, N019/RLPK-29 radar, Beryoza RWR, optical sensors/EW, RD-33 propulsion, avionics, cockpit, airframe systems, weapons/stores, source and image references.

## Module ownership

- `data/`: exact variant manifest, geometry, mass properties and provenance.
- `aerodynamics/`: 9.13-specific surface layout and aero datasets; shared solver remains in `physics/aerodynamics/`.
- `flight-controls/`: aircraft-specific control and stability-augmentation behavior.
- `propulsion/`: twin RD-33 installation and independent engine configuration; shared solver remains in `physics/propulsion/`.
- `systems/`: fuel (including the enlarged 9.13 spine tank), electrical, hydraulic, gear, brakes and environmental systems.
- `avionics/`: radar/optical/RWR equipment fit, navigation, weapon-control and display integration.
- `cockpit/`: controls, instruments, warning panels and startup procedures.
- `damage/`: aircraft-specific zones and system routing.
- `models/`: external/cockpit assets and coordinate conventions.

## Variant rules

Do not import 9.13S N019M/TWS2/R-77 or later control/avionics upgrades into plain 9.13 without evidence. Keep the RWR designation provisional until the L006LM / SPO-15LM nomenclature and exact fit are verified. Mark unknown values as unknown rather than inventing precision.

This module uses shared simulation engines. It must not contain a private rigid-body, atmosphere, aerodynamic, propulsion, radar, RWR or rendering engine.
