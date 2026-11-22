import { describe, expect, it } from "vitest";
import { createSeekerRuntimeState, stepSeekerRuntime } from "../../src/sensors/weapon-seeker/SeekerRuntime.js";
import type { SeekerDiscriminationProfile, SeekerFeatureObservation } from "../../src/sensors/weapon-seeker/SeekerDiscrimination.js";

const profile: SeekerDiscriminationProfile = {
  featureExpectations: [
    { feature: "spectralRatio", expectedMean: 1, standardDeviation: 0.2, weight: 1 },
    { feature: "thermalDecayRatePerSecond", expectedMean: 0.1, standardDeviation: 0.1, weight: 1 },
    { feature: "kinematicPredictionErrorMps", expectedMean: 0, standardDeviation: 10, weight: 1 }
  ],
  horizontalFieldOfViewDeg: 20,
  verticalFieldOfViewDeg: 20,
  minimumRangeM: 100,
  maximumRangeM: 10000,
  minimumFeatureCoverageFraction: 1,
  minimumRelativeTargetWeight: 0.1
};

const observation: SeekerFeatureObservation = {
  measurementId: "candidate-A",
  azimuthOffBoresightDeg: 2,
  elevationOffBoresightDeg: 1,
  azimuthFromBodyDeg: 2,
  elevationFromBodyDeg: 1,
  rangeM: 2000,
  features: {
    spectralRatio: 1.05,
    thermalDecayRatePerSecond: 0.08,
    kinematicPredictionErrorMps: 1
  }
};

const config = {
  architecture: "infrared" as const,
  maximumGimbalAzimuthDeg: 30,
  maximumGimbalElevationDeg: 20,
  maximumGimbalRateDegPerSecond: 100,
  acquisitionDwellSeconds: 0.15,
  trackMemorySeconds: 0.5,
  minimumPowerFraction: 0.5,
  minimumCoolingFraction: 0.5,
  minimumIlluminationQuality: 0.5,
  minimumCommandLinkQuality: 0.5,
  requiresExternalIllumination: false,
  requiresCommandLink: false
};

const resources = {
  electricalPowerFraction: 1,
  coolingFraction: 1,
  hardwareHealthFraction: 1,
  illuminationQuality: 1,
  commandLinkQuality: 1
};

describe("seeker acquisition and discrimination", () => {
  it("acquires only after dwell and retains the measured candidate", () => {
    const first = stepSeekerRuntime(createSeekerRuntimeState(), config, profile, {
      timeSeconds: 0.1,
      deltaTimeSeconds: 0.1,
      observations: [observation],
      resources
    });
    expect(first.state.phase).toBe("acquiring");
    const second = stepSeekerRuntime(first.state, config, profile, {
      timeSeconds: 0.2,
      deltaTimeSeconds: 0.1,
      observations: [observation],
      resources
    });
    expect(second.state.phase).toBe("track");
    expect(second.state.selectedMeasurementId).toBe("candidate-A");
  });

  it("coasts and then returns to search when observations disappear", () => {
    const tracked = {
      ...createSeekerRuntimeState(),
      phase: "track" as const,
      selectedMeasurementId: "candidate-A",
      lastMeasurementTimeSeconds: 1
    };
    const coast = stepSeekerRuntime(tracked, config, profile, {
      timeSeconds: 1.2,
      deltaTimeSeconds: 0.1,
      observations: [],
      resources
    });
    expect(coast.state.phase).toBe("coast");
    const search = stepSeekerRuntime(coast.state, config, profile, {
      timeSeconds: 2,
      deltaTimeSeconds: 0.1,
      observations: [],
      resources
    });
    expect(search.state.phase).toBe("search");
  });

  it("fails when seeker hardware health is exhausted", () => {
    const failed = stepSeekerRuntime(createSeekerRuntimeState(), config, profile, {
      timeSeconds: 0.1,
      deltaTimeSeconds: 0.1,
      observations: [observation],
      resources: { ...resources, hardwareHealthFraction: 0 }
    });
    expect(failed.state.phase).toBe("failed");
  });
});
