# Structures and destructible world objects

Own stable building/bridge/shelter/facility identity, geometry/material metadata and authoritative damage/operational state. Do not make the render mesh the armor or collision truth.

Record footprint, height/levels, openings, material/layers where known, support/connection graph, collision/LOS proxies, role, source and damage mapping. State may distinguish intact, damaged, partially collapsed, destroyed, burning, repaired and abandoned. Facility functionality may fail before structural collapse.

Collision, blast/penetration, radar/optical path, navigation, infrastructure/logistics and renderer consume owner-specific representations. Validate obstruction, partial collapse, bridge/road access, facility service failure, repair and cache updates.
