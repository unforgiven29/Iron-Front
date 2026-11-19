# Graphics Engine

**Status: placeholder source structure. No renderer implementation is added by this README.**

The graphics engine is responsible for presentation only. It consumes simulation snapshots and subsystem outputs; it must never determine aircraft physics, collisions, damage, radar/IRST detections, campaign outcomes or AI knowledge.

Read [graphics architecture](../../docs/graphics-engine/README.md) and [Claude implementation guide](../../docs/graphics-engine/CLAUDE_IMPLEMENTATION_GUIDE.md).

## Planned ownership

- renderer abstraction, scene lifecycle and camera management
- render snapshot interpolation, transform hierarchy and coordinate conversion
- terrain/chunk streaming, LOD, culling, instancing and asset lifetime
- aircraft/vehicle/ship/infantry models and animation
- cockpit geometry, interaction surfaces and avionics display presentation
- materials, lighting, shadows, sky, clouds, fog and weather visuals
- particles and effects: exhaust, contrails, smoke, fire, tracers, explosions and debris
- post-processing, quality settings, diagnostics and performance telemetry

## Required separation

Simulation state is authoritative. Rendering reads previous/current snapshots and interpolates for display. Cockpit controls send commands to owning aircraft systems. Radar/IRST visuals display actual sensor outputs; visible meshes and rendered cones do not create detections. Visual LOD may remove a model from view but must not silently delete its campaign entity.
