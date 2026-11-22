import { describe, expect, it } from "vitest";
import { createScopedRandom } from "../../src/core/random/SeededRandom.js";
import { computePhysicalRadarEcho, type AntennaPatternProfile } from "../../src/physics/radar/RadarPhysics.js";
import {
  advanceRadarHardware,
  deriveRadarWaveform,
  synthesizeRangeDopplerFrame,
  type RadarEquipmentConfiguration,
  type RadarHardwareThermalModel
} from "../../src/sensors/radar/RadarRuntime.js";

const antenna: AntennaPatternProfile = {
  peakGainDb: 30,
  horizontalHalfPowerBeamwidthDeg: 4,
  verticalHalfPowerBeamwidthDeg: 4,
  firstSidelobeLevelDb: -13,
  sidelobeFloorDb: -35,
  backlobeLevelDb: -45
};
const equipment: RadarEquipmentConfiguration = {
  waveform: {
    family: "pulse-doppler",
    centerFrequencyHz: 10e9,
    pulseWidthSeconds: 10e-6,
    pulseRepetitionFrequencyHz: 1000,
    receiverBandwidthHz: 1e6,
    coherentProcessingIntervalSeconds: 0.1,
    coherentIntegration: true
  },
  receiver: {
    systemTemperatureK: 290,
    noiseFigureDb: 3,
    clutterPowerPerCellW: 1e-14
  },
  antenna,
  rangeBinCount: 64,
  dopplerBinCount: 128,
  maximumDutyCycle: 0.05
};
const thermal: RadarHardwareThermalModel = {
  warmupSeconds: 0,
  maximumOperatingTemperatureK: 400,
  thermalCapacityJPerK: 1000,
  heatFractionOfElectricalInput: 0.2,
  maximumHeatRejectionW: 100,
  minimumPowerFraction: 0.5
};

describe("radar equipment lifecycle and range-Doppler input", () => {
  it("derives wavelength, pulse resolution and ambiguity limits", () => {
    const result = deriveRadarWaveform(equipment.waveform, equipment.maximumDutyCycle);
    expect(result.wavelengthM).toBeGreaterThan(0.02);
    expect(result.rangeResolutionM).toBeCloseTo(150, 0);
    expect(result.unambiguousRangeM).toBeCloseTo(149896, -1);
    expect(result.coherentPulsesPerCpi).toBe(100);
  });

  it("blocks transmissions after power loss and allows a warmed, healthy set to emit", () => {
    const initial = {
      mode: "off" as const,
      temperatureK: 300,
      warmupRemainingSeconds: 0,
      hardwareHealthFraction: 1,
      operatingTimeSeconds: 0
    };
    const noPower = advanceRadarHardware(initial, thermal, {
      enabled: true,
      ambientTemperatureK: 290,
      availableElectricalPowerW: 0,
      requestedElectricalPowerW: 100,
      availableCoolingPowerW: 100
    }, 0.1);
    expect(noPower.emissionAvailable).toBe(false);
    const powered = advanceRadarHardware(initial, thermal, {
      enabled: true,
      ambientTemperatureK: 290,
      availableElectricalPowerW: 100,
      requestedElectricalPowerW: 100,
      availableCoolingPowerW: 100
    }, 0.1);
    expect(powered.emissionAvailable).toBe(true);
    expect(powered.transmitPowerFraction).toBeGreaterThan(0);
  });

  it("places a physically generated echo into a deterministic range-Doppler frame", () => {
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
    const scene = {
      returns: [echo],
      interferencePowerW: 0,
      acquiredAtSeconds: 1,
      beamAzimuthDeg: 0,
      beamElevationDeg: 0
    };
    const first = synthesizeRangeDopplerFrame(equipment, scene, createScopedRandom(3, "r1"), 1);
    const second = synthesizeRangeDopplerFrame(equipment, scene, createScopedRandom(3, "r1"), 1);
    expect(first.powerWatts).toEqual(second.powerWatts);
    expect(first.powerWatts.some((value) => value > 1e-10)).toBe(true);
  });
});
