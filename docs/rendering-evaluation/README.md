# Rendering-engine evaluation prototype

**Decision status: not selected.** Keep the simulation independent of a renderer until a small comparison prototype has been measured.

## Candidates

Evaluate at least:
- Three.js (WebGL-oriented, mature ecosystem and broad examples).
- Babylon.js (engine-level scene/material/asset tooling and WebGPU/WebGL options).
- A minimal WebGL implementation only as a baseline for understanding overhead, not as the default long-term choice.

Do not add a production renderer dependency solely because it is familiar. Check current browser support and package maintenance when the prototype is built.

## Same-scene comparison

Build equivalent scenes and assets in each candidate:
1. One high-detail aircraft with moving controls, gear and stores.
2. Clickable cockpit with representative switches, needles and two display surfaces.
3. Ground scene with 10,000 instanced simple objects and a streamed terrain tile.
4. Multiple aircraft/vehicles with animation and damage-state changes.
5. Tactical overlays and sensor visualization.

## Measure

Record browser/GPU/driver/device, asset versions, resolution, quality settings, warm-up, scene/entity counts, median and 95th percentile frame time, CPU time, GPU timing where available, memory, draw calls, shader compilation stalls, load time, streaming, context-loss recovery, mobile behavior and fallback behavior.

Use identical assets, cameras, lights, materials and feature settings. Keep simulation/physics outside the measured render loop.

## Acceptance criteria

- Works on target desktop browsers with a documented mobile/fallback path.
- Supports GLTF/GLB workflow, LOD, instancing, animation, cockpit render targets/displays, post-processing and large-world origin offsets.
- Exposes clean scene/camera/material/asset lifecycle behind a renderer adapter.
- Does not own simulation truth or mutate authoritative transforms.
- Meets measured frame-time/memory budgets on representative devices.
- Is maintainable by Claude and has stable documentation/examples.

Record the comparison and an ADR under docs/architecture-decisions/. Until accepted, only the renderer-neutral port in game/src/rendering/ is canonical.
