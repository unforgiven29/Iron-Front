# missions

Mission definitions, tasking, objectives, triggers and debrief contracts. Missions consume simulation events and sensor reports, not hidden truth.

## Rules
- Implement as a versioned, replaceable module with schema-validated data.
- Do not hardcode faction, scenario, mission or platform identities in shared engine code.
- Consume and publish explicit commands, events and timestamped reports.
- Preserve uncertainty and provenance; AI and mission logic cannot read hidden sensor truth.
- Keep shared simulation services outside this content module.

**Status:** Architecture handoff only; not a runtime implementation.
