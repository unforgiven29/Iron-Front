# Core systems documentation index

The executable ownership tree is game/core/. This document exists as a documentation index only; it is not a second runtime package or duplicate architecture authority.

Use game/core/README.md for the full runtime service map. Read the focused service guides for module registry, simulation, events, entities, resources, configuration, persistence, diagnostics, spatial services and networking. Use docs/ARCHITECTURE_OVERVIEW.md for repository-wide boundaries and docs/claude/README.md for task-scoped reading.

Core coordinates shared infrastructure; it does not absorb domain algorithms. For example, core/resources arbitrates typed supply/demand while game/systems/electrical owns bus dynamics and sensors/Radar owns receiver/detection behavior. Do not put aircraft, weapon, sensor or campaign rules in core.
