# Weapon runtime source area

**Status: folder marker and design notes only. No weapon runtime code was added for this task.**

This directory is reserved for future weapon lifecycle/composition code. Product-specific definitions and source evidence remain under [game/modules/weapons](../../modules/weapons/README.md).

Planned responsibilities:

- Weapon state and post-release lifecycle, with explicit phase transitions.
- Separation from launcher/station and release envelope/interlock handling.
- Composition of variant-specific propulsion, ballistics, navigation, guidance, seeker, datalink, fuze and warhead profiles.
- Safe/arm and fuze event interfaces that consume physical collision/proximity reports rather than inventing impacts.
- Loss, miss, dud, self-destruct, inert and damage/effects reporting.
- External update and command permissions, including stale/missing data behavior.

Shared algorithm ownership remains in the corresponding `physics/` and `sensors/` domains. Do not duplicate an entire seeker or aerodynamic solver for every missile name. A product profile must identify the exact hardware/software variant, sources, uncertainty and supported envelope.
