# Anti-radiation missile variants

**Owner:** anti-radiation product definitions. Passive RF observation uses sensors/weapon-seeker and sensors/ESM-compatible receiver contracts; RF propagation is physics/radar; navigation/guidance is physics/guidance. **Status:** architecture specification.

## Product/receiver definition

Record exact missile variant; body/mass/inertia; motor/trajectory; receive band(s); antenna baseline/pattern and angular measurement; receiver sensitivity/processing limits where public; emitter classification interface; navigation source; memory/last-known-emitter mode; command/prebriefed targeting mode; terminal guidance; fuze/warhead; launcher compatibility and provenance.

The seeker observes actual RF emissions after propagation and receiver limitations. It never accesses private radar objects, internal mode flags or campaign truth.

## Emitter report and memory

Emitter observations carry timestamp, bearing/angle estimate, frequency/pulse features where observable, quality, ambiguity and source association. Memory state stores only the last valid observed emitter estimate with age and uncertainty. If the emitter shuts down, relocates or changes characteristics, the missile does not learn its current position from the campaign table.

## Guidance composition

Distinguish passive homing to an observed emission, inertial/prebriefed navigation toward an estimated area, permitted updates, and terminal reacquisition. Home-on-jam is a specific supported mode with a specific observable and logic; it is not an automatic property of every passive-RF seeker.

## Validation

Test emitter intermittency/shutdown, changing source, multiple emitters, overlapping bands, receiver scan limitations, bearing error, memory aging, navigation uncertainty, terrain/propagation, decoys/interference, terminal guidance and replay.
