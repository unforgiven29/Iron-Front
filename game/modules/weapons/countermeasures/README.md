# Countermeasures and expendables — entry point

**Owner:** game/modules/weapons/countermeasures. **Status:** product definitions and architecture only; no dynamic decoy/seeker interaction runtime is implemented.

This directory owns physical decoy product profiles, finite inventory, dispenser/pod compatibility, release events, deployment timing and the moving signature source. It does not decide whether a seeker is fooled. That decision belongs to sensors/weapon-seeker/countermeasure-discrimination using actual observation streams.

## Read by task

- Chaff: [chaff profile](chaff/README.md)
- Flares: [flare profile](flares/README.md)
- Active RF / repeater decoys: [active RF decoys](active-rf-decoys/README.md)
- Towed decoys: [towed decoys](towed-decoys/README.md)
- Dispenser, programs, release and inventory: [dispenser and deployment](dispenser-and-deployment/README.md)
- Seeker response/CM outcome: [dynamic discrimination owner](../../../sensors/weapon-seeker/countermeasure-discrimination/README.md)

## Shared decoy contract

A decoy profile defines stable ID/variant, physical deployment mechanism, initial state, signature/measurement characteristics versus time, mass/geometry/drag, power/thermal or RF-emission state as applicable, lifetime, environmental response and provenance. A deployment event defines release station/pose/velocity, impulse, timing, pattern, inventory decrement and failure state. The decoy then moves independently under physics and presents its changing signature to the environment.

Chaff, flare, active RF repeater and towed decoy are not interchangeable. Use separate physical models and receiver-observation routes.

## Non-negotiable rule

Never include one universal countermeasure-success probability on a missile or one fixed chaff/flare susceptibility multiplier on a seeker. A dynamic seeker may maintain its target, transfer to a decoy, reject a candidate, coast or lose track as current observation evidence changes.
