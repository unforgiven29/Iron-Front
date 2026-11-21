# Infantry equipment definitions

Own data-only personal equipment records: stable ID/version, mass and carried load, armour/protection zones where known, weapon/accessory compatibility, ammunition capacity, sensors/optics, radio capability, battery/power, medical/utility tools, environmental protection and provenance.

## Personal equipment
Profiles can compose helmet, body armour and limb protection as separate body-zone coverage and material/layer records. Weight and encumbrance contribute to movement, fatigue and stamina through the shared character/mobility model. Protection references shared armour/material/impact models; never assign a universal protection percentage. Armor by zone must not imply the protected area is invulnerable.

Weapon profiles may reference iron sights, reflex/holographic sights, fixed/variable magnification optics, night/thermal devices, lasers/lights, muzzle devices, grips, bipods and under-barrel launchers where the exact weapon supports them. These attachments are separate data components with compatibility, mass, power, field-of-view and handling interfaces.

## Loadout persistence and supply
Role presets are editable starting configurations. Custom kits are validated against faction equipment, scenario rules, ammunition stock, station/mission restrictions and carried mass. Local saved loadout slots store user preference only; the campaign/logistics authority decides what can actually be issued at a given unit/base.

An equipment record configures capability; it does not implement the corresponding sensor, ballistics, armor or communication engine. Load/weight affects movement through shared mobility/character dynamics if implemented.

Validate schema, units, loadout compatibility, mass/capacity, ammunition, attachment fit, equipment failure/depletion, faction availability and source applicability.
