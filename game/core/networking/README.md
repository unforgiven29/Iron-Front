# Networking and authority adapters

**Owner:** game/core/networking for transport and replication boundary. **Status:** no network runtime/backend is implemented.

Keep physical simulation transport-agnostic. Local single-player must work without server access. Before multiplayer, define entity authority, command authorization, snapshot replication, interpolation/reconciliation, latency/staleness and transfer of ownership. Never permit two peers to authoritatively advance the same entity.

Messages carry version, sequence, simulation tick, source, acknowledgement/expiry where needed and distinct wall-clock receive metadata. Handle loss, duplication, reordering, disconnect/reconnect, incompatible versions and partial replication. Do not compare wall-clock time with simulation time without an explicit conversion.

GitHub Pages hosts static client assets but cannot provide persistent authoritative cooperative campaigns. Such a feature needs an external backend adapter and security model. Test authority violation, latency/loss/reordering, reconnect/resync and local mode with networking absent.
