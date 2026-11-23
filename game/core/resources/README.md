# Shared resource arbitration

**Owner:** game/core/resources for arbitration/grant contracts. Physical network state stays in game/systems. **Status:** per-tick arbitration implemented in `game/src/core/resources/ResourceArbiter.ts` (tests: `game/tests/unit/ResourceArbiter.test.ts`). Not yet implemented: quality-of-supply matching, reservations held across ticks, starvation-avoidance aging, and wiring into the scheduler's `lifecycle-resources` phase by real systems.

## Implemented policy
- `allocateResources({ tick, networks, offers, demands })` is a pure function, and input order never changes its result.
- Each network declares a typed family and a unit. An offer or demand with a different unit, an unknown network, a duplicate, a negative/non-finite amount, `minimum > desired` or a bad validity interval is rejected. All problems are listed together.
- Usable capacity is the sum of offers valid at `tick`. Stale and not-yet-valid offers are listed with a reason.
- Minimums are granted all-or-nothing in priority order (lower number first, then consumer id). A minimum that doesn't fit is denied with a reason. A smaller, lower-priority minimum can still be served afterwards.
- Remaining capacity tops up toward `desired` priority by priority. Within one priority it is split in proportion to each consumer's outstanding need.
- Every grant reports `granted`, `unmet`, `status` (`full`/`partial`/`denied`), a reason and per-provider `sources`. Total grants never exceed valid capacity.
- Networks are isolated. Provider loss and recovery show up in the next tick's offers.

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
