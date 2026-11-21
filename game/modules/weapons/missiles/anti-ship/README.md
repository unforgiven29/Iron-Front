# Anti-ship missile variants

**Owner:** anti-ship product definitions. Sea/environment physics, seekers and navigation remain in their canonical owners. **Status:** architecture specification.

## Product composition

Record exact body/mass/inertia; propulsion and trajectory profile; altitude/sea-skimming controller if fitted; navigation and external target reports; seeker architecture; target association/selection; command/datalink; fuze/warhead; launcher and ship/aircraft compatibility; and source/provenance.

## Seeker architecture

A variant may use active radar, passive RF, IR/EO imaging, dual-mode radar/IR or other evidence-supported terminal sensing. Keep sea-surface radar clutter, multipath, low-elevation propagation, target group association, decoy handling and target motion as explicit effects. Do not assume a single point target or a perfect ship coordinate.

## Target report uncertainty

Target reports contain position, course, speed, identity hypothesis, timestamp, source, uncertainty and age. The weapon's navigation and terminal seeker must work with these values; do not pass a hidden exact ship state.

## Validation

Test stale/cooperative target reports, target maneuver/group geometry, sea/background clutter, multipath/propagation limits, seeker search and target association, decoys, terminal selection, fuze/damage, safe separation and replay.
