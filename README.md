# Iron-Front

A browser-based combined-arms campaign and combat simulation built with JavaScript, TypeScript and HTML5.

## Architecture status

The repository contains an evolving code skeleton, subsystem architecture documentation and placeholder directories. A guide or folder does not mean its runtime system is implemented or validated. Check implementation reports and tests before assuming a capability is functional.

## Integrated simulation
- Integrated simulation architecture: docs/integrated-simulation/README.md
- Claude: integrate all systems: docs/integrated-simulation/CLAUDE_IMPLEMENTATION_GUIDE.md
- Core systems architecture: docs/core-systems/README.md
- Core implementation guide: docs/core-systems/CLAUDE_IMPLEMENTATION_GUIDE.md

## Aircraft and flight
- Aircraft module architecture: game/modules/planes/README.md
- Claude: modular aircraft fleet: game/modules/planes/CLAUDE_IMPLEMENTATION_GUIDE.md
- F-16 module: game/modules/planes/F-16/README.md
- Claude: implement F-16: game/modules/planes/F-16/CLAUDE_IMPLEMENTATION_GUIDE.md
- Professional flight model: docs/flight-model/README.md
- Flight model implementation guide: docs/flight-model/CLAUDE_IMPLEMENTATION_GUIDE.md
- Propulsion and engine architecture: docs/propulsion/README.md
- Engine implementation guide: docs/propulsion/CLAUDE_IMPLEMENTATION_GUIDE.md

## Sensors
- Sensor suite architecture: docs/sensors/README.md
- Sensor implementation guide: docs/sensors/CLAUDE_IMPLEMENTATION_GUIDE.md
- Radar architecture: docs/radar/README.md
- Radar implementation guide: docs/radar/CLAUDE_IMPLEMENTATION_GUIDE.md
- **RWR/ESM architecture:** sensors/RWR/README.md
- **RWR/ESM implementation guide:** sensors/RWR/CLAUDE_IMPLEMENTATION_GUIDE.md
- **RWR validation and data standard:** docs/sensors/RWR_VALIDATION_AND_DATA_STANDARD.md
- IRST architecture: docs/irst/README.md
- IRST implementation guide: docs/irst/CLAUDE_IMPLEMENTATION_GUIDE.md

## Graphics
- Graphics engine architecture: docs/graphics-engine/README.md
- Graphics implementation guide: docs/graphics-engine/CLAUDE_IMPLEMENTATION_GUIDE.md

## Technology and deployment

Use TypeScript for new simulation contracts and core logic where practical, interoperate with existing JavaScript, and use HTML5 for the browser shell/UI. Keep the application deployable as static assets on GitHub Pages. Static hosting does not provide a persistent authoritative multiplayer backend.
