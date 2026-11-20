# Rocket motor models

**Owner:** physics/propulsion/rocket-motors. **Status:** architecture only; no general rocket-motor runtime is implemented.

Own reusable motor-family behavior and interfaces. Weapon content supplies exact motor configuration, propellant/product fit, dry/loaded mass, nozzle geometry, ignition device, thrust-time data, stage/booster arrangement, limits and provenance. Weapon lifecycle owns stored/armed/released/failed/terminal state.

## Inputs and outputs
Inputs include ignition/start request, ambient state, motor temperature/health, feed/command state where applicable and configuration. Outputs include time-dependent thrust vector, mass flow, remaining motor mass/propellant, chamber/combustion pressure and temperature, nozzle state, plume/thermal signature and faults at declared fidelity.

## Model distinctions
Solid motors use burn/pressure/grain geometry approximations and may be non-throttleable; liquid motors require feed/valve/tank interface and start/stop control; hybrid/staged motors need explicit phase transitions. Do not treat all motors as a fixed constant-thrust impulse. Nozzle/installation alignment and atmospheric pressure may affect thrust.

## Failure and validation
Support ignition failure, abnormal burn, case/nozzle damage, pressure/temperature limit, extinction where applicable and thrust asymmetry only where modeled. Validate integrated impulse, mass depletion, burn duration, transient, ambient effects, staging, failure state and replay against source/uncertainty.
