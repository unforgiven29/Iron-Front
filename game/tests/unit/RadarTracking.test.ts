import { describe, expect, it } from "vitest";
import { updateRadarTracks, type RadarTrackingConfiguration } from "../../src/sensors/radar/RadarTracking.js";
import type { RadarMeasurement } from "../../src/sensors/radar/RadarProcessing.js";

const config: RadarTrackingConfiguration = {
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

function measurement(id: string, time: number, rangeM = 1000): RadarMeasurement {
  return {
    measurementId: id,
    rangeBin: 10,
    dopplerBin: 10,
    rangeM,
    radialVelocityMps: 0,
    azimuthDeg: 0,
    elevationDeg: 0,
    receivedPowerW: 1e-8,
    estimatedNoisePowerW: 1e-10,
    snrDb: 20,
    rangeUncertaintyM: 5,
    radialVelocityUncertaintyMps: 1,
    azimuthUncertaintyDeg: 0.2,
    elevationUncertaintyDeg: 0.2,
    acquiredAtSeconds: time,
    probabilityOfFalseAlarm: 1e-4
  };
}

describe("radar track lifecycle", () => {
  it("initiates tentative tracks and confirms them with a later measurement", () => {
    const first = updateRadarTracks([], [measurement("m1", 0)], 0, config);
    expect(first.tracks).toHaveLength(1);
    expect(first.tracks[0]!.status).toBe("tentative");

    const second = updateRadarTracks(first.tracks, [measurement("m2", 1, 1002)], 1, config);
    expect(second.tracks).toHaveLength(1);
    expect(second.tracks[0]!.status).toBe("confirmed");
    expect(second.associatedMeasurementIds).toEqual(["m2"]);
  });

  it("coasts through missed updates and deletes after the configured limit", () => {
    const first = updateRadarTracks([], [measurement("m1", 0)], 0, config);
    const coast = updateRadarTracks(first.tracks, [], 1, config);
    expect(coast.tracks[0]!.status).toBe("coasting");
    const coastAgain = updateRadarTracks(coast.tracks, [], 2, config);
    expect(coastAgain.tracks).toHaveLength(1);
    const deleted = updateRadarTracks(coastAgain.tracks, [], 3, config);
    expect(deleted.tracks).toHaveLength(0);
  });
});
