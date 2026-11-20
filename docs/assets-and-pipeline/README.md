# Asset and content pipeline

Governs 3D models, cockpit assets, textures, materials, animations, audio, UI artwork, terrain tiles and other authored content. Assets are content inputs, not substitutes for simulation definitions.

## Ownership and metadata

Assets live with their owning content module or a shared library with stable IDs/versioning. Every asset records ID, version, path/format, source/author, license/redistribution status, hash, scale/units, coordinate basis/handedness, axes, pivot/origin, attachment points, animations, LODs, collision representation, dependencies and target quality tiers.

Aircraft cockpit geometry/control mapping belongs to that aircraft package. Shared shaders, generic controls and tools belong to the graphics engine. Avoid duplicate untracked copies.

## Geometry and coordinate discipline

Define project forward/up axes, origin, scale, component pivots, gear/contact points, hardpoints, antenna apertures, nozzles, cockpit eye points and animation pivots. Render transforms remain separate from simulation transforms. Use explicit attachment transforms and calibration scenes.

Visual geometry is not automatically authoritative mass, aerodynamic, armour, radar-signature or collision data. Any derived physics proxy needs its own validation/provenance.

## Cockpit assets

Every clickable control maps to a stable control ID and typed command. The aircraft subsystem owns command validation/behavior. Displays, lamps, audio and needles consume immutable system snapshots. A cockpit asset cannot directly set fuel, pressure, radar lock or engine state.

## LOD, streaming and browser budgets

Provide LODs/quality tiers by viewing distance and hardware. Separate collision/physics proxies from render meshes. Stream large terrain/assets spatially and release unused resources. Measure texture size, draw calls, material count, geometry, animation rate, audio voices and memory on representative desktop/mobile browsers.

## Audio and pipeline validation

Audio metadata includes sample rate, channels, loop/duration, loudness, spatialization, source and license. Simulation publishes events; audio renders them and cannot change state.

A future import/build pipeline validates formats, scale, axes, pivots, dependencies, texture limits, LOD coverage, animation bindings, hashes, license metadata and duplicate IDs. Build outputs should be reproducible.

## Copyright and acceptance

Do not commit copyrighted manuals, scans, photos, sounds or models unless redistribution is permitted. Reference images do not prove exact dimensions. An asset is accepted only when it loads in target browsers, respects scale/axes, has tested attachments/LODs, meets performance budgets and has complete metadata.
