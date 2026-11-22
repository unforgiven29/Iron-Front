import { describe, expect, it } from "vitest";
import {
  applyThermalMeasurementNoise,
  computeBlackbodySpectralRadiance,
  createChaffCloudState,
  createFlareThermalState,
  evaluateChaffCloudRadarReturn,
  observeInfraredEmitters,
  stepChaffCloud,
  stepFlareThermalState,
  type ChaffCloudModel,
  type FlareThermalModel
} from "../../src/sensors/weapon-seeker/CountermeasurePhysics.js";
import { createScopedRandom } from "../../src/core/random/SeededRandom.js";

const flareModel: FlareThermalModel = {
  initialTemperatureK: 1600,
  massKg: 0.1,
  specificHeatJPerKgK: 1000,
  emittingAreaM2: 0.01,
  emissivity: 0.9,
  convectiveHeatTransferWPerM2K: 8,
  chemicalHeatReleaseW: 500,
  chemicalBurnDurationSeconds: 0.5
};

const chaffModel: ChaffCloudModel = {
  initialParticleCount: 10_000,
  particleLengthMeanM: 0.015,
  particleLengthStandardDeviationM: 0.002,
  peakSingleParticleRcsM2: 1e-4,
  resonanceFractionalBandwidth: 1,
  orientationEfficiency: 0.8,
  initialCloudRadiusM: 0.5,
  turbulentDiffusivityM2PerSecond: 10,
  cloudLifetimeSeconds: 5,
  windCouplingTimeConstantSeconds: 1,
  terminalFallSpeedMps: 1
};

describe("dynamic infrared and radar countermeasure physics", () => {
  it("models wavelength-dependent blackbody radiance and radiative flare cooling", () => {
    expect(computeBlackbodySpectralRadiance(10e-6, 1200))
      .toBeGreaterThan(computeBlackbodySpectralRadiance(10e-6, 300));
    const initial = createFlareThermalState(flareModel);
    const duringBurn = stepFlareThermalState(initial, flareModel, 290, 0.1);
    expect(duringBurn.state.temperatureK).toBeGreaterThan(initial.temperatureK);
    expect(duringBurn.chemicalInputPowerW).toBe(500);
    const afterBurn = stepFlareThermalState({
      ...duringBurn.state,
      elapsedSeconds: 1
    }, flareModel, 290, 0.1);
    expect(afterBurn.chemicalInputPowerW).toBe(0);
    expect(afterBurn.state.temperatureK).toBeLessThan(duringBurn.state.temperatureK);
    expect(afterBurn.state.cumulativeRadiatedEnergyJ).toBeGreaterThan(0);
  });

  it("produces sensor-band-specific IR observations with range and atmosphere effects", () => {
    const result = observeInfraredEmitters([{
      measurementId: "thermal-return-1",
      positionWorldM: [0, 1000, 0],
      velocityWorldMps: [0, 0, 0],
      temperatureK: 500,
      projectedAreaM2: 1,
      emissivity: 0.9,
      temperatureRateKPerSecond: -20,
      azimuthOffBoresightDeg: 3,
      elevationOffBoresightDeg: 1
    }], {
      apertureAreaM2: 1e-4,
      opticalTransmission: 0.8,
      spectralBands: [
        { minimumWavelengthM: 3e-6, maximumWavelengthM: 5e-6, relativeSensitivity: 1 },
        { minimumWavelengthM: 8e-6, maximumWavelengthM: 12e-6, relativeSensitivity: 1 }
      ],
      detectorNoisePowerW: 1e-15,
      minimumSignalPowerW: 1e-12,
      angularResolutionRad: 0.001
    }, [{
      rangeM: 1000,
      atmosphericTransmissionByBand: [0.9, 0.7],
      backgroundRadianceWPerM2SrPerM: [0, 0]
    }], 2);
    expect(result.observations).toHaveLength(1);
    expect(result.bandSignalPowerW[0]![0]).toBeGreaterThan(0);
    expect(result.bandSignalPowerW[0]![1]).toBeGreaterThan(0);
    expect(result.observations[0]!.features.thermalDecayRatePerSecond).toBe(-20);
    expect(result.observations[0]!.features.apparentAngularSizeDeg).toBeGreaterThan(0);
    expect(result.observations[0]!.azimuthOffBoresightDeg).toBe(3);
  });

  it("advects and disperses chaff while its particles decay and its RCS is wavelength selective", () => {
    const initial = createChaffCloudState([0, 0, 1000], [0, 0, 0], chaffModel);
    const cloud = stepChaffCloud(initial, chaffModel, {
      windWorldMps: [10, 0, 0]
    }, { deltaTimeSeconds: 1 });
    expect(cloud.positionWorldM[0]).toBeGreaterThan(0);
    expect(cloud.positionWorldM[2]).toBeLessThan(1000);
    expect(cloud.particleCount).toBeLessThan(initial.particleCount);
    expect(cloud.cloudRadiusM).toBeGreaterThan(initial.cloudRadiusM);

    const onResonance = evaluateChaffCloudRadarReturn(cloud, chaffModel, 10e9, [1, 0, 0]);
    const offResonance = evaluateChaffCloudRadarReturn(cloud, chaffModel, 2e9, [1, 0, 0]);
    expect(onResonance.totalRcsM2).toBeGreaterThan(offResonance.totalRcsM2);
    expect(onResonance.rangeRateMps).toBeGreaterThan(0);
    expect(onResonance.visible).toBe(true);
  });

  it("uses deterministic thermal sensor noise and preserves the temperature floor", () => {
    const first = applyThermalMeasurementNoise(500, 5, createScopedRandom(8, "flare"));
    const second = applyThermalMeasurementNoise(500, 5, createScopedRandom(8, "flare"));
    expect(first).toBe(second);
    expect(first).toBeGreaterThan(0);
  });
});
