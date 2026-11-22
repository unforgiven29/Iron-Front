import { describe, expect, it } from "vitest";
import { updateRwrTracks, type RwrTrackingConfiguration } from "../../src/sensors/esm/RwrTracking.js";
import type { RwrEmitterObservation } from "../../src/sensors/esm/RwrRuntime.js";

const config: RwrTrackingConfiguration = {
  bearingGateDeg: 8,
  bearingRateGateDegPerSecond: 10,
  fractionalFrequencyGate: 0.05,
  alpha: 0.6,
  maximumMissedUpdates: 2,
  minimumHitsToEstablish: 2,
  coastProcessNoiseDegPerSecond: 1
};

function observation(id: string, time: number, bearing: number): RwrEmitterObservation {
  return {
    observationId: id,
    acquiredAtSeconds: time,
    bearingDeg: bearing,
    bearingStandardDeviationDeg: 1,
    bearingArchitecture: "phase-interferometer",
    receivedPowerDbm: -50,
    snrDb: 30,
    frequencyHz: 10e9,
    measuredBandwidthHz: 1e6,
    pulseWidthSeconds: 10e-6,
    pulseRepetitionFrequencyHz: 1000,
    detectedPulseCount: 50,
    pulseModulation: "unmodulated",
    classifiedEmitter: "search radar",
    classificationLibraryId: "sig-a",
    classificationConfidence: 0.8,
    classificationMeaning: "unvalidated-signature-match",
    rangeEstimateM: null
  };
}

describe("bearing-only RWR track management", () => {
  it("initiates and establishes an emitter track across scans", () => {
    const first = updateRwrTracks([], [observation("o1", 0, 359)], 0, config);
    expect(first.tracks).toHaveLength(1);
    expect(first.tracks[0]!.status).toBe("new");
    expect(first.tracks[0]!.rangeEstimateM).toBeNull();

    const second = updateRwrTracks(first.tracks, [observation("o2", 1, 1)], 1, config);
    expect(second.tracks).toHaveLength(1);
    expect(second.tracks[0]!.status).toBe("established");
    expect(second.associatedObservationIds).toEqual(["o2"]);
    expect(second.tracks[0]!.bearingDeg).toBeCloseTo(0.2, 1);
  });

  it("coasts through missed intercepts and deletes after the configured limit", () => {
    const first = updateRwrTracks([], [observation("o1", 0, 20)], 0, config);
    const coast = updateRwrTracks(first.tracks, [], 1, config);
    expect(coast.tracks[0]!.status).toBe("coasting");
    const coastAgain = updateRwrTracks(coast.tracks, [], 2, config);
    expect(coastAgain.tracks).toHaveLength(1);
    const deleted = updateRwrTracks(coastAgain.tracks, [], 3, config);
    expect(deleted.tracks).toHaveLength(0);
  });

  it("does not associate incompatible frequencies or bearings", () => {
    const first = updateRwrTracks([], [observation("o1", 0, 20)], 0, config);
    const second = updateRwrTracks(first.tracks, [
      { ...observation("o2", 1, 90), frequencyHz: 12e9 }
    ], 1, config);
    expect(second.tracks).toHaveLength(2);
    expect(second.associatedObservationIds).toHaveLength(0);
  });
});
