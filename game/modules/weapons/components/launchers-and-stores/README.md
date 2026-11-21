# Launcher, station and store compatibility definitions

**Owner:** launcher/station product profiles and carrier integration. Aircraft/ship/ground platform packages define the installed station; weapon lifecycle validates and performs release. Shared collision/ballistics handle physical separation. **Status:** architecture only.

## Station and interface profile

Define stable station ID; attachment transform and reference datum; load/mass/CG/inertia/structural limits; rack, ejector, rail or launch tube; electrical/data/cooling umbilical; command/arming/seeker initialization interface; release direction/impulse; safe separation envelope; adjacent stores/structure clearance; jettison capability; and exact compatible weapon variants.

Compatibility is an explicit relation, not a string match on weapon display name. A compatible store may still be unavailable due to a failed station, power, cooling, data link, pylon, interlock or unsafe envelope.

## Release sequence

1. Pilot/AI requests release.
2. Store-management system checks selected station, master arm/safety, target/weapon mode, envelope, interlocks, inventory and hardware health.
3. Weapon receives permitted prelaunch setup/initialization while attached.
4. Release device/ejector/rail applies its configured impulse/launch event.
5. Umbilicals/connectors separate or transition to post-release support as fitted.
6. Weapon receives actual initial position, velocity, orientation and angular motion.
7. Collision/separation check verifies clearance. Failed separation does not spawn a free weapon.
8. Carrier removes the store and updates mass, CG, inertia, drag and remaining inventory.

## Carrier changes

Weapon release changes carrier mass properties and potentially aerodynamic loads. Fuel, stores and station asymmetry must use current geometry/mass data. A failed jettison or retained captive store remains attached; a missing store cannot still create a launch event.

## Validation

Test compatible/incompatible variants; asymmetrical loading; station and rack load limits; failed interlock; missing electrical/data/cooling service; release delay and impulse; adjacent-store collision; pylon/station damage; failed separation; jettison; carrier mass/CG/inertia/drag updates; and replay.
