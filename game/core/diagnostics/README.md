# Simulation diagnostics and observability

Diagnostics explain simulation behavior without becoming a second authority. Required capabilities include structured logs, tick-correlated event traces, module/dependency inspection, resource allocation views, subsystem health/fault state, performance profiling, deterministic replay capture and configuration validation reports.

Failures identify the owning module, affected capability, cause, tick, downstream consumers and recovery path where known. Keep high-volume traces configurable and bounded. Developer debug tools may inspect internal state; gameplay AI, sensors and cockpit systems must not gain hidden-state access through diagnostics.

**Status:** Architecture specification only.
