# Infantry simulation modules

Own dismounted individuals, squads, equipment profiles and infantry-specific behavior. Shared collision, ballistics, damage, optics/world queries, communications and AI infrastructure remain shared. This domain includes both tactical AI infantry and a player-controlled first-person infantry station.

Individual state may include posture/movement, health/injury/incapacitation, equipment/load, ammo, morale/suppression, skill/training, fatigue and perception. Squad state includes cohesion, roles, formation/orders, leader succession, comms and casualty count. Avoid treating a squad as one omniscient point.

**Research references:** use [Tactics and campaign context](../../../docs/reference-library/tactics-and-campaign.md) for public infantry/mechanized doctrine routes and [Ground vehicles and infantry](../../../docs/reference-library/ground-vehicles-and-infantry.md) for mounted/dismounted and platform interactions. Doctrine is country- and era-specific.

## Player and squad actions
Support dismounted movement, stance, sprint/crouch/prone/crawl, aiming, iron sights and installed optics, firing/reload/fire mode, weapon and launcher selection, grenades, interaction, treatment, radio calls, entering/exiting structures and mounting/dismounting vehicles. Mouse/keyboard/controller/touch input maps to validated commands with hold/release cancellation. The same weapon/ballistic and damage services resolve player and AI fire.

## Roles, kits and insertion
Role profiles may include rifle/assault, marksman, sniper, machine gunner, anti-tank, air-defence, engineer, medic, breacher and close-quarters roles where scenario content supports them. A role is a preset, not a hidden capability. Custom kits validate primary/sidearm, launcher, ammunition, armour, grenades, medical/utility equipment, mass and faction stock. Insertion may use a foot approach, APC, IFV, helicopter transport or parachute/airdrop if the selected scenario/platform supports it. Embarkation reserves seats and dismount publishes an event that creates individual entities with persistent identity and loadout.

## Tactical state
Movement respects terrain, cover, obstacles, posture and load. Perception uses view/hearing/LOS/contrast/report age. Combat results come from weapon/ballistic/damage services. Suppression, morale, fatigue, wounds, ammunition and leader loss change behavior through state, not scripted hit points. Squad behavior supports formations, bounding/overwatch, assault, defend, flank, retreat, surrender, casualty recovery and reinforcement requests.

## Consequences
Surrender, retreat, capture, wounds, medic treatment, evacuation and civilian interaction are explicit events—not score multipliers. See [first-person combat](combat/README.md), [equipment](equipment/README.md), [behavior](behaviour/README.md) and [medical support](medical-support/README.md).

Validate cover/obstacle movement, suppression, ammunition, casualty care, leader loss, communication loss, capture/retreat, vehicle embark/disembark, interior traversal and no hidden enemy coordinates.
