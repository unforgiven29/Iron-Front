# ui

UI, instruments and widgets consume immutable snapshots and send typed commands. Presentation must not mutate subsystem internals.

## Requirements
- Keep presentation/test harnesses separate from simulation authority.
- Use reproducible fixtures and deterministic seeds where applicable.
- Test module boundaries and observable contracts rather than private implementation details.
- Document supported browser targets and known limitations.

**Status:** Documentation and folder structure only.
