# weapons — aircraft installation

F-16 station layout, pylon/launcher compatibility, wiring, stores clearance and variant restrictions. Weapon physics and weapon definitions remain shared.

## Ownership rules
- This folder contains only this aircraft variant's fit, installation and integration data.
- Shared sensor/weapon/physics engines must not be copied into the aircraft module.
- Use versioned configuration schemas and explicit hardware/software revisions.
- Record source, page/table, date, applicability, confidence and uncertainty for every technical value.
- Do not silently inherit equipment from a related block or variant.
- Publish and consume typed interfaces for power, cooling, controls, avionics, damage and cockpit outputs.

**Status:** Aircraft-specific architecture only; no functioning installation code is implied.
