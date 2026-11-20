# Infantry simulation modules

Own dismounted individuals, squads, equipment profiles and infantry-specific behavior. Shared collision, ballistics, damage, optics/world queries, communications and AI infrastructure remain shared.

Individual state may include posture/movement, health/injury/incapacitation, equipment/load, ammo, morale/suppression, skill/training, fatigue and perception. Squad state includes cohesion, roles, formation/orders, leader succession, comms and casualty count. Avoid treating a squad as one omniscient point.

Movement respects terrain, cover, obstacles, posture and load. Perception uses view/hearing/LOS/contrast/report age. Combat results come from weapon/ballistic/damage services. Surrender, retreat, capture, wounds, medic treatment, evacuation and civilian interaction are explicit events—not score multipliers.

Validate cover/obstacle movement, suppression, ammunition, casualty care, leader loss, communication loss, capture/retreat and no hidden enemy coordinates.
