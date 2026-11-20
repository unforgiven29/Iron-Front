# Cross-system integration tests

Prove causal behavior through production module contracts and scheduler, not only isolated mocks. Every scenario records seed, module/config versions, initial state, commands, events, expected outputs and tolerances.

Early scenarios: capability composition; command→owner validation→event; partial electrical/hydraulic/fuel loss; fuel/store mass properties; engine thrust/resource coupling; radar emission/propagation/receiver observation plus independent RWR interception; world structure change updating collision/LOS; renderer reading snapshots; AI responding differently to stale/missing reports.

Assertions inspect authoritative state and public outputs. Include negative assertions that prohibited paths and unrelated side effects do not occur. Test reproducibility with same seed/input.
