# Tactical behavior, infantry, logistics and campaign context

**Read with:** `game/modules/ai/README.md`, `game/modules/ground-units/README.md`, `game/modules/infantry/README.md`, `game/modules/logistics/README.md` and the relevant campaign owner guide.

## Why doctrine is useful

A realistic combined-arms simulation needs more than individual vehicle statistics. Doctrine helps define organizational structure, orders, roles, planning, command relationships, sustainment, mounted/dismounted transitions and how units behave together.

Use doctrine as a source for organizational and behavioral requirements. Do not use it as a technical source for armour thickness, sight range, weapon accuracy or vehicle mobility.

## Public Army doctrine routes

### 1. ATP 3-20.15 — Tank Platoon (10 July 2025)

- [Official Army RDL publication](https://rdl.train.army.mil/catalog-ws/view/100.ATSC/C30089BD-C3F4-4C3A-93B1-F6CB0D557EC1-1753379941749/ATP3_20x15.pdf)
- [Army update article](https://www.army.mil/article/289372/forging_the_thunderbolts_foundation_doctrinal_updates_to_tank_and_scout_platoon_manuals)

Use for tank platoon structure, leadership, planning, preparation, tactical tasks and sustainment. When using it, explicitly state that the publication describes U.S. Army practice and is not a universal doctrine set.

### 2. ATP 3-21.71 — Mechanized Infantry Platoon and Squad (15 October 2024)

- [Official Army RDL publication](https://rdl.train.army.mil/catalog-ws/view/100.ATSC/EF9DA569-8865-4E94-B15A-94913B080DCD-1729619785668/ATP3_21x71.pdf)

Use for mounted/dismounted mechanized infantry behavior, Bradley-equipped organization, mutual support, squad/platoon roles and relationships.

### 3. ATP 3-21.8 — Infantry Rifle Platoon and Squad

- [Army publication announcement](https://www.army.mil/article/167323/atp_3_218_infantry_platoon_and_squad_now_available_for_download)

Use as a discovery route for infantry squad/platoon roles and behaviors. Verify the latest edition and changes through Army Publishing Directorate before relying on a specific passage.

## Modeling rules for Claude

- Doctrine describes a real organization, not an AI algorithm. Convert it into explicit orders, state transitions, role constraints, observations and timing requirements.
- Do not assume every faction uses U.S. Army doctrine. Build doctrine profiles for each force where sources justify them.
- Keep morale, cohesion, suppression, command confidence, fatigue, casualties, ammunition, fuel, maintenance and communications as separate state variables with separate causes.
- A unit should be able to receive incomplete, stale or conflicting information. Commanders should make decisions from reports, not omniscient campaign state.
- Mounted infantry and dismounted infantry must have a real relationship: embarking, capacity, dismount event, transport loss, casualty/medical support and re-embarkation.
- Logistics should constrain operations through stocks, delivery time, route condition, capacity, repair parts and fuel; do not apply a generic "supply penalty" without causal state.
- Preserve civilians, humanitarian response, surrender, detention, evacuation and post-conflict consequences as separate systems rather than purely combat score modifiers.

## Extending beyond U.S. doctrine

For other factions, research their public organizational charts, training publications, exercise reports, official military histories and equipment operator materials. Preserve original terminology, translation uncertainty, publication date and the exact unit/era. Do not claim one nation's doctrine represents another nation's practice.
