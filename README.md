# Iron-Front

A browser-based combined-arms campaign and combat simulation. The repository is being organized around modular simulation systems before substantial implementation.

## Architecture status
This repository currently contains a small HTML/JavaScript skeleton and architectural placeholders. Radar, flight-model and core-system folders do **not** mean those simulations are implemented.

- [Core systems architecture](docs/core-systems/README.md)
- [Core implementation guide for Claude](docs/core-systems/CLAUDE_IMPLEMENTATION_GUIDE.md)
- [Flight model architecture](docs/flight-model/README.md)
- [Flight model implementation guide for Claude](docs/flight-model/CLAUDE_IMPLEMENTATION_GUIDE.md)
- [Radar architecture](docs/radar/README.md)
- [Radar implementation guide for Claude](docs/radar/CLAUDE_IMPLEMENTATION_GUIDE.md)

Build shared, testable physical foundations with aircraft-/vehicle-specific configurations and genuinely distinct systems. Keep simulation state independent from rendering. Use explicit units, coordinate frames, timing, data provenance, deterministic tests and documented approximation limits. GitHub Pages hosts the client; it is not a persistent authoritative multiplayer server.
