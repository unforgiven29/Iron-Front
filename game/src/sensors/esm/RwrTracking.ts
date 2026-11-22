import type { RwrEmitterObservation } from "./RwrRuntime.js";

export type RwrTrackStatus = "new" | "established" | "coasting";

export interface RwrTrack {
  readonly id: string;
  readonly status: RwrTrackStatus;
  readonly bearingDeg: number;
  readonly bearingRateDegPerSecond: number;
  readonly frequencyHz: number;
  readonly bandwidthHz: number;
  readonly pulseWidthSeconds: number;
  readonly pulseRepetitionFrequencyHz: number;
  readonly receivedPowerDbm: number;
  readonly classifiedEmitter: string;
  readonly classificationLibraryId: string | null;
  readonly classificationConfidence: number;
  readonly firstDetectedTimeSeconds: number;
  readonly lastDetectedTimeSeconds: number;
  readonly lastUpdateTimeSeconds: number;
  readonly hitCount: number;
  readonly missedUpdates: number;
  /** Passive ESM does not directly measure range. */
  readonly rangeEstimateM: null;
}

export interface RwrTrackingConfiguration {
  readonly bearingGateDeg: number;
  readonly bearingRateGateDegPerSecond: number;
  readonly fractionalFrequencyGate: number;
  readonly alpha: number;
  readonly maximumMissedUpdates: number;
  readonly minimumHitsToEstablish: number;
  readonly coastProcessNoiseDegPerSecond: number;
}

export interface RwrTrackingUpdate {
  readonly tracks: readonly RwrTrack[];
  readonly associatedObservationIds: readonly string[];
  readonly unassociatedObservationIds: readonly string[];
}

function wrapDegrees(angleDeg: number): number {
  return ((angleDeg % 360) + 360) % 360;
}
function signedAngleDifferenceDeg(angleDeg: number, referenceDeg: number): number {
  let difference = wrapDegrees(angleDeg) - wrapDegrees(referenceDeg);
  if (difference > 180) difference -= 360;
  if (difference < -180) difference += 360;
  return difference;
}
function validateConfiguration(config: RwrTrackingConfiguration): void {
  if (![config.bearingGateDeg, config.bearingRateGateDegPerSecond,
    config.fractionalFrequencyGate, config.coastProcessNoiseDegPerSecond].every(
      (value) => Number.isFinite(value) && value >= 0
    ) || config.bearingGateDeg <= 0 || config.bearingRateGateDegPerSecond <= 0 ||
    config.fractionalFrequencyGate <= 0 ||
    !Number.isFinite(config.alpha) || config.alpha <= 0 || config.alpha > 1 ||
    !Number.isInteger(config.maximumMissedUpdates) || config.maximumMissedUpdates < 0 ||
    !Number.isInteger(config.minimumHitsToEstablish) || config.minimumHitsToEstablish < 1) {
    throw new RangeError("RWR tracking configuration is invalid.");
  }
}

/**
 * Associates passive ESM reports using predicted bearing and RF signature features.
 * Track IDs are local contact handles only: no emitter entity ID, range or truth
 * position is used. Tracks coast through temporary missing detections.
 */
export function updateRwrTracks(
  previousTracks: readonly RwrTrack[],
  observations: readonly RwrEmitterObservation[],
  timeSeconds: number,
  config: RwrTrackingConfiguration
): RwrTrackingUpdate {
  validateConfiguration(config);
  if (!Number.isFinite(timeSeconds) || timeSeconds < 0) {
    throw new RangeError("RWR tracking time must be finite and non-negative.");
  }
  const usedObservations = new Set<string>();
  const associatedObservationIds: string[] = [];
  const nextTracks: RwrTrack[] = [];
  let nextId = previousTracks.reduce((maximum, track) => {
    const value = Number(track.id.replace(/^rwr-/, ""));
    return Number.isSafeInteger(value) ? Math.max(maximum, value) : maximum;
  }, 0) + 1;

  for (const previous of previousTracks) {
    const predictionDt = Math.max(0, timeSeconds - previous.lastUpdateTimeSeconds);
    const predictedBearing = wrapDegrees(
      previous.bearingDeg + previous.bearingRateDegPerSecond * predictionDt
    );
    let bestIndex = -1;
    let bestScore = Infinity;
    for (let index = 0; index < observations.length; index += 1) {
      const observation = observations[index]!;
      if (usedObservations.has(observation.observationId) ||
        observation.acquiredAtSeconds > timeSeconds + 1e-9) continue;
      const bearingResidual = Math.abs(
        signedAngleDifferenceDeg(observation.bearingDeg, predictedBearing)
      );
      const bearingGate = Math.min(
        180,
        config.bearingGateDeg + config.bearingRateGateDegPerSecond * predictionDt
      );
      const frequencyResidual = Math.abs(observation.frequencyHz - previous.frequencyHz) /
        Math.max(previous.frequencyHz, 1);
      if (bearingResidual > bearingGate ||
        frequencyResidual > config.fractionalFrequencyGate) continue;
      const score = bearingResidual / bearingGate +
        frequencyResidual / config.fractionalFrequencyGate;
      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    if (bestIndex < 0) {
      const missedUpdates = previous.missedUpdates + 1;
      if (missedUpdates <= config.maximumMissedUpdates) {
        nextTracks.push({
          ...previous,
          status: "coasting",
          bearingDeg: predictedBearing,
          lastUpdateTimeSeconds: timeSeconds,
          missedUpdates
        });
      }
      continue;
    }

    const observation = observations[bestIndex]!;
    const bearingResidual = signedAngleDifferenceDeg(observation.bearingDeg, predictedBearing);
    const updatedBearing = wrapDegrees(predictedBearing + config.alpha * bearingResidual);
    const observationDt = Math.max(
      1e-6,
      observation.acquiredAtSeconds - previous.lastDetectedTimeSeconds
    );
    const measuredBearingRate = signedAngleDifferenceDeg(
      observation.bearingDeg,
      previous.bearingDeg
    ) / observationDt;
    const bearingRate = previous.bearingRateDegPerSecond +
      config.alpha * (measuredBearingRate - previous.bearingRateDegPerSecond);
    const classificationMatches = observation.classificationLibraryId !== null &&
      observation.classificationLibraryId === previous.classificationLibraryId;
    const classificationConfidence = classificationMatches
      ? Math.max(previous.classificationConfidence, observation.classificationConfidence)
      : observation.classificationConfidence;
    const hitCount = previous.hitCount + 1;
    nextTracks.push({
      ...previous,
      status: hitCount >= config.minimumHitsToEstablish ? "established" : "new",
      bearingDeg: updatedBearing,
      bearingRateDegPerSecond: bearingRate,
      frequencyHz: previous.frequencyHz + config.alpha * (observation.frequencyHz - previous.frequencyHz),
      bandwidthHz: previous.bandwidthHz + config.alpha * (observation.measuredBandwidthHz - previous.bandwidthHz),
      pulseWidthSeconds: previous.pulseWidthSeconds +
        config.alpha * (observation.pulseWidthSeconds - previous.pulseWidthSeconds),
      pulseRepetitionFrequencyHz: previous.pulseRepetitionFrequencyHz +
        config.alpha * (observation.pulseRepetitionFrequencyHz - previous.pulseRepetitionFrequencyHz),
      receivedPowerDbm: previous.receivedPowerDbm +
        config.alpha * (observation.receivedPowerDbm - previous.receivedPowerDbm),
      classifiedEmitter: observation.classifiedEmitter,
      classificationLibraryId: observation.classificationLibraryId,
      classificationConfidence,
      lastDetectedTimeSeconds: observation.acquiredAtSeconds,
      lastUpdateTimeSeconds: timeSeconds,
      hitCount,
      missedUpdates: 0
    });
    usedObservations.add(observation.observationId);
    associatedObservationIds.push(observation.observationId);
  }

  for (const observation of observations) {
    if (usedObservations.has(observation.observationId) ||
      observation.acquiredAtSeconds > timeSeconds + 1e-9) continue;
    const id = "rwr-" + nextId;
    nextId += 1;
    nextTracks.push({
      id,
      status: config.minimumHitsToEstablish <= 1 ? "established" : "new",
      bearingDeg: wrapDegrees(observation.bearingDeg),
      bearingRateDegPerSecond: 0,
      frequencyHz: observation.frequencyHz,
      bandwidthHz: observation.measuredBandwidthHz,
      pulseWidthSeconds: observation.pulseWidthSeconds,
      pulseRepetitionFrequencyHz: observation.pulseRepetitionFrequencyHz,
      receivedPowerDbm: observation.receivedPowerDbm,
      classifiedEmitter: observation.classifiedEmitter,
      classificationLibraryId: observation.classificationLibraryId,
      classificationConfidence: observation.classificationConfidence,
      firstDetectedTimeSeconds: observation.acquiredAtSeconds,
      lastDetectedTimeSeconds: observation.acquiredAtSeconds,
      lastUpdateTimeSeconds: timeSeconds,
      hitCount: 1,
      missedUpdates: 0,
      rangeEstimateM: null
    });
    usedObservations.add(observation.observationId);
  }

  const unassociatedObservationIds = observations
    .filter((observation) => !associatedObservationIds.includes(observation.observationId))
    .map((observation) => observation.observationId);
  nextTracks.sort((a, b) => a.id.localeCompare(b.id));
  return { tracks: nextTracks, associatedObservationIds, unassociatedObservationIds };
}
