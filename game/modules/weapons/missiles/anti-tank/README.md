# Anti-tank guided missile and infantry anti-armour products

**Owner:** anti-tank missile product definitions. **Status:** content architecture only; no complete ATGM runtime is implemented.

Represent each missile and launcher as separate compatible products. The weapon package defines exact variant, body/mass, motor, aerodynamics/control, guidance/seeker, warhead/fuze, launch envelope, command equipment, sight/thermal display, reload rules and sources. Infantry equipment/vehicle platforms own launcher installation, operator station and carried ammunition; shared physics/guidance/seeker owners execute behavior.

## Guidance architectures
An ATGM may use one of several distinct mechanisms, confirmed for the exact variant:
- Wire/fibre-optic command guidance: launcher/operator tracks and sends steering commands through a physical data link.
- Radio command guidance: steering commands arrive over an RF link.
- Laser beam-riding: missile senses its position relative to a director beam; it is not semi-active laser homing.
- Semi-active laser homing: seeker measures reflected designator energy from an external designator.
- Imaging-infrared or other fire-and-forget homing: lock/acquisition occurs before launch, then the missile tracks from its own seeker.
- Predicted-line-of-sight / pre-programmed trajectory (including top-attack profiles) when supported.
- Manual or unguided rocket/launcher behavior where appropriate.

Do not assume a weapon's guidance from nation, appearance or generic "ATGM" category. Separate command link, tracker, beam/director, designator, missile seeker and post-launch operator responsibilities. Loss of wire, radio, laser spot, line of sight, operator tracking or seeker track has architecture-specific effects.

## Launcher sight and operator interaction
A launcher may have day optical, thermal or other sight equipment with its own FOV, magnification, stabilization, contrast, range and obscurant limits. A lock-required seeker displays a lock state derived from its real acquisition/tracking confidence, not a progress bar that guarantees a hit. Command-guided systems may require the operator to continue aiming/tracking after firing. Distinguish target cue, acquisition, track, launch authorization and impact assessment.

## Warhead and target interaction
Record warhead type and fuze behavior per product. Tandem shaped-charge, single shaped-charge, kinetic or other effects must use supported armour/impact physics and vehicle aspect/structure. A target's armour is not an ATGM-side damage multiplier. Flight path, top-attack, direct-attack, proximity, fuze and damage result remain distinct.

## Validation
Correct exact-product guidance assignment; prelaunch acquisition and abort; post-launch link loss; operator tracking and sight movement; wire/beam/laser path; top-attack geometry; target motion/occlusion; motor and control failure; fuze and armour interaction; ammunition/reload and campaign stock accounting.
