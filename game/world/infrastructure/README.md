# Infrastructure and facilities

**Status:** airfields/runways started in `game/src/world/infrastructure/Airfield.ts`: runway geometry and surface, deterministic terrain flattening under the field, line-up positions. Taxiways, parking, lighting, services, ownership and damage are not implemented.

Own roads, rail, bridges, runways, airfields, ports, depots, fuel storage, refineries, power and communications sites as stable world entities. Inventories/services are owned by logistics or system modules, not baked into terrain tiles.

Facilities declare footprint/location/elevation, route graph edges, capacity/surface, access, ownership reference, operational capability, physical/damage state, service interface, asset/source. Airfield data includes runway geometry/surface/length/heading, taxi/parking and service capability; ports include berth/depth/access.

Validate connectivity, capacity, runway/berth constraints, route damage, facility shutdown/recovery, ownership changes and save/streaming identity.
