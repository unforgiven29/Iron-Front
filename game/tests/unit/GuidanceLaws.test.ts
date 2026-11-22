import { describe, expect, it } from "vitest";
import {
  computeAugmentedProportionalNavigation,
  computeProportionalNavigation,
  computePurePursuitCommand,
  type GuidanceStateEstimate,
  type ProportionalNavigationConfiguration
} from "../../src/physics/guidance/GuidanceLaws.js";

const estimate: GuidanceStateEstimate = {
  missilePositionWorldM: [0, 0, 0],
  missileVelocityWorldMps: [0, 300, 0],
  targetPositionEstimateWorldM: [1000, 5000, 100],
  targetVelocityEstimateWorldMps: [50, 250, 0],
  estimateTimeSeconds: 2,
  measurementAgeSeconds: 0.05,
  positionStandardDeviationM: 10,
  velocityStandardDeviationMps: 2
};

const config: ProportionalNavigationConfiguration = {
  navigationConstant: 3,
  maximumCommandedAccelerationMps2: 150,
  maximumMeasurementAgeSeconds: 0.5,
  maximumPositionUncertaintyM: 100,
  minimumEngagementRangeM: 10
};

describe("uncertainty-aware missile guidance laws", () => {
  it("generates bounded PN commands from closing target estimates", () => {
    const command = computeProportionalNavigation(estimate, config);
    expect(command.valid).toBe(true);
    expect(command.closingSpeedMps).toBeGreaterThan(0);
    expect(command.commandMagnitudeMps2).toBeLessThanOrEqual(150 + 1e-9);
    expect(command.commandMagnitudeMps2).toBeGreaterThan(0);
  });

  it("rejects stale, uncertain and non-closing estimates", () => {
    expect(computeProportionalNavigation({ ...estimate, measurementAgeSeconds: 2 }, config).reason)
      .toBe("stale-measurement");
    expect(computeProportionalNavigation({ ...estimate, positionStandardDeviationM: 1000 }, config).reason)
      .toBe("uncertain-estimate");
    expect(computeProportionalNavigation({
      ...estimate,
      targetVelocityEstimateWorldMps: [-50, 500, 0]
    }, config).reason).toBe("not-closing");
  });

  it("provides distinct APN and pursuit outputs", () => {
    const augmented = computeAugmentedProportionalNavigation({
      ...estimate,
      targetAccelerationEstimateWorldMps2: [0, 0, 10]
    }, config);
    const pursuit = computePurePursuitCommand(estimate, config);
    expect(augmented.valid).toBe(true);
    expect(pursuit.valid).toBe(true);
    expect(augmented.commandedAccelerationWorldMps2).not.toEqual(pursuit.commandedAccelerationWorldMps2);
  });
});
