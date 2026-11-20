# Commands, events and snapshots

Commands are validated requests with issuer, target, tick, correlation ID, preconditions and expiry/cancellation behavior. Events are immutable facts published by an authoritative owner after a state transition. Observations retain source, acquisition time, frame, confidence, uncertainty and quality. Snapshots are immutable read-only tick-stamped views.

Use versioned contracts. Handle duplicate, stale, rejected and out-of-order messages explicitly. Consumers never directly mutate another module's state. Avoid one untyped global event bag.

**Status:** Architecture specification only.
