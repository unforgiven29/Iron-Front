# Damage state, propagation and repair interfaces

**Owner:** game/systems/damage for generic component damage state/orchestration. physics/armour and ballistics evaluate impacts; platform packages define zones/routing; crew and campaign own their records. **Status:** architecture only.

An impact/effect report is not a vehicle-wide health percentage. Use platform geometry to map location/effect to structural zones, components, lines, buses, controls, sensors, crew spaces and fuel/ammunition. Track component health/degradation, functional state, damage type/severity, location/time, repairability, leak/fire/short/structural state and uncertainty.

Propagate only through connected dependency paths: hydraulic leak reduces supplied actuators; bus damage affects connected consumers; fuel leak affects inventory/feed/fire risk; sensor aperture damage changes pattern/coverage; structure/control-surface damage alters aero. Do not disable unrelated components.

Repair consumes time, skill, spare parts, tools, safe conditions and maintenance policy. Partial field repair may restore limited capability but not original calibration/strength.

Validate zone mapping, connected-only cascades, fault isolation, leaks/fire, repair eligibility/partial repair, uncertainty and save/replay.
