import { describe, expect, it } from "vitest";
import { createScopedRandom } from "../../src/core/random/SeededRandom.js";
import {
  computeMonostaticEchoPower,
  computeMonostaticDopplerHz,
  computePhysicalRadarEcho,
  computeRadarInterference,
  evaluateAntennaGainDb,
  evaluateAspectRcsM2,
  sampleSwerlingRcsM2,
  type AntennaPatternProfile
} from "../../src/physics/radar/RadarPhysics.js";

const antenna: AntennaPatternProfile = {
  peakGainDb: 30,
  horizontalHalfPowerBeamwidthDeg: 4,
  verticalHalfPowerBeamwidthDeg: 4,
  firstSidelobeLevelDb: -13,
  sidelobeFloorDb: -35,
  backlobeLevelDb: -45
};

describe("shared radar RF physics", () => {
  it("evaluates a directional main beam and non-zero sidelobe/backlobe response", () => {
    const main = evaluateAntennaGainDb(antenna, 0, 0);
    const offAxis = evaluateAntennaGainDb(antenna, 4, 0);
    const back = evaluateAntennaGainDb(antenna, 120, 0);
    expect(main).toBeCloseTo(30, 10);
    expect(offAxis).toBeLessThan(main);
    expect(back).toBeCloseTo(-15, 10);
  });

  it("interpolates aspect RCS logarithmically and folds reciprocal aspects", () => {
    const profile = [
      { aspectDeg: 0, rcsM2: 1 },
      { aspectDeg: 90, rcsM2: 10 },
      { aspectDeg: 180, rcsM2: 100 }
    ] as const;
    expect(evaluateAspectRcsM2(profile, 45)).toBeCloseTo(Math.sqrt(10), 10);
    expect(evaluateAspectRcsM2(profile, 270)).toBeCloseTo(10, 10);
  });

  it("obeys the monostatic inverse-fourth-power range law", () => {
    const first = computeMonostaticEchoPower({
      transmitPowerW: 1000,
      transmitGainDb: 30,
      receiveGainDb: 30,
      frequencyHz: 10e9,
      rcsM2: 1,
      rangeM: 10000
    });
    const second = computeMonostaticEchoPower({
      transmitPowerW: 1000,
      transmitGainDb: 30,
      receiveGainDb: 30,
      frequencyHz: 10e9,
      rcsM2: 1,
      rangeM: 20000
    });
    expect(first.receivedPowerW / second.receivedPowerW).toBeCloseTo(16, 10);
    expect(first.roundTripTimeSeconds).toBeGreaterThan(0);
  });

  it("keeps Swerling 0 deterministic and makes Swerling 1 reproducible", () => {
    expect(sampleSwerlingRcsM2(2, "swerling-0", createScopedRandom(1, "test"))).toBe(2);
    const first = sampleSwerlingRcsM2(2, "swerling-1", createScopedRandom(22, "radar"));
    const second = sampleSwerlingRcsM2(2, "swerling-1", createScopedRandom(22, "radar"));
    expect(first).toBe(second);
    expect(first).toBeGreaterThan(0);
  });

  it("creates a physical echo without carrying target identity", () => {
    const echo = computePhysicalRadarEcho({
      transmitPowerW: 10000,
      frequencyHz: 10e9,
      antenna,
      targetRcsByAspect: [{ aspectDeg: 0, rcsM2: 5 }, { aspectDeg: 180, rcsM2: 1 }],
      targetAspectDeg: 0,
      rangeM: 5000,
      rangeRateMps: 100,
      azimuthDeg: 0,
      elevationDeg: 0,
      beamAzimuthDeg: 0,
      beamElevationDeg: 0,
      swerlingModel: "swerling-0"
    });
    expect(echo.receivedPowerW).toBeGreaterThan(0);
    expect(echo.dopplerHz).toBeLessThan(0);
    expect(echo.roundTripTimeSeconds).toBeGreaterThan(0);
    expect("entityId" in echo).toBe(false);
    expect(computeMonostaticDopplerHz(-100, echo.wavelengthM)).toBeGreaterThan(0);
  });

  it("integrates only in-band jammer energy and weights receive direction", () => {
    const result = computeRadarInterference({
      receiverCenterFrequencyHz: 10e9,
      receiverBandwidthHz: 20e6,
      receiverAntenna: antenna,
      receiverBeamAzimuthDeg: 0,
      receiverBeamElevationDeg: 0,
      jammers: [
        {
          transmitPowerW: 1000,
          transmitGainDb: 10,
          centerFrequencyHz: 10e9,
          bandwidthHz: 10e6,
          rangeM: 10000,
          azimuthDeg: 0,
          elevationDeg: 0
        },
        {
          transmitPowerW: 1000,
          transmitGainDb: 10,
          centerFrequencyHz: 11e9,
          bandwidthHz: 10e6,
          rangeM: 10000,
          azimuthDeg: 0,
          elevationDeg: 0
        }
      ]
    });
    expect(result.contributions[0]!.spectralOverlapFraction).toBe(1);
    expect(result.contributions[1]!.spectralOverlapFraction).toBe(0);
    expect(result.totalReceivedPowerW).toBeGreaterThan(0);
  });

  it("rejects invalid physical inputs", () => {
    expect(() => computeMonostaticEchoPower({
      transmitPowerW: -1,
      transmitGainDb: 0,
      receiveGainDb: 0,
      frequencyHz: 1e9,
      rcsM2: 1,
      rangeM: 100
    })).toThrow(RangeError);
    expect(() => evaluateAspectRcsM2([], 0)).toThrow(RangeError);
  });
});
