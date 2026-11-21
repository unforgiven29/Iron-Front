# Structures and destructible world objects

Own stable building/bridge/shelter/facility identity, geometry/material metadata and authoritative damage/operational state. Do not make the render mesh the armour or collision truth.

## Building definition and interiors
Record footprint, height/storeys, openings, materials/layers where known, load-bearing support/connection graph, collision/LOS proxies, role, source and damage mapping. Buildings may be houses, apartment blocks, offices, warehouses, factories, hangars, terminals, churches, public buildings or industrial structures. Interior layouts define rooms, floors, stairs, corridors, doors, windows, access points, furnishings/obstacles and navigation/visibility links. Interior detail is streamed and may be simplified outside relevant gameplay areas without deleting authoritative occupancy or damage.

## Damage and collapse
State may distinguish intact, damaged, breached, partially collapsed, destroyed, burning, repaired and abandoned. Track structural sections/supports and openings when the selected fidelity requires it. Blast, penetration, direct fire, artillery, demolition and fire propagation use shared physical/effect services. A local wall breach updates collision, cover, LOS, navigation and interior access; a collapse can create debris/rubble, blocked routes and occupant hazards. Facility functionality may fail before structural collapse.

Do not let every wall be an independent full building rigid body. Use stable structural zones and bounded debris proxies; renderer chunks are derived from the structural state. A building's destruction must not erase people or other entities inside it—resolve exposure, injury, entrapment/evacuation and casualty reports through their owners.

## Fortifications and field works
Represent trenches, zig-zag trench lines, sandbag positions, fighting pits, dugouts, bunkers, firing slits, strongpoints, command posts and defensive obstacles as world structures with material, cover, access, occupancy, communications and damage state. Engineers create/repair them through time/resource-consuming commands. Capturing or destroying a command post may disrupt a formation's command network only through the communications/command graph, not via a global AI switch.

## Cross-system propagation
Collision, blast/penetration, radar/optical path, navigation, infrastructure/logistics and renderer consume owner-specific representations. Terrain/vegetation may modify structure access and cover. Test obstruction, partial collapse, bridge/road access, facility service failure, interior traversal, line-of-sight changes, fire, occupants inside, repair and cache updates.
