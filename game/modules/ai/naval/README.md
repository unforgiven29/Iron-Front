# Naval-domain AI behaviors

Own ship task/maneuver policy: route navigation, formation/station keeping, patrol, screen/escort, search, threat response, replenishment and carrier flight-deck coordination. Ship dynamics, propulsion, sensors, weapons and sea/water physics are separate owners.

Use radar/ESM/EO/datalink/visual reports and orders, preserving latency/uncertainty. Never access true submarine/aircraft positions. Vessel motion follows actual propulsion, water and rigid-body contracts; AI emits intent only.

Test formation, sensor/link loss, damage-limited steering/propulsion, replenishment constraints, port/grounding hazards and uncertain contacts.
