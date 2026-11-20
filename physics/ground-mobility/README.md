# Ground mobility physics

**Owner:** physics/ground-mobility. **Status:** design only; no mobility solver exists.

Compute tracked/wheeled movement from drivetrain torque/power, traction, steering, braking, suspension, contact and terrain. Vehicle modules supply exact mass/geometry, wheel or track arrangement, gear ratios, suspension, engine fit and limits. Never move vehicles by setting world position to a waypoint.

Tracked model: track contact/sprocket/road-wheel representation, slip, tension/health, differential or braking steering and track failure. Wheeled model: tire contact, slip forces, normal load, steering, rolling resistance, braking and drivetrain. Suspension models travel, spring/damping, bump stops and load transfer.

Terrain provides slope, roughness, friction/soil/moisture and obstacle data. Bogging, sinkage and water crossing require named supported models. Rigidbody owns global vehicle motion; mobility returns forces/constraints. Validate gradeability, acceleration/braking, turning, slip, suspension, asymmetric failures, terrain transition and recovery.
