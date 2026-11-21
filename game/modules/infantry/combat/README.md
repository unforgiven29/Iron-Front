# Infantry first-person combat and carried weapons

**Owner:** game/modules/infantry/combat. **Status:** design only; no first-person infantry runtime exists.

Own individual infantry weapon state and human-facing combat action contracts. Weapon projectile physics, penetration, optics, recoil forces and damage effects are shared services; equipment profiles provide exact weapon configuration and compatibility.

## Weapon and sight state
Model weapon identity/variant, fire mode, chamber/magazine/reserve ammunition, reload state, safety, attachments, zeroing, mechanical/thermal condition, carried mass and operator skill. Sight configurations may include iron sights, reflex/holographic, fixed or variable-power optics, night/thermal sights, laser/illuminator and compatible muzzle/under-barrel devices. Compatibility is data-driven; an attachment changes only the supported properties.

Aiming is a command and sight picture, not a direct hit. Define eye/optic position, eye relief where relevant, reticle, magnification, field of view, parallax/zero, weapon cant and movement/breathing effects at the declared fidelity. Iron sights have front/rear alignment and weapon-specific sight geometry. Scope view and reticle are derived from the installed optic.

## Human handling
Fire, burst, hold, reload, switch fire mode, aim-down-sight, shoulder/stance, weapon swap and attachment controls become validated commands. Recoil, muzzle rise, spread, projectile velocity, penetration and impact are not presentation-only curves; the result comes from shared ballistics and damage. Fatigue, stance, suppression, wounds, load and training may influence stability and handling through explicit state.

## Loadouts
Role presets are starting configurations, not hard limits. Custom loadouts validate weapon/launcher/armor/grenade/utility compatibility, ammunition and total load. Saved loadout slots are local user data; campaign equipment availability and logistics still decide whether the kit can be issued.

## Validation
Sights/zero/magnification; fire modes and ammunition; reload interruptions; recoil and stance; attachment compatibility; inventory exhaustion; hit/penetration against armour/structures; suppression/wounds; deterministic input recording; keyboard/mouse/controller/touch/joystick input cleanup.
