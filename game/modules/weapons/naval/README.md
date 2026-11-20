# Naval weapon definitions and handling

Own naval weapon product definitions and weapon lifecycle interfaces. Ship/submarine modules own tube/launcher installation, handling, fire control, inventory and reload. Shared propulsion/ballistics/hydrodynamics/collision/damage systems execute physical behavior.

The naval category contains torpedoes, mines and other explicitly supported weapons. Distinguish water-entry, launch, run/depth/speed control, seeker behavior, wire/acoustic data and arming. Do not assume a generic projectile solver represents underwater movement.

Validate launcher compatibility, water entry, depth/control, seeker/environment interface, safe arming, inventory, recovery/dud and platform damage.
