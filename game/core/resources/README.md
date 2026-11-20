# Shared resource arbitration

**Owner:** game/core/resources for arbitration/grant contracts. Physical network state stays in game/systems. **Status:** specification only.

## Responsibility
Coordinate scarce resource offers and demands without owning the physics of electrical, hydraulic, fuel, coolant, oxygen, ammunition or data networks.

## Typed families
Keep power/voltage/current/energy distinct from hydraulic pressure/flow, fuel mass/flow/pressure, coolant capacity/temperature, oxygen, ammunition inventory and communication quality. A display percentage/boolean is derived only.

## Contracts
Provider offers type, capacity, quality, availability, limits, source and validity interval. Consumer declares demand curve, priority, minimum viable grant, desired grant, acceptable quality and degraded behavior. Result includes granted amount/quality, unmet demand, source and reason.

## Arbitration and failure
Define stable priority/fairness, capacity conservation, reservation/expiry and update phase. Model partial shortage, provider failure, stale offer, consumer disconnect, overload and recovery. Network inertia/pressure decay/voltage dynamics remain in the owning physical system.

## Tests
Conservation, deterministic order, priorities, starvation policy, minimum grant, provider loss, recovery, stale offers and isolation of unrelated networks.
