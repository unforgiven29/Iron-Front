/** F-16 settings for the shared steady-state performance calculator. */
import type { PerformanceOptions } from "../common/Performance.js";
import { F16_ACTUATORS } from "./F16Data.js";

export const F16_PERFORMANCE_OPTIONS: PerformanceOptions = {
  pitchSurfaceId: "elevator",
  pitchSurfaceLimitDeg: F16_ACTUATORS.elevatorLimitDeg.value,
  // Steady-state LEF schedule (the lead-lag filter has no effect in steady flight).
  devices: (alpha, q, ps) => ({ lef: Math.max(0, Math.min(25, 1.38 * (alpha * 180 / Math.PI) - (9.05 * q) / ps + 1.45)) })
};
