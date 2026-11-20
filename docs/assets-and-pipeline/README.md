# Asset and content pipeline

Assets are content inputs, not substitutes for simulation definitions. Aircraft cockpit/external models live with their aircraft; weapon/vehicle/naval models live with their content module; shared assets use stable shared IDs and licenses.

Metadata: ID/version, path/format, source/author, license/redistribution, hash, scale/units, coordinate basis/handedness/axes, origin/pivot, attachment points, animations, LODs, collision proxy relation and dependencies.

Visual geometry is not automatically mass, inertia, aerodynamic, armor, radar signature or collision truth. Physical proxies require separate data and validation. Cockpit controls map stable IDs to typed commands; instruments consume snapshots. Renderer animation follows published state.

Pipeline checks formats, scale/axes/pivots, duplicate IDs, textures, LOD, animation bindings, attachments, hash, license and target browser support. Profile geometry, draw calls, textures, animation, audio and memory. A reference URL does not grant redistribution rights; do not commit unlicensed manuals/photos/models/audio.
