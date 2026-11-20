# audio

Audio rendering and spatialization are driven by timestamped simulation outputs. Audio presentation never owns simulation state or determines outcomes.

## Requirements
- Keep presentation/test harnesses separate from simulation authority.
- Use reproducible fixtures and deterministic seeds where applicable.
- Test module boundaries and observable contracts rather than private implementation details.
- Document supported browser targets and known limitations.

**Status:** Documentation and folder structure only.
