# Shared platform systems

**Owner:** game/systems. **Status:** architecture folders only; full aircraft/vehicle system runtimes are not implemented.

These systems are reusable platform behavior and resource-network adapters. Aircraft/vehicle/ship packages provide exact installation topology, wiring, equipment, component locations, controls and limits. Core resource arbitration remains in game/core/resources. Physical engine behavior remains in physics; cockpit displays remain in graphics/UI.

## Canonical subowners
- electrical: generators, batteries, converters, buses, protection, loads and electrical faults.
- hydraulics: pumps, reservoirs, accumulators, circuits, pressure, flow and leaks.
- fuel: tanks, feed/transfer, pumps, valves, quantity, leaks and mass-property outputs.
- cooling: coolant/air loops, pumps/fans, heat exchangers and delivered cooling capacity.
- damage: generic component damage propagation/repair interfaces over platform-supplied zones/routes.
- communications: radio/intercom/datalink transport quality and delivery.
- navigation: fitted navigation equipment interfaces and uncertain estimates.
- fire-control: reusable aiming/release solution interfaces; sensors/weapon execution remain separate.
- crew: crew stations, workload, injury/incapacitation and human action interfaces.

## Shared patterns
Each network owns its physical/runtime state and publishes typed offers, demands, grants, snapshots and fault events. Core/resources arbitrates scarce resources but does not own bus voltage, hydraulic pressure, fuel tank geometry or coolant flow. Commands are validated by the owner; committed state changes publish events; UI consumes snapshots.

## Causal integration
Electrical supply changes connected equipment availability. Hydraulic pressure changes connected actuator/gear/brake authority. Fuel burn/transfer changes inventory, feed and mass properties. Cooling failure affects connected thermal loads. Damage follows explicit lines/buses/circuits. Communications quality changes report delivery; navigation quality changes estimate uncertainty; crew availability/workload affects tasks.

## Implementation rule
Do not implement all platform systems as one global PlatformSystems class. Build one typed resource/network vertical slice at a time, prove partial failure/recovery and then compose exact platform topology. Unknown redundancy/topology stays explicit rather than guessed.
