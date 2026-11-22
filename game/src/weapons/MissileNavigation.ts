import type { SeededRandom } from "../core/random/SeededRandom.js";
import type { GuidanceStateEstimate, Vector3 } from "../physics/guidance/GuidanceLaws.js";

export type NavigationCorrectionSource = "gnss" | "datalink";

export interface MissileNavigationModel {
  readonly accelerometerNoiseStdDevMps2: number;
  readonly accelerometerBiasRandomWalkMps2PerSqrtSecond: number;
  readonly maximumCorrectionAgeSeconds: number;
  readonly maximumAcceptedPositionInnovationM: number;
  readonly maximumAcceptedVelocityInnovationMps: number;
}

export interface MissileNavigationFix {
  readonly source: NavigationCorrectionSource;
  readonly measuredAtSeconds: number;
  readonly positionWorldM: Vector3;
  readonly velocityWorldMps: Vector3;
  readonly positionStandardDeviationM: number;
  readonly velocityStandardDeviationMps: number;
  readonly available: boolean;
}

export interface MissileNavigationState {
  readonly positionEstimateWorldM: Vector3;
  readonly velocityEstimateWorldMps: Vector3;
  readonly accelerometerBiasWorldMps2: Vector3;
  readonly positionVarianceM2: number;
  readonly velocityVarianceM2PerS2: number;
  readonly currentTimeSeconds: number;
  readonly lastCorrectionTimeSeconds: number | null;
  readonly lastCorrectionSource: NavigationCorrectionSource | null;
  readonly rejectedCorrectionCount: number;
  readonly acceptedCorrectionCount: number;
}

export interface MissileNavigationInput {
  readonly deltaTimeSeconds: number;
  readonly measuredInertialAccelerationWorldMps2: Vector3;
  readonly correction?: MissileNavigationFix;
}

export interface MissileNavigationSolution {
  readonly positionWorldM: Vector3;
  readonly velocityWorldMps: Vector3;
  readonly positionStandardDeviationM: number;
  readonly velocityStandardDeviationMps: number;
  readonly inertialAgeSeconds: number;
  readonly correctionSource: NavigationCorrectionSource | null;
  readonly correctionAccepted: boolean;
  readonly correctionRejectedReason:
    | "none"
    | "unavailable"
    | "stale"
    | "future-dated"
    | "invalid-uncertainty"
    | "position-innovation"
    | "velocity-innovation";
}

function validateVector(vector: Vector3, name: string): void {
  if (!vector.every(Number.isFinite)) throw new RangeError(name + " must contain finite components.");
}

function add(a: Vector3, b: Vector3): Vector3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function subtract(a: Vector3, b: Vector3): Vector3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(vector: Vector3, scalar: number): Vector3 {
  return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}

function magnitude(vector: Vector3): number {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function kalmanCorrectVector(
  estimate: Vector3,
  estimateVariance: number,
  observation: Vector3,
  observationVariance: number
): { readonly value: Vector3; readonly variance: number } {
  const gain = estimateVariance / (estimateVariance + observationVariance);
  return {
    value: add(estimate, scale(subtract(observation, estimate), gain)),
    variance: Math.max(0, (1 - gain) * estimateVariance)
  };
}

function validateModel(model: MissileNavigationModel): void {
  if (!Number.isFinite(model.accelerometerNoiseStdDevMps2) || model.accelerometerNoiseStdDevMps2 < 0 ||
    !Number.isFinite(model.accelerometerBiasRandomWalkMps2PerSqrtSecond) ||
    model.accelerometerBiasRandomWalkMps2PerSqrtSecond < 0 ||
    !Number.isFinite(model.maximumCorrectionAgeSeconds) || model.maximumCorrectionAgeSeconds < 0 ||
    !Number.isFinite(model.maximumAcceptedPositionInnovationM) || model.maximumAcceptedPositionInnovationM <= 0 ||
    !Number.isFinite(model.maximumAcceptedVelocityInnovationMps) || model.maximumAcceptedVelocityInnovationMps <= 0) {
    throw new RangeError("Missile navigation model is invalid.");
  }
}

/** Initializes the inertial navigation state from the launcher alignment solution. */
export function createMissileNavigationState(
  positionWorldM: Vector3,
  velocityWorldMps: Vector3,
  initialPositionStandardDeviationM: number,
  initialVelocityStandardDeviationMps: number,
  currentTimeSeconds = 0,
  accelerometerBiasWorldMps2: Vector3 = [0, 0, 0]
): MissileNavigationState {
  validateVector(positionWorldM, "Initial position");
  validateVector(velocityWorldMps, "Initial velocity");
  validateVector(accelerometerBiasWorldMps2, "Accelerometer bias");
  if (![initialPositionStandardDeviationM, initialVelocityStandardDeviationMps, currentTimeSeconds]
    .every(Number.isFinite) || initialPositionStandardDeviationM <= 0 ||
    initialVelocityStandardDeviationMps <= 0 || currentTimeSeconds < 0) {
    throw new RangeError("Initial missile navigation uncertainty/time is invalid.");
  }
  return {
    positionEstimateWorldM: positionWorldM,
    velocityEstimateWorldMps,
    accelerometerBiasWorldMps2,
    positionVarianceM2: initialPositionStandardDeviationM ** 2,
    velocityVarianceM2PerS2: initialVelocityStandardDeviationMps ** 2,
    currentTimeSeconds,
    lastCorrectionTimeSeconds: null,
    lastCorrectionSource: null,
    rejectedCorrectionCount: 0,
    acceptedCorrectionCount: 0
  };
}

/**
 * Dead-reckons the missile state and optionally fuses a delayed GNSS/datalink fix.
 * Sensor bias/noise and covariance grow during update denial; stale corrections
 * cannot silently reset the solution. This is a navigation estimate, not truth.
 */
export function stepMissileNavigation(
  previous: MissileNavigationState,
  model: MissileNavigationModel,
  input: MissileNavigationInput,
  random: SeededRandom
): { readonly state: MissileNavigationState; readonly solution: MissileNavigationSolution } {
  validateModel(model);
  validateVector(previous.positionEstimateWorldM, "Previous position");
  validateVector(previous.velocityEstimateWorldMps, "Previous velocity");
  validateVector(previous.accelerometerBiasWorldMps2, "Previous accelerometer bias");
  validateVector(input.measuredInertialAccelerationWorldMps2, "Measured acceleration");
  if (!Number.isFinite(input.deltaTimeSeconds) || input.deltaTimeSeconds <= 0 ||
    !Number.isFinite(previous.currentTimeSeconds) || previous.currentTimeSeconds < 0 ||
    !Number.isFinite(previous.positionVarianceM2) || previous.positionVarianceM2 < 0 ||
    !Number.isFinite(previous.velocityVarianceM2PerS2) || previous.velocityVarianceM2PerS2 < 0) {
    throw new RangeError("Missile navigation state or time step is invalid.");
  }

  const dt = input.deltaTimeSeconds;
  const timeSeconds = previous.currentTimeSeconds + dt;
  const biasWalkSigma = model.accelerometerBiasRandomWalkMps2PerSqrtSecond * Math.sqrt(dt);
  const accelerometerBiasWorldMps2: Vector3 = [
    previous.accelerometerBiasWorldMps2[0] + biasWalkSigma * gaussian(random),
    previous.accelerometerBiasWorldMps2[1] + biasWalkSigma * gaussian(random),
    previous.accelerometerBiasWorldMps2[2] + biasWalkSigma * gaussian(random)
  ];
  const accelerationNoiseSigma = model.accelerometerNoiseStdDevMps2;
  const measuredAccelerationWithBias: Vector3 = [
    input.measuredInertialAccelerationWorldMps2[0] + accelerometerBiasWorldMps2[0] +
      accelerationNoiseSigma * gaussian(random),
    input.measuredInertialAccelerationWorldMps2[1] + accelerometerBiasWorldMps2[1] +
      accelerationNoiseSigma * gaussian(random),
    input.measuredInertialAccelerationWorldMps2[2] + accelerometerBiasWorldMps2[2] +
      accelerationNoiseSigma * gaussian(random)
  ];
  const velocityEstimateWorldMps = add(
    previous.velocityEstimateWorldMps,
    scale(measuredAccelerationWithBias, dt)
  );
  const positionEstimateWorldM = add(
    previous.positionEstimateWorldM,
    add(
      scale(previous.velocityEstimateWorldMps, dt),
      scale(measuredAccelerationWithBias, 0.5 * dt * dt)
    )
  );
  const accelerationVariance = model.accelerometerNoiseStdDevMps2 ** 2 +
    model.accelerometerBiasRandomWalkMps2PerSqrtSecond ** 2;
  let positionVarianceM2 = previous.positionVarianceM2 +
    previous.velocityVarianceM2PerS2 * dt * dt +
    accelerationVariance * dt ** 4 / 4;
  let velocityVarianceM2PerS2 = previous.velocityVarianceM2PerS2 +
    accelerationVariance * dt * dt;

  let position = positionEstimateWorldM;
  let velocity = velocityEstimateWorldMps;
  let acceptedCorrection = false;
  let correctionRejectedReason: MissileNavigationSolution["correctionRejectedReason"] = "none";
  let lastCorrectionTimeSeconds = previous.lastCorrectionTimeSeconds;
  let lastCorrectionSource = previous.lastCorrectionSource;
  let rejectedCorrectionCount = previous.rejectedCorrectionCount;
  let acceptedCorrectionCount = previous.acceptedCorrectionCount;

  if (input.correction) {
    const fix = input.correction;
    validateVector(fix.positionWorldM, "Correction position");
    validateVector(fix.velocityWorldMps, "Correction velocity");
    if (!fix.available) correctionRejectedReason = "unavailable";
    else if (!Number.isFinite(fix.measuredAtSeconds) || fix.measuredAtSeconds > timeSeconds + 1e-9) {
      correctionRejectedReason = "future-dated";
    } else if (timeSeconds - fix.measuredAtSeconds > model.maximumCorrectionAgeSeconds) {
      correctionRejectedReason = "stale";
    } else if (![fix.positionStandardDeviationM, fix.velocityStandardDeviationMps].every(
      (value) => Number.isFinite(value) && value > 0
    )) {
      correctionRejectedReason = "invalid-uncertainty";
    } else if (magnitude(subtract(fix.positionWorldM, position)) > model.maximumAcceptedPositionInnovationM) {
      correctionRejectedReason = "position-innovation";
    } else if (magnitude(subtract(fix.velocityWorldMps, velocity)) > model.maximumAcceptedVelocityInnovationMps) {
      correctionRejectedReason = "velocity-innovation";
    } else {
      const correctedPosition = kalmanCorrectVector(
        position,
        positionVarianceM2,
        fix.positionWorldM,
        fix.positionStandardDeviationM ** 2
      );
      const correctedVelocity = kalmanCorrectVector(
        velocity,
        velocityVarianceM2PerS2,
        fix.velocityWorldMps,
        fix.velocityStandardDeviationMps ** 2
      );
      position = correctedPosition.value;
      velocity = correctedVelocity.value;
      positionVarianceM2 = correctedPosition.variance;
      velocityVarianceM2PerS2 = correctedVelocity.variance;
      acceptedCorrection = true;
      lastCorrectionTimeSeconds = fix.measuredAtSeconds;
      lastCorrectionSource = fix.source;
      acceptedCorrectionCount += 1;
    }
    if (!acceptedCorrection) rejectedCorrectionCount += 1;
  }

  const state: MissileNavigationState = {
    positionEstimateWorldM: position,
    velocityEstimateWorldMps: velocity,
    accelerometerBiasWorldMps2,
    positionVarianceM2,
    velocityVarianceM2PerS2,
    currentTimeSeconds: timeSeconds,
    lastCorrectionTimeSeconds,
    lastCorrectionSource,
    rejectedCorrectionCount,
    acceptedCorrectionCount
  };
  const inertialAgeSeconds = lastCorrectionTimeSeconds === null
    ? timeSeconds
    : timeSeconds - lastCorrectionTimeSeconds;
  return {
    state,
    solution: {
      positionWorldM: position,
      velocityWorldMps: velocity,
      positionStandardDeviationM: Math.sqrt(positionVarianceM2),
      velocityStandardDeviationMps: Math.sqrt(velocityVarianceM2PerS2),
      inertialAgeSeconds,
      correctionSource: lastCorrectionSource,
      correctionAccepted: acceptedCorrection,
      correctionRejectedReason
    }
  };
}

function gaussian(random: SeededRandom): number {
  const first = Math.max(Number.MIN_VALUE, 1 - random.nextFloat());
  const second = random.nextFloat();
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}


export interface TargetNavigationEstimate {
  readonly positionWorldM: Vector3;
  readonly velocityWorldMps: Vector3;
  readonly measurementAgeSeconds: number;
  readonly positionStandardDeviationM: number;
  readonly velocityStandardDeviationMps: number;
  readonly targetAccelerationEstimateWorldMps2?: Vector3;
}

/** Combines missile INS uncertainty and an external target-track estimate for guidance. */
export function composeGuidanceStateEstimate(
  missileNavigation: MissileNavigationSolution,
  target: TargetNavigationEstimate,
  currentTimeSeconds: number
): GuidanceStateEstimate {
  validateVector(target.positionWorldM, "Target estimate position");
  validateVector(target.velocityWorldMps, "Target estimate velocity");
  if (!Number.isFinite(currentTimeSeconds) || currentTimeSeconds < 0 ||
    !Number.isFinite(target.measurementAgeSeconds) || target.measurementAgeSeconds < 0 ||
    !Number.isFinite(target.positionStandardDeviationM) || target.positionStandardDeviationM < 0 ||
    !Number.isFinite(target.velocityStandardDeviationMps) || target.velocityStandardDeviationMps < 0) {
    throw new RangeError("Target navigation estimate metadata is invalid.");
  }
  if (target.targetAccelerationEstimateWorldMps2) {
    validateVector(target.targetAccelerationEstimateWorldMps2, "Target acceleration estimate");
  }
  return {
    missilePositionWorldM: missileNavigation.positionWorldM,
    missileVelocityWorldMps: missileNavigation.velocityWorldMps,
    targetPositionEstimateWorldM: target.positionWorldM,
    targetVelocityEstimateWorldMps: target.velocityWorldMps,
    estimateTimeSeconds: currentTimeSeconds,
    measurementAgeSeconds: target.measurementAgeSeconds,
    positionStandardDeviationM: Math.hypot(
      missileNavigation.positionStandardDeviationM,
      target.positionStandardDeviationM
    ),
    velocityStandardDeviationMps: Math.hypot(
      missileNavigation.velocityStandardDeviationMps,
      target.velocityStandardDeviationMps
    ),
    ...(target.targetAccelerationEstimateWorldMps2 === undefined ? {} : {
      targetAccelerationEstimateWorldMps2: target.targetAccelerationEstimateWorldMps2
    })
  };
}
