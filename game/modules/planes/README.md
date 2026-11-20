# Aircraft platform modules

**Owner:** game/modules/planes for aircraft-specific definition, configuration, installation and adapters. Shared physics/sensor/system engines remain outside platform folders.

## Package responsibility
A package describes an exact aircraft configuration: variant/block/operator/software baseline; geometry and mass distribution; aerodynamic surfaces/data; flight-control laws/actuators; engine installation; fuel/electrical/hydraulic/cooling topology; landing gear/brakes; sensors/avionics; hardpoints/stores; damage routes; crew/escape; cockpit control/display map; assets and provenance.

Not every aircraft has every system. Absence is explicit. A family selection must resolve to an exact variant before detailed simulation.

## Required integration sequence
Freeze baseline → validate geometry/mass/datum → add aero surfaces/data → control law/actuator path → engine/installation → resources and failure topology → gear/brakes/stores/damage → exact sensor/avionics fit → cockpit commands and snapshot indications → assets/animations → validation scenarios.

Platform code supplies configuration/data/adapters. It does not contain private rigid-body, aerodynamics, propulsion, radar, RWR, ballistics or damage solvers. The F-16C Block 50 is first vertical slice; MiG-29 product 9.13 proves materially different composition without shared name branches.
