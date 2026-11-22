import { describe, expect, it } from "vitest";
import { createScopedRandom } from "../../src/core/random/SeededRandom.js";
import { interceptRadarEmissions, type RadarEmissionSnapshot, type RwrEmitterSignature, type RwrReceiverConfiguration } from "../../src/sensors/esm/RwrRuntime.js";

const antenna = {
  peakGainDb: 30,
  horizontalHalfPowerBeamwidthDeg: 4,
  verticalHalfPowerBeamwidthDeg: 4,
  firstSidelobeLevelDb: -13,
  sidelobeFloorDb: -35,
  backlobeLevelDb: -45
} as const;

const receiver: RwrReceiverConfiguration = {
  minimumFrequencyHz: 9e9,
  maximumFrequencyHz: 11e9,
  instantaneousBandwidthHz: 2e6,
  noiseTemperatureK: 290,
  noiseFigureDb: 3,
  antennaGainDb: 0,
  sensitivityDbm: -100,
  minimumSnrDb: 10,
  observationWindowSeconds: 0.05,
  bearingArchitecture: "phase-interferometer",
  nominalBearingAccuracyDeg: 1,
  frequencyMeasurementAccuracyFraction: 1e-4,
  pulseWidthMeasurementAccuracyFraction: 0.02,
  priMeasurementAccuracyFraction: 0.01
};

const signature: RwrEmitterSignature = {
  libraryId: "test-search-radar",
  label: "search radar (test signature)",
  minimumFrequencyHz: 9.9e9,
  maximumFrequencyHz: 10.1e9,
  minimumBandwidthHz: 500e3,
  maximumBandwidthHz: 1.5e6,
  minimumPulseWidthSeconds: 5e-6,
  maximumPulseWidthSeconds: 15e-6,
  minimumPrfHz: 900,
  maximumPrfHz: 1100,
  modulation: "unmodulated"
};

const emission: RadarEmissionSnapshot = {
  positionWorldM: [0, 10_000, 0],
  frequencyHz: 10e9,
  bandwidthHz: 1e6,
  peakTransmitPowerW: 10_000,
  transmitAntenna: antenna,
  beamAzimuthWorldDeg: 180,
  beamElevationWorldDeg: 0,
  pulseWidthSeconds: 10e-6,
  pulseRepetitionFrequencyHz: 1000,
  pulseModulation: "unmodulated",
  beamOnReceiverFraction: 1,
  pathTransmissionFraction: 1,
  transmitting: true
};

describe("passive RWR/ESM interception", () => {
  it("detects an in-band radar, estimates bearing and classifies its measured signature", () => {
    const result = interceptRadarEmissions(
      receiver,
      [0, 0, 0],
      0,
      [emission],
      [signature],
      1,
      createScopedRandom(31, "rwr-test")
    );
    expect(result.observations).toHaveLength(1);
    const observation = result.observations[0]!;
    expect(observation.bearingDeg).toBeCloseTo(0, 0);
    expect(observation.bearingArchitecture).toBe("phase-interferometer");
    expect(observation.detectedPulseCount).toBe(50);
    expect(observation.classifiedEmitter).toBe("search radar (test signature)");
    expect(observation.classificationConfidence).toBe(1);
    expect(observation.rangeEstimateM).toBeNull();
    expect("emitterEntityId" in observation).toBe(false);
  });

  it("rejects emissions outside the receiver tuning band and low-SNR emitters", () => {
    const outOfBand = interceptRadarEmissions(
      receiver,
      [0, 0, 0],
      0,
      [{ ...emission, frequencyHz: 12e9 }],
      [signature],
      1,
      createScopedRandom(1, "rwr-out-of-band")
    );
    expect(outOfBand.observations).toHaveLength(0);
    expect(outOfBand.rejectedEmissionCount).toBe(1);

    const lowPower = interceptRadarEmissions(
      receiver,
      [0, 0, 0],
      0,
      [{ ...emission, peakTransmitPowerW: 1e-8 }],
      [signature],
      1,
      createScopedRandom(1, "rwr-weak")
    );
    expect(lowPower.observations).toHaveLength(0);
    expect(lowPower.rejectedEmissionCount).toBe(1);
  });

  it("requires enough intercepted pulses in the observation window", () => {
    const result = interceptRadarEmissions(
      { ...receiver, observationWindowSeconds: 0.001 },
      [0, 0, 0],
      0,
      [{ ...emission, beamOnReceiverFraction: 0.01 }],
      [signature],
      1,
      createScopedRandom(2, "rwr-no-pulses")
    );
    expect(result.observations).toHaveLength(0);
    expect(result.rejectedEmissionCount).toBe(1);
  });

  it("uses deterministic receiver measurement noise for equal seeds", () => {
    const first = interceptRadarEmissions(
      receiver, [0, 0, 0], 0, [emission], [signature], 4,
      createScopedRandom(9, "repeat-rwr")
    );
    const second = interceptRadarEmissions(
      receiver, [0, 0, 0], 0, [emission], [signature], 4,
      createScopedRandom(9, "repeat-rwr")
    );
    expect(first.observations).toEqual(second.observations);
  });
});
