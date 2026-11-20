# Weapon content and runtime composition

Weapon packages compose exact body/mass/inertia, motor, aero/ballistics, seeker, guidance/autopilot, fuze/arming, warhead, launcher/station, data link, power/thermal, countermeasure interaction and assets. Shared trajectory, propulsion, seeker/sensor, collision, armor and damage algorithms remain in canonical owners.

Lifecycle: stored → configured → release requested → launcher validates compatibility/interlocks/safe envelope → separation event → boost/coast/guided phases → seeker/track state if fitted → armed → impact/miss/dud/self-destruct/inert result → damage report. Define abort and lost-guidance behavior.

Post-release weapon uses only onboard seeker, inertial state, initial release data and permitted datalink/external reports. Never read hidden target truth or guarantee acquisition/hit. Categories include guns/ammo, air-to-air/air-to-ground/anti-radiation/anti-ship/SAM missiles, bombs/glide weapons, rockets, torpedoes/mines and countermeasures.

Validate fit/release, separation, mass/drag changes, powered/coast trajectory, seeker/guidance limits, countermeasures, fuze safety, effects and replay.
