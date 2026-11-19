# Iron-Front

A browser-based combined-arms campaign and combat simulation. The repository is being organized around modular simulation systems before substantial implementation.

## Architecture status

This repository currently contains a small HTML/JavaScript skeleton, architectural documentation and placeholder directories. The presence of a subsystem folder or guide does **not** mean its runtime simulation is implemented or validated.

### Simulation and aircraft
- [Core systems architecture](docs/core-systems/README.md)
- [Core implementation guide for Claude](docs/core-systems/CLAUDE_IMPLEMENTATION_GUIDE.md)
- [Professional flight model architecture](docs/flight-model/README.md)
- [Flight model implementation guide for Claude](docs/flight-model/CLAUDE_IMPLEMENTATION_GUIDE.md)
- [Propulsion and engine architecture](docs/propulsion/README.md)
- [Engine implementation guide for Claude](docs/propulsion/CLAUDE_IMPLEMENTATION_GUIDE.md)

### Sensors
- [Sensor suite architecture](docs/sensors/README.md)
- [Sensor implementation guide for Claude](docs/sensors/CLAUDE_IMPLEMENTATION_GUIDE.md)
- [Radar architecture](docs/radar/README.md)
- [Radar implementation guide for Claude](docs/radar/CLAUDE_IMPLEMENTATION_GUIDE.md)
- [IRST architecture](docs/irst/README.md)
- [IRST implementation guide for Claude](docs/irst/CLAUDE_IMPLEMENTATION_GUIDE.md)

### Graphics
- [Graphics engine architecture](docs/graphics-engine/README.md)
- [Graphics implementation guide for Claude](docs/graphics-engine/CLAUDE_IMPLEMENTATION_GUIDE.md)

Build shared, testable physical foundations with aircraft-/vehicle-specific configurations and genuinely distinct systems. Keep simulation state independent from rendering. Use explicit units, coordinate frames, timing, data provenance, deterministic tests and documented approximation limits. GitHub Pages hosts the client; it is not a persistent authoritative multiplayer server.
