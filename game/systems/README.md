# Shared platform systems

**Owner:** game/systems. **Status:** architecture folders only; full aircraft/vehicle system runtimes are not implemented.

These systems are reusable physical network behavior and resource adapters. Aircraft, vehicle and ship packages provide exact installation topology, wiring, equipment, component locations, controls and limits. Core resource arbitration remains in game/core/resources. Physical engine behavior remains in physics; cockpit displays remain in graphics/graphics-engine.

## Canonical subowners
- **electrical:** generation, drives, batteries, converters, buses, wiring, protection, load behavior and electrical faults.
- **hydraulics:** pumps, reservoirs, accumulators, circuits, pressure, flow, actuators and leaks.
- **pneumatics:** gas bottles, compressors/charging where fitted, regulators, lines, pressure, emergency gas consumers and isolation.
- **fuel:** tanks, feed/transfer, pumps, valves, quantity, leaks and mass-property outputs.
- **cooling:** coolant/air loops, pumps/fans, heat exchangers and delivered cooling capacity.
- **damage:** generic component damage propagation/repair interfaces over platform-supplied zones/routes.
- **communications:** radio/intercom/datalink transport quality and delivery.
- **navigation:** fitted navigation equipment interfaces and uncertain estimates.
- **fire-control:** reusable aiming/release solution interfaces; sensors/weapon execution remain separate.
- **crew:** crew stations, workload, injury/incapacitation and human action interfaces.

## Shared network patterns

Each network owns its physical/runtime state and publishes typed offers, demands, actual delivery, snapshots and fault events. Core/resources arbitrates scarce shared resource capacity but does not own bus voltage, hydraulic pressure, gas inventory, fuel tank geometry or coolant flow. Commands are validated by the owner; committed state changes publish events; UI consumes immutable snapshots.

An aircraft installation is a component graph, not a list of powered/working booleans. Model sources, converters, buses/circuits, branches, loads, protective/isolation devices, sensors and actuators as connected components with stable IDs. A component failure propagates only along connected paths unless a documented common-mode failure exists.

## Cross-system causality

- Electrical source/drive state affects buses, and bus voltage/frequency/power quality affects connected consumers. Battery and emergency sources have finite capacity and exact load-shed limits.
- Hydraulic pump drive may depend on engine/APU/EPU torque; an electric pump consumes electrical power. Hydraulic pressure/flow affects actuator authority and rate, not just whether a device is enabled.
- Pneumatic pressure and gas inventory may operate brakes/gear/canopy or pressurize a hydraulic reservoir through a regulator. Gas and hydraulic fluid remain separately conserved.
- Fuel feed may power engines/APUs/emergency units and fuel heat exchange may cool installed hydraulic/equipment circuits; these links must be explicit.
- Cooling flow/heat rejection changes connected equipment temperature and derating; electrical loss can stop electrically driven cooling pumps/fans.
- Damage follows actual wiring, fluid lines, gas plumbing, tanks and installed component locations. A cockpit indication can fail independently of the underlying physical system if its electrical supply/sensor path is lost.
- Communications quality changes report delivery; navigation quality changes estimate uncertainty; crew availability/workload affects tasks.

## Platform installation and backup rules

Each aircraft has its own systems configuration/dossier. Shared solvers do not imply shared generators, batteries, bus architecture, circuit count, pumps, reservoirs, pressure ratings, accumulator types, fluids, gas bottles, crossfeeds, consumers or emergency procedures.

Backups are alternate physical paths with prerequisites, activation delay, capacity, endurance, load/consumer restrictions, degraded performance and common failure points. An accumulator is not a pump; an emergency gear extension is not restored hydraulic service; an emergency generator is not unlimited power. Never invent redundancy to make an aircraft resilient. If the exact installation is unknown, mark it unknown/provisional rather than substituting another aircraft's design.

## Implementation rule

Do not implement all platform systems as one global PlatformSystems class. Build one typed network vertical slice at a time, prove source/consumer behavior, partial failure, isolation, transfer, recovery and replay, then compose exact aircraft topology. All physical quantities carry units, validity, exact applicability, source/provenance and uncertainty.
