# F-16C Block 50 — installed aircraft systems map

**Platform baseline:** F-16C Block 50 with GE F110-GE-129, as selected in the parent aircraft package. **Status:** research and integration specification; no functional systems runtime or complete wiring/fluid topology is implemented.

These guides define the installation boundary for this exact aircraft package. They do not implement a second electrical or hydraulic solver. Read the shared owner guide for behavior, then this directory for the F-16 installation. If a technical source covers multiple blocks, engine fits or operators, its values remain provisional until the selected configuration's applicability is verified.

## Focused guides

- [Electrical generation and distribution](electrical.md)
- [Hydraulic circuits and flight-control/utility supply](hydraulics.md)
- [Pneumatic and emergency gear functions](pneumatics.md)

## Integration map

The aircraft installation must connect these domains as a causal network:
- F110 engine/accessory gearbox → installed main/standby generation and hydraulic pumps, with exact shaft/drive interfaces.
- Electrical sources → bus topology → FLCS, avionics, radar/RWR/IRST, displays, sensors, engine controls, fuel pumps, lighting, actuators/valves and warning systems.
- Hydraulic systems A/B → flight-control actuators and leading-edge flaps; System A utility branches; System B utility branches, gear/brakes/NWS and accumulator charging.
- EPU → emergency electrical generation plus emergency pump support for hydraulic System A; its bleed-air/hydrazine drive and limits are part of the emergency unit, not free power.
- Fuel system → engine and applicable accessory/EPU consumables; changing fuel state affects mass properties.
- Cooling/fuel heat exchange → hydraulic thermal state and connected engine/equipment cooling.
- Pneumatic emergency gear extension → its own emergency path; do not model it as restoration of System B.

## Required platform package data

For each equipment/system item include stable component ID, manufacturer/type when known, installation station/zone, exact variant applicability, power/fluid/gas interface, capacity/rating, control/feedback wiring, damage route, maintenance/servicing state, cockpit control/indication mapping, source document/page/revision and confidence.

Required records include generator and drive source details; bus/branch single-line diagram; contactors and protection; battery and FLCS dedicated power branches; pump models, reservoirs, circuit/return-line diagram and pressure/flow characteristics; accumulator type/precharge; actuator port map; EPU source/trigger/outputs/endurance; emergency gear deployment sequence; and load-shed priorities.

## Source documents and applicability

- [HAF T.O. GR1F16CJ1 — F-16C/D Flight Manual, Blocks 50 and 52+](https://studylib.net/doc/26036763/block-50), dated 15 October 2002, Change 1 dated 15 June 2003. This is an online mirror, not a repository-owned controlled publication.
- The cited manual describes a two-system 3000-psi hydraulic installation, A/B consumer split, FLCS accumulators, brake/JFS accumulators, pneumatic landing-gear extension and an EPU that supplies emergency electricity and System A hydraulic pressure. It is a strong architecture reference, but it spans Blocks 50/52+ and must not automatically be treated as exact proof of every value or accessory detail for the selected GE-powered Block 50.
- Verify exact applicability against the aircraft's engine fit, operator configuration and source revision before making ratings, wiring, pump part numbers or load tables authoritative.

No system rating or bus assignment should be silently inherited from an F-16A, Block 40/42, Block 52, export modification or later modernization.
