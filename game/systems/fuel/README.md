# Fuel storage, transfer and engine feed

**Owner:** game/systems/fuel. **Status:** architecture only; no fuel network runtime.

Own tanks/cells, quantity, pumps, valves, selectors, transfer, venting, feed lines, pressure, leakage, refueling and engine feed. Platform packages supply geometry, tank capacity/location, usable/unusable quantity, feed topology, transfer paths and pump/valve installation.

Fuel mass is authoritative; volume/indication is derived with density/temperature assumptions. Track line/pump/valve state, pressure/flow and tank damage. Fuel burn/transfer changes mass, CG and inertia and publishes a mass-properties contribution at a defined phase. Asymmetric tank use matters.

Engines request flow/pressure and receive actual delivery; engine does not own tank inventory. Feed interruption only causes engine response according to its model. Leak/fire effects connect to damage/thermal/fire interfaces.

Validate conservation, burn/transfer, mass/CG/inertia, asymmetric feed, pressure loss, pump/valve fault, leak/isolation, refuel, indication and save/restore.
