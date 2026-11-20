# radar — aircraft installation

F-16C Block 50 radar fit and installation data for the selected APG-68(V)5 baseline: antenna geometry, modes/configuration, avionics interfaces, resource connections and evidence. Shared radar simulation remains in sensors/Radar and physics/radar.

## Ownership rules
- This folder contains only this aircraft variant's fit, installation and integration data.
- Shared sensor/weapon/physics engines must not be copied into the aircraft module.
- Use versioned configuration schemas and explicit hardware/software revisions.
- Record source, page/table, date, applicability, confidence and uncertainty for every technical value.
- Do not silently inherit equipment from a related block or variant.
- Publish and consume typed interfaces for power, cooling, controls, avionics, damage and cockpit outputs.

**Status:** Aircraft-specific architecture only; no functioning installation code is implied.
