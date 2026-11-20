# Performance and scalability tests

Measure authoritative simulation separately from rendering, streaming and transport. Capture per-tick CPU/percentiles by subsystem, frame time, long frames, memory/allocation growth, entity/projectile/particle count, radar emitters/receivers/tracks, chunk residency, save time/size and worker transfer cost.

Representative scenes: single aircraft; multi-aircraft/radar/RWR; dense SAM/emitter engagement; ground/infantry battle; artillery projectiles; urban/forest map; background campaign; long mixed mission. Include mobile/constrained browser profiles.

Do not invent budgets before baseline measurement. Record hardware/browser/build/seed/warm-up/sample method; set thresholds after measuring. Profile first. Event-driven work, spatial filtering, caching, pooling and workers are tools, not assumptions. Never silently lower detection/physics/damage fidelity to meet FPS. Compare optimized outputs with reference results.
