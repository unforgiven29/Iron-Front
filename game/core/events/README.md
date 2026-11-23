# Commands, events, observations and snapshots

**Owner:** game/core/events. **Status:** in-process transport implemented in `game/src/core/events/MessageBus.ts` (tests: `game/tests/unit/MessageBus.test.ts`, `game/tests/integration/RuntimeLoop.test.ts`). Not yet implemented: event journal/replay serialization, command expiry/cancel policy, bounded retention of seen message ids, and cross-process/network transport.

## Implemented contract
- A message is accepted only if it passes the envelope JSON Schema, matches a registered `(contractId, contractVersion, kind)` and passes the contract's payload validator. It must also carry a unique `messageId` and be stamped with the bus's current tick. An observation must not claim acquisition after its publication tick.
- `publish` only queues. `deliver()` drains in publish order. Anything published during delivery waits for the next `deliver()`, and `deliver()` is not re-entrant.
- A command goes only to the single handler registered for `(contract, targetModuleId)`. That handler returns accept or reject-with-reason. Each command yields a `CommandOutcome` (with `correlationId`), including when no handler exists.
- Events, observations and snapshots go to subscribers of that contract id in subscriber-id order. Consumers see only contracts they subscribed to. Snapshot payloads are deep-frozen.
- A consumer or handler that throws is reported as a `ConsumerFault`, and other consumers still receive the message.

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
