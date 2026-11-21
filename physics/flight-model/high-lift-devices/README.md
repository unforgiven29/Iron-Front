# High-lift and drag-device integration

**Owner:** physics/flight-model/high-lift-devices for configuration/scheduling interfaces; actuator, aerodynamic and hydraulic/electrical owners execute actual device behavior. **Status:** architecture only.

This guide covers flaps, leading-edge slats/flaps, spoilers, speedbrakes/airbrakes and other configuration-changing devices. Devices can change lift, drag, pitching moment, roll/yaw coupling, local flow, hinge loads and structural loads. Their presence, movement range, schedule and coupling are aircraft-specific.

## Separate three layers

1. **Command/schedule:** pilot or automatic system requests a position/mode using the aircraft-specific schedule.
2. **Physical device state:** actuator, linkage, hydraulic/electrical supply, load, damage and mechanical stop determine actual position, speed and asymmetry.
3. **Aerodynamic effect:** each affected surface/panel uses coefficient data or a validated device interaction model for the actual position.

A flap switch position is not the flap's achieved angle. A deployment command is not guaranteed deployment.

## Required configuration data

Device ID/type; left/right or segmented arrangement; hinge and axis; travel limits; actuation circuit and actuator; command schedule and interlocks; movement time/force limits; surface/panel overlap; coefficient datasets and valid envelope; damage zones; cockpit indication; and source applicability.

## Model distinctions

- Flaps change camber/area/effective geometry and often pitching moment; drag and control mixing may change.
- Leading-edge devices change leading-edge geometry and stall behavior; they may be scheduled with AoA, Mach, flap state or flight-control logic.
- Slats may have free, spring, powered or scheduled behavior depending on aircraft. Do not give every aircraft the A-4's slat mass/spring model.
- Spoilers can act as speed brakes, roll-control devices or lift dump depending on the installed arrangement.
- Speedbrakes/airbrakes are drag devices with structural and hinge loads and possible asymmetric failure.

Fixed LERX/LEX features are not high-lift actuators. They belong to geometry and flow-interaction definitions.

## Validation

Validate each device's motion, schedule, interlocks, asymmetry, resource failure, damage and actual surface feedback. Aerodynamic tests must compare lift/drag/pitch changes across device states without counting the same increment in both base coefficient data and separate device force logic.
