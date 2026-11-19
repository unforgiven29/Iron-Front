# Graphics Engine Architecture

**Status: design specification only. The graphics-engine folder is currently a placeholder; this document does not add a renderer.**

Iron-Front is a browser-based combined-arms simulator. Its graphics architecture must support large terrain spaces, aircraft, ground units, detailed cockpits, sensors, weather, effects and tactical interfaces while remaining responsive on desktop and mobile browsers.

The renderer is a presentation system. It consumes authoritative simulation snapshots and must never decide physics, damage, radar detection, IRST detection, collision or campaign outcomes.

## 1. Responsibilities and boundaries

The graphics engine owns:
- Scene/render graph and camera management.
- GPU resource lifetime, buffers, textures, materials and shaders.
- Terrain, water, vegetation, buildings, aircraft, ground-unit and cockpit rendering.
- Lighting, shadows, atmospheric visuals, clouds and precipitation visuals.
- Animation, particles, exhaust, tracers, explosions and debris presentation.
- Visibility/LOD selection and render-only culling.
- Post-processing, color management and accessibility settings.
- Debug overlays and visual diagnostics.

It does not own:
- Aircraft position, force, damage, collision or weapon outcomes.
- Radar/IRST propagation, detection or track state.
- Campaign entity truth, AI decisions or mission logic.
- Authoritative weather/lighting values (it visualizes environment state).
- Cockpit instrument source values (it displays outputs from subsystem contracts).

## 2. Renderer and platform strategy

Audit the existing renderer and framework before choosing or replacing technology. Keep rendering behind narrow interfaces so the simulation is not coupled to a particular graphics API. Prefer the project's existing WebGL-capable stack unless measured needs justify a migration. Treat WebGPU as an optional future backend, not a requirement or assumption. Define graceful fallback for unsupported features and context loss.

Separate render-frame timing from simulation timing. Interpolate immutable previous/current simulation snapshots for smooth presentation; never feed interpolated render transforms back into physics.

## 3. World and scene organization

Support:
- Large-world coordinates with documented precision strategy and origin rebasing if needed.
- Chunked terrain/biome streaming with deterministic campaign seeds.
- Hierarchical scene organization and spatial indexes shared only through explicit read-only interfaces.
- Frustum, occlusion and distance culling.
- Instancing/batching for vegetation, buildings, debris and repeated ground assets.
- Terrain LOD, mesh simplification, texture mipmaps and streaming.
- Water/coastline rendering and environment-specific materials.
- Collision meshes and visual meshes as separate assets with explicit ownership.

Chunk loading must not cause simulation entities to disappear, teleport or lose campaign state. Unloaded distant visuals may be absent while the underlying simulation remains represented by an appropriate simulation LOD.

## 4. Aircraft, vehicles and cockpit rendering

Aircraft visuals require:
- Variant-specific models, attachment points, pivots and coordinate conventions.
- Correct hierarchy for control surfaces, landing gear, doors, canopy, stores, pylons and animated mechanisms.
- Damage states and detachable components driven by simulation events.
- Exhaust/nozzle/afterburner visuals driven by engine state, not used to calculate thrust.
- External and cockpit camera rigs with independent controls.
- Cockpit geometry, material, lighting and readable display rendering.
- Clickable cockpit interaction surfaces mapped to aircraft-system commands; the graphics layer must not directly mutate hidden system state.
- Per-aircraft display layouts and symbology supplied by avionics modules.

Ground vehicles, infantry, ships, drones and civilian traffic need appropriate animation/LOD and attachment conventions without creating one giant monolithic model.

## 5. Materials, lighting and atmosphere

Use a documented physically based material workflow where supported:
- Consistent color space and tone mapping.
- Metallic/roughness or the chosen engine convention, with explicit texture packing.
- Normal, roughness, metalness, emissive and alpha handling.
- Texture compression and mipmap policy.
- Shadow cascades/resolution budgets and contact-shadow alternatives.
- Day/night sun and moon, ambient sky, fog and visibility.
- Cloud layers/volumes at a bounded fidelity; precipitation and lightning visuals.
- Wetness, snow, dust, soot, scorch marks and damage materials.

The rendered atmosphere should be driven by the same mission weather state used by physics/sensors, but visual cloud shapes are not themselves sensor calculations. A cloud may visually obscure a target only if the shared environment model also reports the corresponding visibility/IR/RF effect at the selected fidelity.

## 6. Effects and animation

Effects include exhaust, contrails, smoke, fire, muzzle flashes, tracers, explosions, dust, debris, wakes, water spray and weather particles. Separate:
- Physical state/event (simulation-owned).
- Effect parameters (derived presentation data).
- Particle/mesh rendering (graphics-owned).

Use deterministic event identifiers for replay and network synchronization. Bound particle counts, lifetime, update rate and memory. Avoid spawning one expensive object per particle when GPU particles or instanced sprites are appropriate. Visual effects must not create damage or sensor detections.

## 7. Cockpit and display pipeline

Cockpit displays are views of subsystem data:
- Instrument widgets receive typed, timestamped values and quality/validity flags.
- Radar, RWR, IRST, navigation and engine displays consume their owning subsystem outputs.
- Display refresh rates can differ from physics rates.
- Failure, power loss, sensor degradation and display damage must be visible.
- User interaction sends commands through aircraft-system interfaces.
- Maintain aircraft-specific layout and interaction maps; do not force every aircraft into one generic cockpit.

## 8. Performance and scalability

Define budgets per quality tier for CPU time, GPU time, draw calls, triangles, texture memory, shadow maps, particles and streaming bandwidth. Profile representative scenes: empty sky, dense city, forest, carrier deck, large formation, combined-arms battle, weather and cockpit view.

Use:
- LOD and impostors for distant objects.
- Instancing and batching for repeated assets.
- Frustum/occlusion/distance culling.
- Texture atlases/arrays and compressed textures where useful.
- Reuse/pooling for transient effects.
- Asynchronous asset loading and bounded chunk queues.
- Adaptive visual quality that never changes simulation results.
- Context-loss recovery and cleanup of GPU resources.

Do not optimize only for a single high-end desktop. Establish minimum supported browser/device targets and test integrated GPUs and mobile browsers.

## 9. Asset pipeline and validation

Define asset naming, scale, axes, units, pivots, material conventions, LOD naming, collision proxies, texture sizes, compression and licensing/provenance. Validate aircraft dimensions and attachment points against reference data. Add automated checks for missing textures, invalid materials, excessive texture sizes and malformed metadata.

Visual quality is not proof of simulation correctness. Keep numerical simulation tests separate from render tests. Add screenshot/golden-image tests only where stable and useful; avoid brittle pixel tests across different GPUs.

## 10. Definition of done

A graphics feature is complete when it has a documented owner and data contract, works at target quality tiers, handles asset/device failure, does not mutate simulation truth, has measured performance and has been checked in representative scenes. A detailed model or shader alone is not a completed graphics subsystem.
