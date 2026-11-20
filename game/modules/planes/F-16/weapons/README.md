# F-16C Block 50 weapons and stores installation

Own aircraft station layout, pylons/racks/launchers, wiring/data interfaces, physical attachment transforms, clearance/interference envelopes, permissible loading configurations, release controls and exact variant restrictions. Weapon product data/runtime remain in game/modules/weapons and shared physics.

## Required data
Station ID/location/orientation, mass/CG contribution, structural/load limits, compatible rack/launcher/stores, electrical/data connections, release/ejector behavior, safe separation envelope, asymmetric-load restrictions, cockpit SMS/control mapping and provenance. Exact store clearances and software release permissions are configuration-specific.

## Release flow
Crew/AI requests store selection/release → SMS validates loaded station/configuration → launcher checks fit/interlock/safe envelope → release/separation event → aircraft mass/drag updates → weapon runtime takes ownership. No visual-only store disappearance or weapon spawn without a validated release event.

## Tests
Compatible/incompatible loading, mass/CG/inertia, asymmetry, clearance, interlock failure, release impulse, separation/collision, wiring/power/data loss and weapon lifecycle handoff.
