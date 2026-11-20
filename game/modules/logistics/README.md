# Logistics and sustainment

**Owner:** game/modules/logistics. **Status:** architecture only; no supply/economy runtime.

Model production, storage, transport, distribution, consumption and repair support across bases, depots, airfields, ports and forward units. Use typed resources (fuel grade, ammunition type, spare parts, food/water/medical, personnel, repair capacity), not one generic supply percentage.

Flow: demand/order → reserve stock → assign transport → move with route capacity/time/hazards → receive/verify → update inventory → grant to consumer. Account for loss, delay, damage, interdiction, diversion, spoilage and failure; do not teleport/replenish resources without an event and source.

Fuel system owns tank/feed; weapons/platform own ammunition use; logistics replenishes through explicit interfaces. Repair consumes parts/time/workforce. Infrastructure condition/ownership/frontline affects supply graph. Validate conservation, capacity, route disruption, contested nodes, failed deliveries, rearm/repair time, campaign days and save/load.
