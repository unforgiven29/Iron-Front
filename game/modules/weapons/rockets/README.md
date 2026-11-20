# Rocket and rocket-pod definitions

Own rocket motor, body/mass, drag/aerodynamic data, ignition delay, burn profile, launch interface, dispersion, fuze/warhead and pod compatibility. Platform owns pod installation/station selection and release/trigger controls. Shared propulsion/ballistics/damage executes physical effects.

Distinguish motor burn from post-burn coast; account for launch velocity, airflow, wind, gravity, thrust alignment, dispersion and any guidance actually fitted. Unguided rockets do not steer toward target. Pod firing sequence consumes inventory and can create asymmetric stores/mass changes.

Validate ignition, burn transient, drag, dispersion, pod compatibility, motor failure, fuze/warhead and store consumption.
