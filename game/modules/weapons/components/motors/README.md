# Weapon motor component definitions

**Owner:** weapon motor product profiles. Shared motor dynamics live in physics/propulsion; weapon lifecycle owns when the motor starts/stops and when a stage separates. **Status:** architecture only.

## Motor families and modes

Represent the actual fitted propulsion family, not one generic missile thrust curve. Possible categories include solid rocket, liquid rocket, boost-sustain, dual-pulse/pulse-controlled solid rocket, air-breathing turbojet/ramjet/ducted-rocket and other documented systems. A weapon may use multiple stages or motors with independent state.

## Product configuration

Each motor/stage records stable ID; family; propellant/energy and usable mass; dry/wet mass and CG contribution; thrust-time or supported operating map; burn duration and ignition delay; thrust direction/alignment; nozzle geometry/expansion and installation reference; mass-flow/propellant-consumption model; stage/ignition logic; pressure/temperature limits; plume/signature/thermal output; inlet/air requirement for air-breathing systems; start/stop/restart restrictions; and variant-specific provenance.

A thrust-time curve is an input dataset, not a complete trajectory model. It must state units, test/ambient conditions, installation, altitude/Mach validity and uncertainty.

## Runtime state and coupling

Track safe/armed ignition state, ignition transient, chamber/combustion state at the declared fidelity, propellant remaining, mass flow, thrust, nozzle state, temperature/pressure/health, stage transitions and failure. Propellant depletion changes weapon mass, CG and inertia through the vehicle model. Motor thrust is applied at its actual installation point/direction, creating moments when offset.

## Failure and degradation

Model ignition failure/delay, partial ignition, extinguishment where applicable, thrust loss, stage separation failure, nozzle/actuator failure, propellant/pressure fault, thermal damage and asymmetric motor behavior where installed. Do not treat a damaged motor as an arbitrary reduced missile speed.

## Validation

Check integrated impulse, thrust-time curve interpolation, propellant mass conservation, ignition delay, boost/sustain/dual-pulse sequence, staging, mass/CG shift, altitude/Mach trends within evidence envelope, thermal output, failure cases and deterministic replay. Unknown motor details stay unknown rather than receiving plausible-looking curves.
