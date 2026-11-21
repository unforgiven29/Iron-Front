# Subsurface warfare and maritime operations

**Owner:** game/modules/naval-units/subsurface-and-maritime-operations. **Status:** architecture only; no naval campaign or submarine runtime exists.

Own maritime mission/formation composition and submarine platform integration policies. Ship and submarine physical variants remain in naval-units/ships; underwater motion, water/bathymetry, sensor and weapon mechanisms use shared owners.

## Subsurface platforms
A submarine variant declares hull/displacement, depth limits, buoyancy/trim, propulsion, battery/energy or reactor installation, mast/periscope/sensor apertures, acoustic/radar/communications fit, torpedo/anti-ship/land-attack stores, crew and damage compartments. Submerged navigation and detectability must use supported water/acoustic/sensor models; no global omniscient submarine markers. Snorkel/periscope/mast states and communications constraints are explicit.

## Maritime operations
Represent surface groups, carrier task groups, escorts, submarines, amphibious ships and auxiliaries/merchant convoys as distinct entity types. Mission roles include sea control, escort, patrol, blockade, anti-submarine search, strike, replenishment, convoy routing, amphibious approach/landing and port access. Sea control and blockade are derived from forces, sensor knowledge, geography, readiness, losses and logistics—not one static ownership flag.

## Campaign coupling
Naval losses affect crew fate, trade, imports, fuel/food supply, coastal reinforcement and port throughput. Convoy movement uses sea routes/time, escort and weather; interdiction/attack creates shipment losses and insurance/market/diplomatic consequences. Carrier aircraft handling belongs to carrier-operations; launch/recovery is never a teleport.

## Validation
Submerged/ surfaced transitions; depth/trim/power; acoustic contact uncertainty; weapon release; mast exposure; comms loss; escort/convoy routing; blockade/port capacity; amphibious delivery; carrier cycle integration; crew/cargo accounting and campaign save/replay.
