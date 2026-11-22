import { describe, expect, it } from "vitest";
import { createScopedRandom } from "../../src/core/random/SeededRandom.js";
import { simulatePulseDopplerCpi, transformComplexRadix2 } from "../../src/sensors/radar/PulseDopplerSimulation.js";

const waveform = {
  centerFrequencyHz: 10e9,
  sampleRateHz: 1e6,
  pulseWidthSeconds: 8e-6,
  chirpBandwidthHz: 250e3,
  pulseRepetitionIntervalSeconds: 1e-3,
  coherentPulseCount: 16,
  rangeStartM: 0,
  rangeBinCount: 60,
  fastTimeSampleCount: 128,
  receiverNoisePowerPerComplexSampleW: 1e-10,
  interferencePowerPerComplexSampleW: 0,
  horizontalBeamwidthDeg: 3,
  verticalBeamwidthDeg: 3
} as const;

describe("pulse-by-pulse complex radar simulation", () => {
  it("range-compresses echoes and resolves receding Doppler with the documented sign", () => {
    const result = simulatePulseDopplerCpi(waveform, {
      scatterers: [{
        receivedPowerW: 1e-5,
        rangeM: 3000,
        rangeRateMps: 1,
        phaseRadians: 0
      }],
      interferers: [],
      acquiredAtSeconds: 0.2,
      beamAzimuthDeg: 0,
      beamElevationDeg: 0
    }, createScopedRandom(42, "pulse-doppler-test"));
    expect(result.frame.rangeBins).toBe(60);
    expect(result.frame.dopplerBins).toBe(16);
    expect(result.diagnostics.generatedIqSampleCount).toBe(16 * 128);
    const targetRangeBin = 20;
    const row = result.frame.powerWatts.slice(
      targetRangeBin * result.frame.dopplerBins,
      (targetRangeBin + 1) * result.frame.dopplerBins
    );
    const strongestDopplerBin = row.indexOf(Math.max(...row));
    const measuredRadialVelocity = result.frame.radialVelocityStartMps +
      strongestDopplerBin * result.frame.radialVelocityResolutionMps;
    expect(result.frame.rangeStartM + targetRangeBin * result.frame.rangeResolutionM)
      .toBeCloseTo(3000, -1);
    expect(measuredRadialVelocity).toBeGreaterThan(0);
    expect(measuredRadialVelocity).toBeCloseTo(1, 0);
  });

  it("is deterministic for the same seeded receiver-noise stream", () => {
    const scene = {
      scatterers: [{
        receivedPowerW: 1e-6,
        rangeM: 2000,
        rangeRateMps: -2,
        phaseRadians: 0.3
      }],
      interferers: [],
      acquiredAtSeconds: 2,
      beamAzimuthDeg: 0,
      beamElevationDeg: 0
    } as const;
    const first = simulatePulseDopplerCpi(waveform, scene, createScopedRandom(7, "same"));
    const second = simulatePulseDopplerCpi(waveform, scene, createScopedRandom(7, "same"));
    expect(Array.from(first.frame.powerWatts)).toEqual(Array.from(second.frame.powerWatts));
    expect(Array.from(first.receivedIq)).toEqual(Array.from(second.receivedIq));
  });

  it("places coherent interferer energy across range cells and rejects invalid FFT shapes", () => {
    const result = simulatePulseDopplerCpi(waveform, {
      scatterers: [],
      interferers: [{
        receivedPowerW: 1e-4,
        frequencyOffsetHz: 1000,
        phaseRadians: 0
      }],
      acquiredAtSeconds: 0,
      beamAzimuthDeg: 0,
      beamElevationDeg: 0
    }, createScopedRandom(9, "jammer"));
    expect(result.frame.powerWatts.some((value) => value > 0)).toBe(true);
    expect(() => transformComplexRadix2([1, 2, 3], [0, 0, 0])).toThrow(RangeError);
  });
});
