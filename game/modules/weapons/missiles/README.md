# Missile product and variant definitions

A missile package composes exact airframe mass/geometry/inertia, motor, aerodynamic/control data, seeker, guidance law, autopilot/actuator, fuze/arming, warhead/effects, launcher compatibility, datalink and provenance. It supplies data/configuration; shared propulsion/ballistics/sensor/guidance/damage owners execute behavior.

Define lifecycle phases: safe/stored, selected, release requested, separated, boost/sustain/coast, seeker search/acquisition/track (if fitted), guided, lost guidance, armed, terminal, detonation, miss, dud or self-destruct. Each transition has preconditions, time and failure behavior.

A seeker receives only physical observations through its field-of-view/band/receiver limits; it never reads target truth. Guidance is bounded by navigation/actuator/kinematic capabilities. Validate motor transient, drag, guidance stability, seeker limits, countermeasures, lost track, fuze safe/arm conditions, warhead effects and replay.
