# Claude Implementation Guide — Graphics Engine

The graphics engine is currently a placeholder. This guide tells you how to design and implement it without coupling rendering to simulation or breaking the existing browser game.

## 1. Audit before implementation

Inspect package/build files, current renderer, scene setup, asset loaders, camera code, UI, terrain/chunk system, aircraft/vehicle models, cockpit displays and GitHub Pages deployment. Identify the current graphics API and browser support. Do not assume Three.js, Babylon.js, raw WebGL or WebGPU until the repository proves it. Do not migrate frameworks without a written technical case and measured benefit.

Produce an inventory of current render ownership, duplicated code, performance bottlenecks and a staged migration proposal. Keep the existing game runnable throughout.

## 2. Hard separation: simulation versus presentation

- Simulation owns entity state, position, orientation, damage, collision and sensor outcomes.
- Graphics reads timestamped snapshots and interpolates them for display.
- User input is converted to commands and sent to owning systems.
- Render culling/LOD may omit visuals but must not delete or pause authoritative campaign entities without an explicit simulation policy.
- Visual particles, meshes, shader effects and animations never cause damage, collision, detection or mission outcomes.
- Do not let the renderer become a second source of truth for weather, radar, IRST or aircraft state.

## 3. Implement a vertical slice first

Do not build every renderer subsystem at once. Start with:
1. Existing renderer audit and baseline performance capture.
2. Scene lifecycle, camera and resize handling.
3. Simulation snapshot adapter and render interpolation.
4. One aircraft with correct model hierarchy and attachment points.
5. One terrain chunk with LOD and deterministic asset loading.
6. Lighting/material pipeline and a simple weather visualization.
7. Cockpit camera and one display consuming real subsystem data.
8. Profiling and regression checks.

Only generalize after the slice works in the real game and GitHub Pages deployment.

## 4. Coordinate and asset rules

Document world axes, handedness, units, aircraft forward/up axes, model scale, pivot locations and quaternion conventions. Every model needs a metadata record for variant, dimensions, origin, attachments, LODs, materials, textures, collision proxy and source/license. Never compensate for a wrong model pivot by adding aircraft-specific magic offsets throughout code.

Separate visual meshes from collision/physics geometry. Use explicit attachment transforms for pylons, weapons, landing gear, control surfaces, canopy, cockpit instruments and damage parts.

## 5. Browser performance requirements

Set measurable budgets before adding high-cost effects. Profile CPU/GPU frame time, draw calls, triangle count, texture memory, shader compilation, particle count and chunk load latency. Test dense terrain, cities, forests, formations, carrier decks, weather, cockpit displays and combined-arms battles.

Use LOD, instancing, culling, batching, texture compression, mipmaps, pooling and asynchronous loading where measurements justify them. Avoid per-frame allocations and unbounded object/particle creation. Make visual quality scalable; never reduce simulation accuracy to preserve FPS. Keep a lower visual quality path for mobile and integrated GPUs.

## 6. Rendering and sensor correctness

Radar and IRST simulation produce data independently. Graphics can visualize beam patterns, IR fields of view, thermal contrast, tracks and uncertainty for debugging, but these visualizations must consume the same production outputs as gameplay. Never detect a target because its mesh is visible, bright or inside a rendered cone.

The same rule applies to clouds, fog, rain, terrain and smoke: graphics and sensor physics should share environment inputs, but visual appearance is not the sensor calculation.

## 7. Cockpit implementation

Cockpit controls send commands through aircraft-system interfaces. Displays consume instrument data with timestamp, validity, failure and quality flags. Aircraft-specific cockpit layouts are expected; do not make a generic clickable cockpit that changes arbitrary booleans. Support mouse interaction, input focus, camera movement, display readability and performance.

## 8. Delivery requirements

For each PR, report:
- Renderer/API/framework found and why retained or changed.
- Files changed and subsystem ownership.
- Simulation-to-render data contracts.
- Asset conventions and source/licensing.
- Target browser/device and tested quality tiers.
- Before/after CPU/GPU/frame-time and memory measurements.
- Known visual limitations and next stage.

Do not call a graphics subsystem complete because a model appears on screen. It must be integrated, performant, robust to loading/device failures and isolated from authoritative simulation.
