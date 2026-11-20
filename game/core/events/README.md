# Commands, events, observations and snapshots

**Owner:** game/core/events. **Status:** TypeScript/schema contracts exist; runtime queues, dispatch, journal and delivery semantics are not complete.

## Message meanings
- Command: validated request with issuer, target, issue tick, payload, preconditions and expiry/cancel policy. Owner may accept, reject, limit or defer.
- Event: immutable fact published by its authoritative owner after state commits.
- Observation: imperfect evidence with source, acquisition/publication time, frame, uncertainty and quality.
- Snapshot: immutable tick-stamped read model for UI, AI, renderer, diagnostics and save consumers.

## Dispatch contract
Version contract IDs; validate payloads at boundaries; define deterministic phase/priority/sequence; handle duplicate IDs, stale/expired commands, unknown versions, invalid targets and consumer failure. Do not permit reentrant consumers to mutate a producer mid-transition.

## Traceability
Carry correlation IDs across command → validation → state transition → event → downstream reaction. Keep the event journal separate from verbose developer logs and bound retention.

## Information boundaries
Consumers only receive subscribed public contracts. RWR cannot read radar private tracks; AI cannot read exact world positions unless explicitly permitted; presentation cannot receive mutable internals. Developer diagnostics must not become a gameplay bypass.

## Tests
All message kinds, malformed payloads, duplicate IDs, delayed/out-of-order messages, rejected commands, commit-before-event, consumer exceptions, stable order, uncertainty retention and replay serialization.
