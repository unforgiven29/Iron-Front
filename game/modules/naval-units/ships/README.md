# Ship class and variant packages

A ship package owns exact hull class/variant, dimensions, displacement/draft, mass/CG/inertia, compartment layout, propulsion/shaft/rudder/propeller installation, electrical/fuel/cooling topology, crew stations, sensors/antennas, weapon mounts, magazines, communications, damage-control map, boat/aircraft interfaces and source/asset metadata.

Shared physics/services calculate body motion, propulsion, collision, water/sea interaction at supported fidelity, weapons, sensors and damage. Platform config supplies fit and topology. Do not make ship movement a renderer animation or treat hull compartments as generic hit points.

Validate turning/stop/draft, loading, propulsion/shaft/rudder failure, flooding/fire isolation, electrical distribution, sensor arcs, weapon compatibility, crew and port/grounding behavior.
