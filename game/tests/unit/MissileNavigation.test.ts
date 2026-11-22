import { describe, expect, it } from "vitest";
import { createScopedRandom } from "../../src/core/random/SeededRandom.js";
import {
  createMissileNavigationState,
  stepMissileNavigation,
  type MissileNavigationModel
} from "../../src/weapons/MissileNavigation.js";

const model: MissileNavigationModel = {
  accelerometerNoiseStdDevMps2: 0.01,
  accelerometerBiasRandomWalkMps2PerSqrtSecond: 0.001,
  maximumCorrectionAgeSeconds: 0.5,
  maximumAcceptedPositionInnovationM: 500,
  maximumAcceptedVelocityInnovationMps: 50
};

describe("missile inertial navigation and corrections", () => {
  it("dead-reckons position and velocity while uncertainty grows", () => {
    const initial = createMissileNavigationState([0, 0, 0], [100, 0, 0], 1, 0.5);
    const result = stepMissileNavigation(initial, model, {
      deltaTimeSeconds: 1,
      measuredInertialAccelerationWorldMps2: [0, 10, 0]
    }, createScopedRandom(12, "ins-drift"));
    expect(result.state.positionEstimateWorldM[0]).toBeCloseTo(100, 0);
    expect(result.state.velocityEstimateWorldMps[1]).toBeGreaterThan(9);
    expect(result.solution.positionStandardDeviationM).toBeGreaterThan(1);
    expect(result.solution.inertialAgeSeconds).toBe(1);
  });

  it("accepts a fresh GNSS/datalink correction and reduces covariance", () => {
    const initial = createMissileNavigationState([0, 0, 0], [100, 0, 0], 100, 10);
    const result = stepMissileNavigation(initial, model, {
      deltaTimeSeconds: 0.1,
      measuredInertialAccelerationWorldMps2: [0, 0, 0],
      correction: {
        source: "datalink",
        measuredAtSeconds: 0.1,
        positionWorldM: [2, 0, 0],
        velocityWorldMps: [99, 0, 0],
        positionStandardDeviationM: 2,
        velocityStandardDeviationMps: 1,
        available: true
      }
    }, createScopedRandom(4, "ins-correction"));
    expect(result.solution.correctionAccepted).toBe(true);
    expect(result.solution.correctionSource).toBe("datalink");
    expect(result.state.positionVarianceM2).toBeLessThan(initial.positionVarianceM2);
    expect(result.state.velocityVarianceM2PerS2).toBeLessThan(initial.velocityVarianceM2PerS2);
  });

  it("rejects unavailable, stale and implausible updates rather than resetting navigation", () => {
    const initial = createMissileNavigationState([0, 0, 0], [100, 0, 0], 10, 2);
    const result = stepMissileNavigation(initial, model, {
      deltaTimeSeconds: 1,
      measuredInertialAccelerationWorldMps2: [0, 0, 0],
      correction: {
        source: "gnss",
        measuredAtSeconds: 0,
        positionWorldM: [10000, 0, 0],
        velocityWorldMps: [100, 0, 0],
        positionStandardDeviationM: 1,
        velocityStandardDeviationMps: 1,
        available: true
      }
    }, createScopedRandom(5, "ins-denied"));
    expect(result.solution.correctionAccepted).toBe(false);
    expect(result.solution.correctionRejectedReason).toBe("stale");
    expect(result.state.rejectedCorrectionCount).toBe(1);
    expect(result.state.positionEstimateWorldM[0]).not.toBe(10000);
  });
});
