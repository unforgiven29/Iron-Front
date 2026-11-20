# Infantry module architecture

Infantry are independent entities with equipment, movement, posture, health, suppression, morale, training/behavior profiles, team relationships and limited perception. Equipment/weapons are data-driven; shared ballistics, collision, damage and world queries remain shared services.

AI uses observations, orders, communications and local knowledge—not hidden enemy positions. Model incapacitation, casualty care, evacuation, surrender/retreat and civilian interaction as explicit states/events. Visual animation is separate from authoritative movement/health.

**Status:** Architecture and folder documentation only.
