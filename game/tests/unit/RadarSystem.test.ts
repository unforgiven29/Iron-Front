import { describe, expect, it } from "vitest";
import { createScopedRandom } from "../../src/core/random/SeededRandom.js";
import { computePhysicalRadarEcho, type AntennaPatternProfile } from "../../src/physics/radar/RadarPhysics.js";
import {
  createRadarHardwareState,
  stepRadarSystem
} from "../../src/sensors/radar/RadarSystem.js";
import type { RadarEquipmentConfiguration, RadarHardwareThermalModel } from "../../src/sensors/radar/RadarRuntime.js";

const antenna: AntennaPatternProfile = {
  peakGainDb: 30,
  horizontalHalfPowerBeamwidthDeg: 3,
  verticalHalfPowerBeamwidthDeg: 3,
  firstSidelobeLevelDb: -13,
  sidelobeFloorDb: -35,
  backlobeLevelDb: -45
};
const thermal: RadarHardwareThermalModel = {
  warmupSeconds: 0,
  maximumOperatingTemperatureK: 400,
  thermalCapacityJPerK: 1000,
  heatFractionOfElectricalInput: 0.1,
  maximumHeatRejectionW: 100,
  minimumPowerFraction: 0.5
};
const equipment: RadarEquipmentConfiguration = {
  waveform: {
    family: "pulse-doppler",
    centerFrequencyHz: 10e9,
    pulseWidthSeconds: 10e-6,
    pulseRepetitionFrequencyHz: 1000,
    receiverBandwidthHz: 1e6,
    coherentProcessingIntervalSeconds: 0.016,
    coherentIntegration: true
  },
  receiver: {
    systemTemperatureK: 290,
    noiseFigureDb: 3,
    clutterPowerPerCellW: 0
  },
  antenna,
  rangeBinCount: 64,
  dopplerBinCount: 16,
  maximumDutyCycle: 0.05,
  pulseDomain: {
    sampleRateHz: 1e6,
    chirpBandwidthHz: 250e3,
    coherentPulseCount: 16,
    rangeStartM: 0,
    rangeBinCount: 60,
    fastTimeSampleCount: 128,
    horizontalBeamwidthDeg: 3,
    verticalBeamwidthDeg: 3
  }
};
const cfar = {
  guardRangeCells: 3,
  guardDopplerCells: 1,
  trainingRangeCells: 2,
  trainingDopplerCells: 2,
  probabilityOfFalseAlarm: 1e-4
};
const tracking = {
  alpha: 0.7,
  beta: 0.2,
  initialPositionVarianceM2: 100,
  initialVelocityVarianceM2PerS2: 25,
  minimumHitsToConfirm: 2,
  maximumMissedUpdates: 2,
  baseGateRadiusM: 100,
  uncertaintyGateScale: 2,
  coastProcessNoiseM2PerSecond: 10
};
const resources = {
  enabled: true,
  ambientTemperatureK: 290,
  availableElectricalPowerW: 1000,
  requestedElectricalPowerW: 1000,
  availableCoolingPowerW: 100
};

describe("end-to-end radar equipment slice", () => {
  it("transmits, range-compresses, Doppler-processes, detects and initiates a track", () => {
    const echo = computePhysicalRadarEcho({
      transmitPowerW: 10_000,
      frequencyHz: 10e9,
      antenna,
      targetRcsByAspect: [{ aspectDeg: 0, rcsM2: 3 }],
      targetAspectDeg: 0,
      rangeM: 3000,
      rangeRateMps: 0,
      azimuthDeg: 0,
      elevationDeg: 0,
      beamAzimuthDeg: 0,
      beamElevationDeg: 0
    });
    const result = stepRadarSystem({
      hardwareState: createRadarHardwareState(thermal, 300),
      thermalModel: thermal,
      resources,
      equipment,
      scene: {
        returns: [echo],
        interferencePowerW: 0,
        acquiredAtSeconds: 0.016,
        beamAzimuthDeg: 0,
        beamElevationDeg: 0
      },
      random: createScopedRandom(77, "f16-test-radar"),
      cfar,
      tracking,
      previousTracks: [],
      timeSeconds: 0.016,
      deltaTimeSeconds: 0.016
    });
    expect(result.emissionAvailable).toBe(true);
    expect(result.frame).not.toBeNull();
    expect(result.detections.length).toBeGreaterThan(0);
    expect(result.tracks.length).toBeGreaterThan(0);
    expect(result.tracks[0]!.status).toBe("tentative");
  });

  it("returns no radar frame or new detections when electrical power is lost", () => {
    const result = stepRadarSystem({
      hardwareState: createRadarHardwareState(thermal, 300),
      thermalModel: thermal,
      resources: { ...resources, availableElectricalPowerW: 0 },
      equipment,
      scene: {
        returns: [],
        interferencePowerW: 0,
        acquiredAtSeconds: 0.016,
        beamAzimuthDeg: 0,
        beamElevationDeg: 0
      },
      random: createScopedRandom(77, "radar-power-loss"),
      cfar,
      tracking,
      previousTracks: [],
      timeSeconds: 0.016,
      deltaTimeSeconds: 0.016
    });
    expect(result.emissionAvailable).toBe(false);
    expect(result.frame).toBeNull();
    expect(result.detections).toHaveLength(0);
  });
});
