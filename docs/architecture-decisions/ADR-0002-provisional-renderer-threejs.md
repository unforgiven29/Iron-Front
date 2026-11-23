# ADR-0002: Provisional renderer — Three.js

- Status: Accepted (provisional; revisit at the Stage 4 renderer comparison)
- Date: 2026-11-23
- Scope: game/src/rendering, presentation only

## Context

The project needed a first 3D view: an untextured F-16 cockpit and world. Renderer selection is formally a Stage 4 task. The candidates considered were Three.js and Babylon.js.

## Decision

Use **Three.js 0.187.0** (exact pin) as the provisional renderer, loaded lazily only when the cockpit view starts.

- Iron-Front already owns physics, scheduling, terrain, collision and input. The architecture forbids rendering from deciding physics or game state. Three.js is a rendering library only, so it fits behind the presentation boundary without bringing a second engine.
- Babylon.js is a full engine with its own physics plugins, scene graph conventions, GUI and input. Those would duplicate Iron-Front's owners and would need fencing off.
- Three.js has the smaller bundle (it matters for GitHub Pages) and the larger ecosystem.

## Consequences

- `game/src/rendering/three/` contains the Three.js code. It renders data contracts: `CockpitLayout` and a structural snapshot interface. It contains no aircraft-specific code.
- It uses a floating origin (the world moves, the camera stays at the origin) to keep float32 precision.
- Cockpit geometry is per-aircraft data (`F16CockpitLayout.ts`), labelled approximate and visual-only.
- The existing `RendererPort` is not yet implemented by this view. Unifying the two is part of the Stage 4 comparison.
- Stage 4 must still run the renderer comparison: performance, LOD, asset pipeline, cockpit interaction. It may supersede this ADR.

## Alternatives

- Babylon.js: see above.
- The 2D canvas only (the existing debug view): keeps the selection fully open, but cannot show a cockpit.
