# Electrical generation, distribution and loads

**Owner:** game/systems/electrical. **Status:** architecture only; no network solver.

Platform packages provide generators, batteries, buses, breakers, contactors, converters, wiring topology and consumer connections. This system owns electrical state and distribution; core/resources arbitrates typed offers/demands; consumers own their response.

Track voltage/current/power/energy, source state, bus topology, line loss/resistance where supported, transient response, protection and thermal constraints. Do not replace electrical behavior with a powered boolean. Loads include engine controls, avionics, radar, RWR, displays, pumps, actuators, lights and environmental systems. Each declares demand, priority and minimum viable supply.

Failures: generator trip, battery depletion, bus short, breaker trip, converter failure, wiring damage, overload and intermittent connection. Backup/source transfer is platform-specific; never invent universal redundancy. Publish bus/source state, actual delivered/denied loads, faults and reason.

Validate load/capacity accounting, voltage sag, source transfer, battery discharge, breaker trip/reset, essential load priority, connected-only fault propagation and topology-specific redundancy.
