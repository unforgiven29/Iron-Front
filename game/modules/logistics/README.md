# Logistics and sustainment

**Owner:** game/modules/logistics. **Status:** architecture only; no supply/economy runtime.

Model production, storage, transport, distribution, consumption and repair support across bases, depots, airfields, ports, factories and forward units. Use typed resources (fuel grade, ammunition/product, spare parts, food/water/medical, batteries, personnel, repair capacity and civilian essentials), not one generic supply percentage.

## Flow and conservation
Demand/order → reserve stock → assign transport → move with route capacity/time/hazards → receive/verify → update inventory → grant to consumer. Account for loss, delay, damage, interdiction, diversion, capture, spoilage and failure; do not teleport/replenish resources without a production, delivery or recovery event.

For each commodity maintain a reconciled balance: opening stock + production/imports = depot/base/field/vehicle/transit stock + consumption + loss + capture/export, with in-transit/on-board allocations counted exactly once. Fuel system owns tank/feed; weapons/platform own ammunition use; logistics replenishes through explicit interfaces. Repair consumes parts/time/workforce and may be limited by tools, skill, facility condition or safety.

## Transport and infrastructure
Road, rail, river/bridge, port and sea-lane edges have capacity, speed, access, damage and ownership/contestation. Convoys receive route, cargo, escort, schedule, priority and status; an attack or route closure changes delivery probability/time and cargo survival rather than directly subtracting stock at the destination. Bridges, depots, refineries, power plants, ports and airfields can be damaged, repaired, captured or shut down. World owns their physical entities; logistics owns flow and inventories.

## National economy and trade
Campaign may model production capacity, industrial facilities, workforce, energy, fuel, food, transport, imports/exports, trade partners, sanctions, market disruption, budgets, bonds/taxes/debt or other policy abstractions. Keep the model at a declared strategic fidelity; economic outputs influence production, maintenance, civilian services and mobilisation only through documented interfaces. A blockade affects trade and import routes through maritime state, not a universal economic multiplier.

## Validation
Conservation/audit; capacity; route disruption; contested nodes; failed/delayed deliveries; convoy loss/diversion; stock capture; production limits; trade/sanctions/blockade effects; rearm/repair times; campaign days; no duplicate stock counting; save/load.
