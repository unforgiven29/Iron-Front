# Networking and authority boundaries

Networking is an adapter boundary, not a reason for simulation modules to depend on one backend. Define authoritative ownership, command validation, snapshots, replication, interpolation, reconciliation, latency/staleness and disconnect behavior.

Single-player/client-local operation must work without a server. Persistent cooperative campaigns, shared state and server-authoritative multiplayer require an external service; static GitHub Pages cannot provide it.

**Status:** Architecture specification only.
