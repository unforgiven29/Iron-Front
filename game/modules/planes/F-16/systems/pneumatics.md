# F-16C Block 50 — pneumatic and emergency gear functions

**Shared owner:** [game/systems/pneumatics](../../../../systems/pneumatics/README.md). **Status:** narrowly scoped source outline; do not invent a complete independent pneumatic architecture without the exact installation documentation.

The Block 50/52+ flight manual describes pneumatic landing-gear extension as the alternate deployment method if hydraulic System B fails. Treat this as a separate emergency mechanism/path, not as System B backup pressure and not as proof that the aircraft uses the same general pneumatic architecture as other fighters.

## Required behavior

- Store emergency deployment energy/pressure in the documented fitted device(s), with finite initial charge, leakage, temperature and servicing state.
- Emergency command/handle operates the actual deployment sequence and release/valve/lock mechanism defined by the selected aircraft source.
- Normal hydraulic gear operation remains controlled by the hydraulic System B path.
- Pneumatic emergency deployment must not restore System B pressure, brakes, nose-wheel steering or unrelated utility functions.
- Gear position/lock indications are produced by the actual sensors and powered indication circuits. A mechanical deployed gear can exist while its indicator is unpowered or failed.
- A deployment device must not recharge itself in flight unless the exact installation documents an operating recharge source.

## Information still required

Confirm the precise F110 Block 50 installation, bottle/accumulator type and capacity, gas/pressure, valves, routing, emergency handle/guard logic, deployment sequencing, door behavior, gear locking, permitted post-deployment operation and servicing. Do not invent numeric pressure or bottle volume.

## Acceptance

Demonstrate normal hydraulic extension, System B loss, emergency pneumatic deployment, partial deployment or insufficient reserve, mechanical down-lock, failed indication, and the fact that normal retraction/utility functions are not restored unless a documented path permits them.
