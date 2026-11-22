import { describe, expect, it } from "vitest";
import { createScopedRandom } from "../../src/core/random/SeededRandom.js";
import { measureRadarMissileSeeker, type RadarMissileSeekerRequest } from "../../src/sensors/weapon-seeker/RadarMissileSeeker.js";

const waveform = {
  centerFrequencyHz: 10e9,
  receiverBandwidthHz: 500e3,
  pulseWidthSeconds: 10e-6,
  pulseRepetitionFrequencyHz: 20e3,
  coherentProcessingIntervalSeconds: 0.005,
  probabilityOfFalseAlarm: 1e-4,
  rangeGateMinimumM: 100,
  rangeGateMaximumM: 7000,
  dopplerGateMaximumMps: 200
} as const;

const receiver = {
  antenna: {
    peakGainDb: 25,
    horizontalHalfPowerBeamwidthDeg: 20,
    verticalHalfPowerBeamwidthDeg: 20,
    firstSidelobeLevelDb: -13,
    sidelobeFloorDb: -40,
    backlobeLevelDb: -50
  },
  systemTemperatureK: 290,
  noiseFigureDb: 3,
  sensitivityDbm: -100,
  minimumDetectionSnrDb: 5,
  rangeMeasurementStandardDeviationM: 5,
  radialVelocityStandardDeviationMps: 1,
  angleMeasurementStandardDeviationDeg: 0.5,
  trackingMemorySeconds: 1
} as const;

const candidate = {
  measurementId: "seeker-measurement",
  rangeM: 5000,
  rangeRateMps: -100,
  targetAspectDeg: 0,
  targetRcsByAspect: [
    { aspectDeg: 0, rcsM2: 3 },
    { aspectDeg: 90, rcsM2: 2 },
    { aspectDeg: 180, rcsM2: 1 }
  ],
  azimuthOffBoresightDeg: 2,
  elevationOffBoresightDeg: 1,
  pathTransmission: 0.9,
  angularRateDegPerSecond: 1.5,
  apparentAngularSizeDeg: 0.2,
  thermalSpectralRatio: 0.4,
  thermalDecayRatePerSecond: 0
} as const;

const baseRequest = {
  mode: "active" as const,
  waveform,
  receiver,
  candidate,
  timeSeconds: 2
};

describe("active and semi-active radar missile seeker front end", () => {
  it("detects an active radar return and provides only noisy measurements", () => {
    const result = measureRadarMissileSeeker({
      ...baseRequest,
      activeTransmitter: {
        peakPowerW: 1000,
        systemLossLinear: 2,
        oneWayPathTransmission: 0.9
      },
      random: createScopedRandom(12, "active-seeker")
    });
    expect(result.detection).toBe(true);
    expect(result.measurement).not.toBeNull();
    expect(result.measuredRangeM).toBeCloseTo(5000, -1);
    expect(result.measuredRangeRateMps).toBeCloseTo(-100, 0);
    expect(result.radialVelocityResolutionMps).toBeCloseTo(3, 0);
    expect(result.unambiguousRangeM).toBeCloseTo(7494.8, 0);
    expect(result.measurement!.features.signalToNoiseDb).toBeGreaterThan(0);
    expect("targetEntityId" in result.measurement!).toBe(false);
  });

  it("requires an external illuminator for semi-active homing", () => {
    const unavailable = measureRadarMissileSeeker({
      ...baseRequest,
      mode: "semi-active",
      activeTransmitter: undefined,
      semiActiveIllumination: {
        available: false,
        illuminatorTransmitPowerW: 0,
        illuminatorTransmitGainDb: 0,
        illuminatorToTargetRangeM: 10_000,
        illuminatorPathTransmission: 0,
        illuminationQuality: 0
      },
      random: createScopedRandom(13, "sarh-unavailable")
    });
    expect(unavailable.detection).toBe(false);
    expect(unavailable.measurement).toBeNull();
    expect(unavailable.measuredRangeM).toBeNull();

    const illuminated = measureRadarMissileSeeker({
      ...baseRequest,
      mode: "semi-active",
      targetToSeekerRangeM: 5000,
      semiActiveIllumination: {
        available: true,
        illuminatorTransmitPowerW: 100_000,
        illuminatorTransmitGainDb: 30,
        illuminatorToTargetRangeM: 20_000,
        illuminatorPathTransmission: 0.9,
        illuminationQuality: 1
      },
      random: createScopedRandom(14, "sarh-available")
    });
    expect(illuminated.detection).toBe(true);
    expect(illuminated.illuminationQuality).toBe(1);
  });

  it("does not leak target range, angle or velocity when the signal is undetected", () => {
    const result = measureRadarMissileSeeker({
      ...baseRequest,
      activeTransmitter: {
        peakPowerW: 1e-12,
        systemLossLinear: 2,
        oneWayPathTransmission: 0.9
      },
      random: createScopedRandom(15, "active-seeker-no-detect")
    });
    expect(result.detection).toBe(false);
    expect(result.measurement).toBeNull();
    expect(result.measuredRangeM).toBeNull();
    expect(result.measuredRangeRateMps).toBeNull();
    expect(result.measuredAzimuthDeg).toBeNull();
  });

  it("enforces range and Doppler ambiguity gates", () => {
    const result = measureRadarMissileSeeker({
      ...baseRequest,
      candidate: {
        ...candidate,
        rangeM: 8000,
        rangeRateMps: 250
      },
      random: createScopedRandom(16, "seeker-ambiguity")
    });
    expect(result.detection).toBe(false);
    expect(result.measurement).toBeNull();
    expect(result.unambiguousRangeM).toBeLessThan(8000);
  });
});
