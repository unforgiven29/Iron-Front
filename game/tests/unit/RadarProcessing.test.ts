import { describe, expect, it } from "vitest";
import { detectCaCfar, type RadarRangeDopplerFrame } from "../../src/sensors/radar/RadarProcessing.js";

function makeFrame(): RadarRangeDopplerFrame {
  const rangeBins = 21;
  const dopplerBins = 21;
  const powerWatts = Array.from({ length: rangeBins * dopplerBins }, () => 1e-12);
  powerWatts[10 * dopplerBins + 10] = 1e-6;
  return {
    rangeBins,
    dopplerBins,
    powerWatts,
    rangeStartM: 500,
    rangeResolutionM: 100,
    radialVelocityStartMps: -10,
    radialVelocityResolutionMps: 1,
    beamAzimuthDeg: 2,
    beamElevationDeg: 1,
    acquiredAtSeconds: 4,
    coherentProcessingIntervalSeconds: 0.1,
    wavelengthM: 0.03,
    horizontalBeamwidthDeg: 3,
    verticalBeamwidthDeg: 3
  };
}

describe("2D CA-CFAR radar detection", () => {
  it("detects a strong isolated range-Doppler cell and reports uncertainty", () => {
    const detections = detectCaCfar(makeFrame(), {
      guardRangeCells: 1,
      guardDopplerCells: 1,
      trainingRangeCells: 2,
      trainingDopplerCells: 2,
      probabilityOfFalseAlarm: 1e-4
    });
    expect(detections).toHaveLength(1);
    expect(detections[0]!.rangeM).toBe(1500);
    expect(detections[0]!.radialVelocityMps).toBe(0);
    expect(detections[0]!.snrDb).toBeGreaterThan(50);
    expect(detections[0]!.rangeUncertaintyM).toBeGreaterThan(0);
    expect(detections[0]!.azimuthDeg).toBe(2);
  });

  it("does not create contacts from an all-zero receiver frame", () => {
    const frame = makeFrame();
    const empty = { ...frame, powerWatts: frame.powerWatts.map(() => 0) };
    expect(detectCaCfar(empty, {
      guardRangeCells: 1,
      guardDopplerCells: 1,
      trainingRangeCells: 2,
      trainingDopplerCells: 2,
      probabilityOfFalseAlarm: 1e-4
    })).toHaveLength(0);
  });

  it("rejects undersized grids and invalid false-alarm probabilities", () => {
    const frame = makeFrame();
    expect(() => detectCaCfar({ ...frame, rangeBins: 1 }, {
      guardRangeCells: 1,
      guardDopplerCells: 1,
      trainingRangeCells: 1,
      trainingDopplerCells: 1,
      probabilityOfFalseAlarm: 1e-3
    })).toThrow(RangeError);
    expect(() => detectCaCfar(frame, {
      guardRangeCells: 1,
      guardDopplerCells: 1,
      trainingRangeCells: 1,
      trainingDopplerCells: 1,
      probabilityOfFalseAlarm: 1
    })).toThrow(RangeError);
  });
});
