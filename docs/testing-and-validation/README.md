# Testing and validation strategy

Testing is part of architecture, not a cleanup phase. No subsystem is complete from unit tests or visual demos alone.

## Layers
Schema/data; numerical unit; producer/consumer contract; real-module integration; reproducible scenario/system; regression; performance; presentation/control mapping.

## Mandatory cases
Nominal, min/max/bounds, invalid input, missing/incompatible dependency, stale input, partial/total resource loss, damage, failure/recovery, save/load, deterministic replay, state isolation and representative performance.

## Causal scenarios
Fuel burn/transfer → inventory, mass/CG/inertia and feed. Hydraulic loss → only connected actuators/gear/brakes. Electrical loss → actual consumers/indications. Engine damage → thrust/temp/fuel/signature. Store release → mass/drag and weapon runtime. Radar emission → antenna/path/scatter/receiver/processing/detection; RWR separately intercepts emission. World damage → physical collision/LOS/propagation/navigation. AI consumes only delivered reports/orders.

## Negative tests
Renderer cannot write state; sensor cannot read hidden truth; RWR cannot access radar tracks; AI cannot inspect campaign entity table; platform package cannot import another platform's private code; one resource branch cannot corrupt another; unrelated optional-module failure stays isolated; render cadence does not change authoritative outcomes.

## Reference discipline
Reference case includes exact variant/configuration, conditions, units, source/revision/page, uncertainty and tolerance. Distinguish sourced, derived, estimated, synthetic and gameplay-tuned. A fixture is not evidence of real-world fidelity.

Completion needs reproducible scenarios, causal assertions, failure cases, performance evidence and supported/unsupported conditions.
