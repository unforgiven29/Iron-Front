# Graphics, cockpit and presentation engine

**Status:** renderer port and shell exist; final renderer selection and full scene/cockpit implementation remain open.

## Authority boundary
Graphics consumes immutable simulation snapshots and sends typed commands. It never owns physics, collision, damage, radar/IRST detection, AI knowledge, weapon effects, world truth or campaign outcomes. Invisible mesh is not destruction; a visible target is not a sensor detection.

## Responsibilities
Renderer abstraction/scene lifecycle; camera; snapshot interpolation; frame conversion; terrain/chunk visuals; models/animation; cockpit geometry/interaction; display presentation; lighting/materials/weather visuals; particles/effects; UI/audio; quality and profiling.

## Data flow
Owner publishes tick snapshot → renderer interpolates for display. User input maps to stable control ID and command issuer/target → owning system validates → later snapshot reflects the result. No mouse callback writes internal fuel/pressure/radar/engine state.

## Asset boundaries
Render mesh, collision proxy, physical geometry, mass, aero surfaces, armor, radar aperture/signature are separate validated data. LOD/culling changes only presentation.

## Renderer decision
Use controlled comparison prototype and ADR before choosing an engine. Compare cockpit instruments, large terrain, instancing, memory, mobile support, workers, licensing and maintainability using real project scenes.
