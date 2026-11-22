export type Vector3 = readonly [number, number, number];

export interface GuidanceStateEstimate {
  readonly missilePositionWorldM: Vector3;
  readonly missileVelocityWorldMps: Vector3;
  readonly targetPositionEstimateWorldM: Vector3;
  readonly targetVelocityEstimateWorldMps: Vector3;
  readonly estimateTimeSeconds: number;
  readonly measurementAgeSeconds: number;
  readonly positionStandardDeviationM: number;
  readonly velocityStandardDeviationMps: number;
  readonly targetAccelerationEstimateWorldMps2?: Vector3;
}

export interface ProportionalNavigationConfiguration {
  readonly navigationConstant: number;
  readonly maximumCommandedAccelerationMps2: number;
  readonly maximumMeasurementAgeSeconds: number;
  readonly maximumPositionUncertaintyM: number;
  readonly minimumEngagementRangeM: number;
}

export interface GuidanceCommand {
  readonly valid: boolean;
  readonly reason: "valid" | "stale-measurement" | "uncertain-estimate" | "inside-minimum-range" | "not-closing";
  readonly commandedAccelerationWorldMps2: Vector3;
  readonly lineOfSightRateRadPerSecond: Vector3;
  readonly rangeM: number;
  readonly closingSpeedMps: number;
  readonly commandMagnitudeMps2: number;
}

function subtract(a: Vector3, b: Vector3): Vector3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function add(a: Vector3, b: Vector3): Vector3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function scale(vector: Vector3, scalar: number): Vector3 {
  return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}
function dot(a: Vector3, b: Vector3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a: Vector3, b: Vector3): Vector3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}
function magnitude(vector: Vector3): number {
  return Math.hypot(vector[0], vector[1], vector[2]);
}
function normalize(vector: Vector3): Vector3 {
  const length = magnitude(vector);
  if (length <= Number.EPSILON) throw new RangeError("Cannot normalize a zero-length vector.");
  return scale(vector, 1 / length);
}
function projectPerpendicular(vector: Vector3, axisUnit: Vector3): Vector3 {
  return subtract(vector, scale(axisUnit, dot(vector, axisUnit)));
}
function clampMagnitude(vector: Vector3, maximum: number): Vector3 {
  const length = magnitude(vector);
  return length > maximum ? scale(vector, maximum / length) : vector;
}

function zeroCommand(
  reason: GuidanceCommand["reason"],
  rangeM = 0,
  closingSpeedMps = 0,
  lineOfSightRateRadPerSecond: Vector3 = [0, 0, 0]
): GuidanceCommand {
  return {
    valid: false,
    reason,
    commandedAccelerationWorldMps2: [0, 0, 0],
    lineOfSightRateRadPerSecond,
    rangeM,
    closingSpeedMps,
    commandMagnitudeMps2: 0
  };
}

function validate(
  estimate: GuidanceStateEstimate,
  config: ProportionalNavigationConfiguration
): void {
  const vectors = [
    estimate.missilePositionWorldM,
    estimate.missileVelocityWorldMps,
    estimate.targetPositionEstimateWorldM,
    estimate.targetVelocityEstimateWorldMps
  ];
  for (const vector of vectors) {
    if (vector.length !== 3 || !vector.every(Number.isFinite)) {
      throw new RangeError("Guidance vectors must contain three finite components.");
    }
  }
  const positiveConfig = [
    config.navigationConstant,
    config.maximumCommandedAccelerationMps2,
    config.maximumMeasurementAgeSeconds,
    config.maximumPositionUncertaintyM,
    config.minimumEngagementRangeM
  ];
  if (!positiveConfig.every((value) => Number.isFinite(value) && value > 0)) {
    throw new RangeError("Guidance configuration values must be positive and finite.");
  }
  if (![estimate.estimateTimeSeconds, estimate.measurementAgeSeconds,
    estimate.positionStandardDeviationM, estimate.velocityStandardDeviationMps].every(Number.isFinite) ||
    estimate.estimateTimeSeconds < 0 || estimate.measurementAgeSeconds < 0 ||
    estimate.positionStandardDeviationM < 0 || estimate.velocityStandardDeviationMps < 0) {
    throw new RangeError("Guidance measurement metadata is invalid.");
  }
  if (estimate.targetAccelerationEstimateWorldMps2 &&
    !estimate.targetAccelerationEstimateWorldMps2.every(Number.isFinite)) {
    throw new RangeError("Target acceleration estimate must be finite.");
  }
}

/** Classical true proportional navigation driven only by an uncertain state estimate. */
export function computeProportionalNavigation(
  estimate: GuidanceStateEstimate,
  config: ProportionalNavigationConfiguration
): GuidanceCommand {
  validate(estimate, config);
  if (estimate.measurementAgeSeconds > config.maximumMeasurementAgeSeconds) {
    return zeroCommand("stale-measurement");
  }
  if (estimate.positionStandardDeviationM > config.maximumPositionUncertaintyM) {
    return zeroCommand("uncertain-estimate");
  }

  const relativePosition = subtract(
    estimate.targetPositionEstimateWorldM,
    estimate.missilePositionWorldM
  );
  const relativeVelocity = subtract(
    estimate.targetVelocityEstimateWorldMps,
    estimate.missileVelocityWorldMps
  );
  const rangeM = magnitude(relativePosition);
  if (rangeM <= config.minimumEngagementRangeM) {
    return zeroCommand("inside-minimum-range", rangeM);
  }

  const lineOfSightUnit = scale(relativePosition, 1 / rangeM);
  const closingSpeedMps = -dot(relativePosition, relativeVelocity) / rangeM;
  if (closingSpeedMps <= 0) {
    return zeroCommand("not-closing", rangeM, closingSpeedMps);
  }

  const lineOfSightRate = scale(cross(relativePosition, relativeVelocity), 1 / (rangeM * rangeM));
  const navigationAcceleration = scale(
    cross(lineOfSightRate, lineOfSightUnit),
    config.navigationConstant * closingSpeedMps
  );
  const missileSpeed = magnitude(estimate.missileVelocityWorldMps);
  const velocityAxis = missileSpeed > 1e-6
    ? normalize(estimate.missileVelocityWorldMps)
    : lineOfSightUnit;
  const boundedCommand = clampMagnitude(
    projectPerpendicular(navigationAcceleration, velocityAxis),
    config.maximumCommandedAccelerationMps2
  );

  return {
    valid: true,
    reason: "valid",
    commandedAccelerationWorldMps2: boundedCommand,
    lineOfSightRateRadPerSecond: lineOfSightRate,
    rangeM,
    closingSpeedMps,
    commandMagnitudeMps2: magnitude(boundedCommand)
  };
}

/**
 * Augmented proportional navigation adds a bounded target-acceleration estimate.
 * The augmentation remains an estimate, not access to target/world truth.
 */
export function computeAugmentedProportionalNavigation(
  estimate: GuidanceStateEstimate,
  config: ProportionalNavigationConfiguration
): GuidanceCommand {
  const base = computeProportionalNavigation(estimate, config);
  if (!base.valid || !estimate.targetAccelerationEstimateWorldMps2) return base;
  const relativePosition = subtract(
    estimate.targetPositionEstimateWorldM,
    estimate.missilePositionWorldM
  );
  const range = magnitude(relativePosition);
  const lineOfSightUnit = normalize(relativePosition);
  const targetAccelerationNormal = projectPerpendicular(
    estimate.targetAccelerationEstimateWorldMps2,
    lineOfSightUnit
  );
  const missileSpeed = magnitude(estimate.missileVelocityWorldMps);
  const velocityAxis = missileSpeed > 1e-6
    ? normalize(estimate.missileVelocityWorldMps)
    : lineOfSightUnit;
  const augmented = add(
    base.commandedAccelerationWorldMps2,
    scale(targetAccelerationNormal, 0.5 * config.navigationConstant)
  );
  const bounded = clampMagnitude(
    projectPerpendicular(augmented, velocityAxis),
    config.maximumCommandedAccelerationMps2
  );
  return { ...base, commandedAccelerationWorldMps2: bounded, commandMagnitudeMps2: magnitude(bounded) };
}

/** Pure pursuit is provided as a deliberately distinct comparison law. */
export function computePurePursuitCommand(
  estimate: GuidanceStateEstimate,
  config: ProportionalNavigationConfiguration
): GuidanceCommand {
  validate(estimate, config);
  if (estimate.measurementAgeSeconds > config.maximumMeasurementAgeSeconds) return zeroCommand("stale-measurement");
  if (estimate.positionStandardDeviationM > config.maximumPositionUncertaintyM) return zeroCommand("uncertain-estimate");
  const relativePosition = subtract(estimate.targetPositionEstimateWorldM, estimate.missilePositionWorldM);
  const rangeM = magnitude(relativePosition);
  if (rangeM <= config.minimumEngagementRangeM) return zeroCommand("inside-minimum-range", rangeM);
  const relativeVelocity = subtract(estimate.targetVelocityEstimateWorldMps, estimate.missileVelocityWorldMps);
  const closingSpeedMps = -dot(relativePosition, relativeVelocity) / rangeM;
  const lineOfSightUnit = normalize(relativePosition);
  const missileSpeed = magnitude(estimate.missileVelocityWorldMps);
  const velocityAxis = missileSpeed > 1e-6 ? normalize(estimate.missileVelocityWorldMps) : lineOfSightUnit;
  const pursuitVector = projectPerpendicular(lineOfSightUnit, velocityAxis);
  const command = clampMagnitude(
    scale(pursuitVector, config.maximumCommandedAccelerationMps2),
    config.maximumCommandedAccelerationMps2
  );
  return {
    valid: true,
    reason: "valid",
    commandedAccelerationWorldMps2: command,
    lineOfSightRateRadPerSecond: scale(cross(relativePosition, relativeVelocity), 1 / (rangeM * rangeM)),
    rangeM,
    closingSpeedMps,
    commandMagnitudeMps2: magnitude(command)
  };
}
