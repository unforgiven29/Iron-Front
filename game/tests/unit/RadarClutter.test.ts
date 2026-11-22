import { describe, expect, it } from "vitest";
import { createScopedRandom } from "../../src/core/random/SeededRandom.js";
import { generateSurfaceClutterReturns, type SurfaceClutterCell, type SurfaceClutterModel } from "../../src/physics/radar/RadarClutter.js";

const model: SurfaceClutterModel = {
  profileId: "synthetic-test-sea-surface",
  centerFrequencyHz: 10e9,
  polarization: "horizontal",
  sigmaZeroByGrazingAngle: [
    { grazingAngleDeg: 5, sigmaZeroDb: -25 },
    { grazingAngleDeg: 30, sigmaZeroDb: -30 },
    { grazingAngleDeg: 60, sigmaZeroDb: -35 },
    { grazingAngleDeg: 90, sigmaZeroDb: -40 }
  ],
  frequencyExponent: 0,
  additionalSystemLossLinear: 2,
  windCouplingFraction: 0.8,
  baseDopplerSpreadMps: 0.1,
  windDopplerSpreadFraction: 0.05
};

const cells: readonly SurfaceClutterCell[] = [
  {
    rangeM: 10_000,
    rangeResolutionM: 100,
    beamAzimuthWidthDeg: 3,
    grazingAngleDeg: 30,
    azimuthDeg: 0,
    elevationDeg: -5,
    radarToCellUnitVectorWorld: [1, 0, 0],
    platformVelocityWorldMps: [100, 0, 0],
    surfaceCurrentWorldMps: [0, 0, 0],
    windWorldMps: [0, 0, 0],
    oneWayPathTransmission: 0.8,
    illuminated: true
  },
  {
    rangeM: 12_000,
    rangeResolutionM: 100,
    beamAzimuthWidthDeg: 3,
    grazingAngleDeg: 30,
    azimuthDeg: 2,
    elevationDeg: -5,
    radarToCellUnitVectorWorld: [1, 0, 0],
    platformVelocityWorldMps: [100, 0, 0],
    surfaceCurrentWorldMps: [0, 0, 0],
    windWorldMps: [0, 0, 0],
    oneWayPathTransmission: 1,
    illuminated: false
  }
];

describe("distributed surface radar clutter", () => {
  it("generates anonymous scatterers with the correct platform-relative Doppler sign", () => {
    const result = generateSurfaceClutterReturns(model, cells, {
      transmitPowerW: 10_000,
      antennaGainDb: 30,
      scatterersPerCell: 32
    }, createScopedRandom(12, "surface-clutter"));
    expect(result.returns).toHaveLength(32);
    expect(result.diagnostics.illuminatedCells).toBe(1);
    expect(result.diagnostics.generatedScatterers).toBe(32);
    expect(result.diagnostics.totalClutterPowerW).toBeGreaterThan(0);
    expect(result.returns.every((item) => item.rangeRateMps < 0)).toBe(true);
    expect(result.returns.every((item) => item.surfaceProfileId === model.profileId)).toBe(true);
    expect("entityId" in result.returns[0]!).toBe(false);
  });

  it("reproduces a clutter CPI exactly with the same seeded noise/phase stream", () => {
    const configuration = {
      transmitPowerW: 10_000,
      antennaGainDb: 30,
      scatterersPerCell: 8
    };
    const first = generateSurfaceClutterReturns(model, cells, configuration, createScopedRandom(45, "clutter"));
    const second = generateSurfaceClutterReturns(model, cells, configuration, createScopedRandom(45, "clutter"));
    expect(first.returns).toEqual(second.returns);
    expect(first.diagnostics).toEqual(second.diagnostics);
  });

  it("rejects malformed sigma-zero profiles and impossible grazing geometry", () => {
    expect(() => generateSurfaceClutterReturns({
      ...model,
      sigmaZeroByGrazingAngle: [
        { grazingAngleDeg: 30, sigmaZeroDb: -30 },
        { grazingAngleDeg: 20, sigmaZeroDb: -20 }
      ]
    }, cells, {
      transmitPowerW: 10_000,
      antennaGainDb: 30,
      scatterersPerCell: 8
    }, createScopedRandom(1, "bad-profile"))).toThrow(RangeError);
    expect(() => generateSurfaceClutterReturns(model, [
      { ...cells[0]!, grazingAngleDeg: 0 }
    ], {
      transmitPowerW: 10_000,
      antennaGainDb: 30,
      scatterersPerCell: 8
    }, createScopedRandom(1, "bad-grazing"))).toThrow(RangeError);
  });
});
