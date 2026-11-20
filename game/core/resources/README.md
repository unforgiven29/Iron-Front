# Shared resource coordination

Coordinates allocation and dependency reporting. Domain systems still own their physical network/state (aircraft electrical buses, hydraulic circuits, fuel tanks/pumps and cooling loops).

Providers publish capacity, quality, availability, limits and transient behavior. Consumers declare demand curves, priority, minimum viable grant and fallback/degraded behavior. Allocation results include granted amount/quality, source, shortfall and reason.

Keep electrical power/voltage, hydraulic pressure/flow, fuel mass/flow, coolant/temperature and data-link quality dimensionally distinct. A derived operational flag may be shown in UI, but it cannot replace the resource model.

**Status:** Architecture specification only.
