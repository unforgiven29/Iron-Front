import {
  discriminateSeekerCandidates,
  type SeekerDiscriminationProfile,
  type SeekerFeatureObservation
} from "./SeekerDiscrimination.js";

export type SeekerArchitecture =
  | "infrared"
  | "imaging-infrared"
  | "active-radar"
  | "semi-active-radar"
  | "passive-rf"
  | "laser"
  | "command"
  | "beam-riding";

export type SeekerPhase = "search" | "acquiring" | "track" | "coast" | "failed";

export interface SeekerRuntimeConfiguration {
  readonly architecture: SeekerArchitecture;
  readonly maximumGimbalAzimuthDeg: number;
  readonly maximumGimbalElevationDeg: number;
  readonly maximumGimbalRateDegPerSecond: number;
  readonly acquisitionDwellSeconds: number;
  readonly trackMemorySeconds: number;
  readonly minimumPowerFraction: number;
  readonly minimumCoolingFraction: number;
  readonly minimumIlluminationQuality: number;
  readonly minimumCommandLinkQuality: number;
  readonly requiresExternalIllumination: boolean;
  readonly requiresCommandLink: boolean;
}

export interface SeekerResourceState {
  readonly electricalPowerFraction: number;
  readonly coolingFraction: number;
  readonly hardwareHealthFraction: number;
  readonly illuminationQuality: number;
  readonly commandLinkQuality: number;
}

export interface SeekerRuntimeState {
  readonly phase: SeekerPhase;
  readonly gimbalAzimuthDeg: number;
  readonly gimbalElevationDeg: number;
  readonly selectedMeasurementId: string | null;
  readonly acquisitionCandidateId: string | null;
  readonly acquisitionElapsedSeconds: number;
  readonly lastMeasurementTimeSeconds: number | null;
  readonly relativeTargetWeight: number;
  readonly failureReason: string | null;
}

export interface SeekerRuntimeInput {
  readonly timeSeconds: number;
  readonly deltaTimeSeconds: number;
  readonly observations: readonly SeekerFeatureObservation[];
  readonly resources: SeekerResourceState;
}

export interface SeekerRuntimeResult {
  readonly state: SeekerRuntimeState;
  readonly selectedObservation: SeekerFeatureObservation | null;
  readonly relativeTargetWeight: number;
  readonly discrimination: ReturnType<typeof discriminateSeekerCandidates>;
}

/** Moves a servo with a finite angular rate and hard travel stops. */
function moveGimbal(
  currentDeg: number,
  desiredDeg: number,
  maximumRateDegPerSecond: number,
  deltaTimeSeconds: number,
  travelLimitDeg: number
): number {
  const boundedDesired = Math.max(-travelLimitDeg, Math.min(travelLimitDeg, desiredDeg));
  const maximumStep = maximumRateDegPerSecond * deltaTimeSeconds;
  const error = boundedDesired - currentDeg;
  return Math.max(-travelLimitDeg, Math.min(
    travelLimitDeg,
    currentDeg + Math.max(-maximumStep, Math.min(maximumStep, error))
  ));
}

function validateConfiguration(config: SeekerRuntimeConfiguration): void {
  if (![config.maximumGimbalAzimuthDeg, config.maximumGimbalElevationDeg,
    config.maximumGimbalRateDegPerSecond].every((value) => Number.isFinite(value) && value > 0) ||
    !Number.isFinite(config.acquisitionDwellSeconds) || config.acquisitionDwellSeconds < 0 ||
    !Number.isFinite(config.trackMemorySeconds) || config.trackMemorySeconds < 0) {
    throw new RangeError("Seeker gimbal and timing configuration is invalid.");
  }
  for (const [name, value] of [
    ["minimumPowerFraction", config.minimumPowerFraction],
    ["minimumCoolingFraction", config.minimumCoolingFraction],
    ["minimumIlluminationQuality", config.minimumIlluminationQuality],
    ["minimumCommandLinkQuality", config.minimumCommandLinkQuality]
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new RangeError(name + " must be within [0, 1].");
    }
  }
}

function validateResources(resources: SeekerResourceState): void {
  for (const [name, value] of Object.entries(resources)) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new RangeError(name + " must be within [0, 1].");
    }
  }
}

function externalSourceAvailable(
  config: SeekerRuntimeConfiguration,
  resources: SeekerResourceState
): boolean {
  const illuminationAvailable = !config.requiresExternalIllumination ||
    resources.illuminationQuality >= config.minimumIlluminationQuality;
  const commandAvailable = !config.requiresCommandLink ||
    resources.commandLinkQuality >= config.minimumCommandLinkQuality;
  return illuminationAvailable && commandAvailable;
}

/**
 * Stateful seeker front-end lifecycle. The candidate list contains only sensor
 * observations; track labels are local return-cluster IDs and are not world IDs.
 * Cue loss, resource loss, gimbal limits and finite track memory are explicit.
 */
export function stepSeekerRuntime(
  previous: SeekerRuntimeState,
  config: SeekerRuntimeConfiguration,
  discriminationProfile: SeekerDiscriminationProfile,
  input: SeekerRuntimeInput
): SeekerRuntimeResult {
  validateConfiguration(config);
  validateResources(input.resources);
  if (!Number.isFinite(input.timeSeconds) || input.timeSeconds < 0 ||
    !Number.isFinite(input.deltaTimeSeconds) || input.deltaTimeSeconds <= 0) {
    throw new RangeError("Seeker time values must be finite and delta must be positive.");
  }
  if (![previous.gimbalAzimuthDeg, previous.gimbalElevationDeg,
    previous.acquisitionElapsedSeconds, previous.relativeTargetWeight].every(Number.isFinite) ||
    previous.acquisitionElapsedSeconds < 0 || previous.relativeTargetWeight < 0 ||
    previous.relativeTargetWeight > 1 ||
    (previous.lastMeasurementTimeSeconds !== null &&
      (!Number.isFinite(previous.lastMeasurementTimeSeconds) || previous.lastMeasurementTimeSeconds < 0))) {
    throw new RangeError("Previous seeker state is invalid.");
  }

  const discrimination = discriminateSeekerCandidates(input.observations, discriminationProfile);
  const failed = input.resources.hardwareHealthFraction <= 0;
  if (failed) {
    const state: SeekerRuntimeState = {
      ...previous,
      phase: "failed",
      selectedMeasurementId: null,
      acquisitionCandidateId: null,
      acquisitionElapsedSeconds: 0,
      failureReason: "hardware-health-exhausted"
    };
    return { state, selectedObservation: null, relativeTargetWeight: 0, discrimination };
  }

  const powered = input.resources.electricalPowerFraction >= config.minimumPowerFraction &&
    input.resources.coolingFraction >= config.minimumCoolingFraction;
  const externallySupported = externalSourceAvailable(config, input.resources);
  if (!powered || !externallySupported) {
    const age = previous.lastMeasurementTimeSeconds === null
      ? Infinity
      : input.timeSeconds - previous.lastMeasurementTimeSeconds;
    const canCoast = previous.selectedMeasurementId !== null && age <= config.trackMemorySeconds;
    const state: SeekerRuntimeState = {
      ...previous,
      phase: canCoast ? "coast" : "search",
      selectedMeasurementId: canCoast ? previous.selectedMeasurementId : null,
      acquisitionCandidateId: null,
      acquisitionElapsedSeconds: 0,
      failureReason: powered ? "external-support-unavailable" : "power-or-cooling-insufficient"
    };
    return { state, selectedObservation: null, relativeTargetWeight: 0, discrimination };
  }

  const selectedCandidate = discrimination.candidates.find((candidate) => candidate.accepted);
  const selectedObservation = selectedCandidate
    ? input.observations.find((observation) => observation.measurementId === selectedCandidate.measurementId) ?? null
    : null;

  if (previous.phase === "track" || previous.phase === "coast") {
    const existing = previous.selectedMeasurementId
      ? input.observations.find((observation) => observation.measurementId === previous.selectedMeasurementId)
      : undefined;
    const existingScore = previous.selectedMeasurementId
      ? discrimination.candidates.find((candidate) => candidate.measurementId === previous.selectedMeasurementId)
      : undefined;
    if (existing && existingScore?.accepted &&
      Math.abs(existing.azimuthFromBodyDeg) <= config.maximumGimbalAzimuthDeg &&
      Math.abs(existing.elevationFromBodyDeg) <= config.maximumGimbalElevationDeg) {
      const gimbalAzimuthDeg = moveGimbal(
        previous.gimbalAzimuthDeg, existing.azimuthFromBodyDeg,
        config.maximumGimbalRateDegPerSecond, input.deltaTimeSeconds,
        config.maximumGimbalAzimuthDeg
      );
      const gimbalElevationDeg = moveGimbal(
        previous.gimbalElevationDeg, existing.elevationFromBodyDeg,
        config.maximumGimbalRateDegPerSecond, input.deltaTimeSeconds,
        config.maximumGimbalElevationDeg
      );
      const state: SeekerRuntimeState = {
        ...previous,
        phase: "track",
        gimbalAzimuthDeg,
        gimbalElevationDeg,
        lastMeasurementTimeSeconds: input.timeSeconds,
        relativeTargetWeight: existingScore.relativeTargetWeight,
        failureReason: null
      };
      return {
        state,
        selectedObservation: existing,
        relativeTargetWeight: existingScore.relativeTargetWeight,
        discrimination
      };
    }

    const age = previous.lastMeasurementTimeSeconds === null
      ? Infinity
      : input.timeSeconds - previous.lastMeasurementTimeSeconds;
    if (previous.selectedMeasurementId !== null && age <= config.trackMemorySeconds) {
      const state: SeekerRuntimeState = {
        ...previous,
        phase: "coast",
        acquisitionCandidateId: null,
        acquisitionElapsedSeconds: 0,
        failureReason: "measurement-lost-track-memory-active"
      };
      return { state, selectedObservation: null, relativeTargetWeight: 0, discrimination };
    }
  }

  if (!selectedObservation || !selectedCandidate) {
    const state: SeekerRuntimeState = {
      ...previous,
      phase: "search",
      selectedMeasurementId: null,
      acquisitionCandidateId: null,
      acquisitionElapsedSeconds: 0,
      relativeTargetWeight: 0,
      failureReason: null
    };
    return { state, selectedObservation: null, relativeTargetWeight: 0, discrimination };
  }

  if (Math.abs(selectedObservation.azimuthFromBodyDeg) > config.maximumGimbalAzimuthDeg ||
    Math.abs(selectedObservation.elevationFromBodyDeg) > config.maximumGimbalElevationDeg) {
    const state: SeekerRuntimeState = {
      ...previous,
      phase: "search",
      acquisitionCandidateId: null,
      acquisitionElapsedSeconds: 0,
      failureReason: "gimbal-limit-exceeded"
    };
    return { state, selectedObservation: null, relativeTargetWeight: 0, discrimination };
  }

  const gimbalAzimuthDeg = moveGimbal(
    previous.gimbalAzimuthDeg, selectedObservation.azimuthFromBodyDeg,
    config.maximumGimbalRateDegPerSecond, input.deltaTimeSeconds,
    config.maximumGimbalAzimuthDeg
  );
  const gimbalElevationDeg = moveGimbal(
    previous.gimbalElevationDeg, selectedObservation.elevationFromBodyDeg,
    config.maximumGimbalRateDegPerSecond, input.deltaTimeSeconds,
    config.maximumGimbalElevationDeg
  );
  const sameCandidate = previous.acquisitionCandidateId === selectedObservation.measurementId;
  const acquisitionElapsedSeconds = sameCandidate
    ? previous.acquisitionElapsedSeconds + input.deltaTimeSeconds
    : input.deltaTimeSeconds;
  const acquired = acquisitionElapsedSeconds >= config.acquisitionDwellSeconds;
  const state: SeekerRuntimeState = {
    phase: acquired ? "track" : "acquiring",
    gimbalAzimuthDeg,
    gimbalElevationDeg,
    selectedMeasurementId: acquired ? selectedObservation.measurementId : null,
    acquisitionCandidateId: selectedObservation.measurementId,
    acquisitionElapsedSeconds,
    lastMeasurementTimeSeconds: acquired ? input.timeSeconds : previous.lastMeasurementTimeSeconds,
    relativeTargetWeight: selectedCandidate.relativeTargetWeight,
    failureReason: null
  };
  return {
    state,
    selectedObservation,
    relativeTargetWeight: selectedCandidate.relativeTargetWeight,
    discrimination
  };
}

/** Empty state for a newly powered seeker. */
export function createSeekerRuntimeState(): SeekerRuntimeState {
  return {
    phase: "search",
    gimbalAzimuthDeg: 0,
    gimbalElevationDeg: 0,
    selectedMeasurementId: null,
    acquisitionCandidateId: null,
    acquisitionElapsedSeconds: 0,
    lastMeasurementTimeSeconds: null,
    relativeTargetWeight: 0,
    failureReason: null
  };
}
