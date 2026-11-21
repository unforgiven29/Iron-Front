# Rotorcraft platform modules

**Owner:** game/modules/rotorcraft. **Status:** platform architecture only; no helicopter runtime is implemented.

Describe exact helicopter/tiltrotor/autogyro variants and installations. Shared rotor aerodynamics live in physics/rotorcraft; rigid-body motion, propulsion, damage, sensors, weapons, crew, resources and presentation stay with their canonical owners.

## Platform definition
A variant package records main/tail/auxiliary rotor count and geometry; hub/blade and control arrangement; rotor inertia and rpm limits; swashplate, pitch links and actuators; gearbox/transmission/clutch/freewheel; engine/APU and drivetrain interfaces; anti-torque arrangement; landing gear/skids; mass/CG/inertia and loading envelope; fuel; electrical/hydraulic/pneumatic/cooling topology; cockpit/control mapping; crew stations; sensors, sighting systems, weapons/stores; damage zones; startup/shutdown and emergency/autorotation procedures; assets and source applicability.

No universal helicopter flight model or name-specific shared-solver branch. AH-64-family, Ka-50-family, transport and utility helicopters may have materially different rotor, drivetrain, cockpit, sensor and weapons installations.

## Operating behavior
Support ground handling, rotor start/engagement, rotor rpm management, governor limits, hover, hover taxi, forward/sideward/backward flight, climb/descent, landing, sling/transport payload where fitted, formation, nap-of-earth as an AI policy profile, and emergency procedures. Realistic startup and failure sequences are stateful procedures, not a single "engine on" boolean.

## Integration
Rotorcraft AI uses the same observation/order contracts as other aircraft, with hover/landing/terrain-clearance, route, escort, transport, CSAR and attack task policies. Crew and cabin capacity constrain embark/disembark and casualty transport. Turret/sight/helmet-cue controls command installed equipment; they do not bypass sensor or weapon limits.

## Validation
Exact-variant source audit; hover/transition/landing; rotor/transmission/engine coupling; autorotation where supported; rotor/gearbox/control damage; hydraulic/electrical backup; startup and emergency procedures; sling/load CG changes; crew/passenger capacity; weapon/sensor integration; deterministic replay and dense-scene performance.
