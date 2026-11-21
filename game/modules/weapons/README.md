# Weapon systems — entry point

**Owner:** game/modules/weapons. **Status:** content architecture and documentation; most weapon runtime behavior is not implemented.

This directory defines weapon products and their installed component profiles. It does not own duplicate copies of propulsion, ballistics, sensor, guidance, rigid-body, collision, armour or damage algorithms.

## Read by task

- New weapon type/variant: this guide, the relevant category under missiles/bombs/rockets/guns/naval, and [component composition](components/README.md).
- Seeker hardware/profile: [seeker index](components/seekers/README.md), then only the relevant seeker family page.
- Guidance/navigation: [guidance index](components/guidance/README.md), then the matching physics/guidance owner guide.
- Chaff/flare/towed/active decoys: [countermeasure index](countermeasures/README.md), then [dynamic seeker discrimination](../../../sensors/weapon-seeker/countermeasure-discrimination/README.md).
- Motor/trajectory/warhead/fuze/launcher: the corresponding component README, plus its canonical shared physics owner when behavior is involved.

Do not read every weapon or missile guide for an unrelated task.

## Weapon package composition

A weapon variant references immutable profiles for:
- Physical body, geometry, mass distribution and inertia.
- Propulsion/motor stages and consumables.
- Aerodynamic/ballistic data and control surfaces.
- Navigation and guidance architecture/laws.
- Seeker hardware, processing modes and acquisition/tracking limits, if fitted.
- Data/command link and external illuminator dependencies, if fitted.
- Power, cooling, thermal state and built-in-test/arming dependencies.
- Fuze, safe/arm logic, warhead and damage-effect model.
- Launcher/station compatibility, release impulse, separation and carrier interface.
- Countermeasure/decoy observations and discrimination capabilities.
- Provenance, applicability, uncertainty and supported envelope.

One profile can be reused only when product/variant evidence shows the same equipment and software fit. Do not create a second runtime implementation for each missile.

## Lifecycle and information boundary

Stored → configured → release requested → launcher validates station/interlocks/safe envelope → separation → boost/sustain/coast → navigation/midcourse → seeker search/acquisition/track if fitted → terminal → fuze/impact/miss/dud/self-destruct/inert → damage/effects report.

Commands are not state. A release request is not a successful release; a cue is not a lock; seeker acquisition is not a guaranteed hit; an armed warhead is not guaranteed detonation. After release, the weapon uses only onboard state/observations and permitted external updates. It never reads hidden target truth.

## Canonical algorithm owners

| Capability | Canonical owner |
|---|---|
| Weapon product/variant composition and lifecycle | game/modules/weapons |
| Missile/rocket propulsion dynamics | physics/propulsion |
| Free flight, aerodynamic forces and trajectory | physics/ballistics + physics/aerodynamics |
| Guidance algorithms and command generation | physics/guidance |
| Weapon-mounted seeker state and association | sensors/weapon-seeker |
| RF propagation/target scattering/clutter | physics/radar |
| IR/EO scene and optics | sensors/IRST, sensors/EO-FLIR, physics/optics, physics/thermal |
| Launcher/carrier installation and mass changes | platform package + shared integration contracts |
| Fuze/warhead interaction and damage | weapon profiles + physics/collision/armour + damage owner |
| Decoy physical product and release | game/modules/weapons/countermeasures |
| Decoy-versus-target discrimination | sensors/weapon-seeker/countermeasure-discrimination |

## Acceptance and validation

Use [weapon guidance, seeker and countermeasure acceptance](../../tests/acceptance/Weapon-guidance-seeker-countermeasures.md) as the cross-family integration checklist. It is a requirements document, not evidence that the runtime exists.

## Non-negotiable weapon rules

- Guidance source, navigation source, terminal sensor, angle/range measurement method, guidance law and control method are separate fields.
- Never store one universal chaff/flare susceptibility scalar as runtime logic.
- Seeker receives observations and uncertainty, never an entity reference or world-truth target position.
- All numeric limits include units, exact variant/software applicability, source/revision/page, provenance and confidence.
- No exact values are invented to fill missing data; unsupported envelopes remain explicit.
- Performance optimization may lower selected fidelity only through a declared configuration tier, never silently by frame rate.

## Reference approach

Falcon BMS is a useful public reference for modular simulation work: its developer articles describe separated mechanical, aerodynamic, I/O, engine, ground and motion modules, and its aerodynamics article describes local surface loads aggregated into aircraft forces/moments. Its AIM-120 acquisition article is particularly useful for staged midcourse/search/terminal processing and uncertainty propagation, but explicitly warns that its public 4.37.3 model uses assumptions/estimates and is not an engineering-accurate missile simulation. Borrow the architecture and validation questions, not its constants or unverified behaviors.

- [BMS physics-engine architecture](https://falcon-bms.com/blog/the-development-of-the-physics-engine)
- [BMS aero module](https://www.falcon-bms.com/blog/the-aero-module)
- [BMS AIM-120 acquisition-model discussion](https://www.falcon-bms.com/blog/aim-120-bms-acquisition-model)
