import type { Vector3 } from "../guidance/GuidanceLaws.js";

export interface MissileMotorCurveSample {
  /** Time from the start of this motor stage. */
  readonly timeSinceStageStartSeconds: number;
  readonly thrustN: number;
  readonly massFlowKgPerSecond: number;
}

export interface MissileMotorStage {
  readonly startTimeSeconds: number;
  readonly endTimeSeconds: number;
  /** Constant fallback thrust/flow, or nominal metadata when a curve is supplied. */
  readonly thrustN: number;
  readonly massFlowKgPerSecond: number;
  /** Optional measured/derived time history, linearly interpolated between knots. */
  readonly thrustCurve?: readonly MissileMotorCurveSample[];
}

export interface MachDragSample {
  readonly mach: number;
  readonly dragCoefficient: number;
}

export interface MissileAerodynamicModel {
  readonly referenceAreaM2: number;
  readonly dragCoefficientByMach: readonly MachDragSample[];
  readonly maximumNormalAccelerationG: number;
  /** Small-disturbance normal-force coefficient slope, per radian. */
  readonly normalForceCoefficientSlopePerRad: number;
  readonly maximumAngleOfAttackRad: number;
  /** Parabolic induced-drag increment: ΔCD = factor × CN². */
  readonly inducedDragFactor: number;
  readonly controlResponseTimeSeconds: number;
  readonly maximumNormalJerkMps3: number;
  readonly motorStages: readonly MissileMotorStage[];
}

export interface MissileEnvironment {
  readonly airDensityKgPerM3: number;
  readonly speedOfSoundMps: number;
  readonly windWorldMps: Vector3;
  readonly gravityMps2: number;
}

export interface MissileState {
  readonly positionWorldM: Vector3;
  readonly velocityWorldMps: Vector3;
  readonly massKg: number;
  readonly propellantMassKg: number;
  readonly elapsedFlightSeconds: number;
  readonly actualNormalAccelerationWorldMps2: Vector3;
}

export interface MissileStepInput {
  readonly deltaTimeSeconds: number;
  readonly commandedAccelerationWorldMps2: Vector3;
  readonly controlAuthorityFraction?: number;
}

export interface MissileFlightDiagnostics {
  readonly mach: number;
  readonly dynamicPressurePa: number;
  readonly dragForceN: number;
  readonly thrustN: number;
  readonly normalAccelerationMps2: number;
  readonly normalAccelerationG: number;
  readonly maximumAerodynamicNormalAccelerationMps2: number;
  readonly effectiveAngleOfAttackRad: number;
  readonly normalForceCoefficient: number;
  readonly activeMotorStageIndices: readonly number[];
  readonly dragDataInRange: boolean;
  readonly propellantConsumedKg: number;
}

export interface MissileStepResult {
  readonly state: MissileState;
  readonly diagnostics: MissileFlightDiagnostics;
}

/**
 * Deterministic translational 3-DoF point-mass model. It resolves position and
 * velocity, staged motor mass flow, Mach-dependent drag and lag/jerk-limited
 * normal acceleration. It does not resolve body attitude, spin, fin hinge
 * moments, structural modes or a full 6-DoF seeker/body installation.
 */
export function stepMissile3Dof(
  state: MissileState,
  model: MissileAerodynamicModel,
  environment: MissileEnvironment,
  input: MissileStepInput
): MissileStepResult {
  validateModel(model);
  validateState(state);
  validateEnvironment(environment);
  if (!Number.isFinite(input.deltaTimeSeconds) || input.deltaTimeSeconds <= 0 ||
    !input.commandedAccelerationWorldMps2.every(Number.isFinite)) {
    throw new RangeError("Missile step input must have a positive finite delta and finite command.");
  }
  const controlAuthority = input.controlAuthorityFraction ?? 1;
  if (!Number.isFinite(controlAuthority) || controlAuthority < 0 || controlAuthority > 1) {
    throw new RangeError("Control authority fraction must be within [0, 1].");
  }

  const dt = input.deltaTimeSeconds;
  const airVelocity = subtract(state.velocityWorldMps, environment.windWorldMps);
  const initialDynamicPressurePa = 0.5 * environment.airDensityKgPerM3 *
    vectorMagnitude(airVelocity) ** 2;
  const maximumStructuralNormal = model.maximumNormalAccelerationG * 9.80665;
  const maximumAerodynamicNormal = initialDynamicPressurePa * model.referenceAreaM2 *
    model.normalForceCoefficientSlopePerRad * model.maximumAngleOfAttackRad /
    state.massKg;
  const maximumNormal = Math.min(maximumStructuralNormal, maximumAerodynamicNormal) *
    controlAuthority;
  const desiredNormal = clampMagnitude(
    projectPerpendicular(input.commandedAccelerationWorldMps2, airDirection(state.velocityWorldMps, environment.windWorldMps)),
    maximumNormal
  );
  const response = model.controlResponseTimeSeconds <= 0
    ? 1
    : 1 - Math.exp(-dt / model.controlResponseTimeSeconds);
  const responseLimited = add(
    state.actualNormalAccelerationWorldMps2,
    scale(subtract(desiredNormal, state.actualNormalAccelerationWorldMps2), response)
  );
  const jerkLimited = add(
    state.actualNormalAccelerationWorldMps2,
    clampMagnitude(
      subtract(responseLimited, state.actualNormalAccelerationWorldMps2),
      model.maximumNormalJerkMps3 * dt
    )
  );
  const controlAcceleration = clampMagnitude(
    projectPerpendicular(jerkLimited, airDirection(state.velocityWorldMps, environment.windWorldMps)),
    maximumNormal
  );

  const motorOutput = evaluateMotorOutput(state.elapsedFlightSeconds, dt, state.propellantMassKg, model.motorStages);
  const massMidpoint = Math.max(0.01, state.massKg - motorOutput.propellantConsumedKg * 0.5);
  const initialAcceleration = calculateAcceleration(
    state.velocityWorldMps,
    massMidpoint,
    motorOutput.averageThrustN,
    controlAcceleration,
    model,
    environment
  );
  const midpointVelocity = add(state.velocityWorldMps, scale(initialAcceleration.acceleration, dt * 0.5));
  const midpointAcceleration = calculateAcceleration(
    midpointVelocity,
    massMidpoint,
    motorOutput.averageThrustN,
    controlAcceleration,
    model,
    environment
  );
  const velocityWorldMps = add(state.velocityWorldMps, scale(midpointAcceleration.acceleration, dt));
  const positionWorldM = add(
    state.positionWorldM,
    add(scale(state.velocityWorldMps, dt), scale(midpointAcceleration.acceleration, 0.5 * dt * dt))
  );
  const massKg = Math.max(0.01, state.massKg - motorOutput.propellantConsumedKg);
  const propellantMassKg = Math.max(0, state.propellantMassKg - motorOutput.propellantConsumedKg);

  return {
    state: {
      positionWorldM,
      velocityWorldMps,
      massKg,
      propellantMassKg,
      elapsedFlightSeconds: state.elapsedFlightSeconds + dt,
      actualNormalAccelerationWorldMps2: controlAcceleration
    },
    diagnostics: {
      mach: midpointAcceleration.mach,
      dynamicPressurePa: midpointAcceleration.dynamicPressurePa,
      dragForceN: midpointAcceleration.dragForceN,
      thrustN: motorOutput.averageThrustN,
      normalAccelerationMps2: vectorMagnitude(controlAcceleration),
      normalAccelerationG: vectorMagnitude(controlAcceleration) / 9.80665,
      maximumAerodynamicNormalAccelerationMps2: maximumAerodynamicNormal,
      effectiveAngleOfAttackRad: midpointAcceleration.effectiveAngleOfAttackRad,
      normalForceCoefficient: midpointAcceleration.normalForceCoefficient,
      activeMotorStageIndices: motorOutput.activeStageIndices,
      dragDataInRange: midpointAcceleration.dragDataInRange,
      propellantConsumedKg: motorOutput.propellantConsumedKg
    }
  };
}

function validateModel(model: MissileAerodynamicModel): void {
  if (!Number.isFinite(model.referenceAreaM2) || model.referenceAreaM2 <= 0 ||
    !Number.isFinite(model.maximumNormalAccelerationG) || model.maximumNormalAccelerationG <= 0 ||
    !Number.isFinite(model.normalForceCoefficientSlopePerRad) || model.normalForceCoefficientSlopePerRad <= 0 ||
    !Number.isFinite(model.maximumAngleOfAttackRad) || model.maximumAngleOfAttackRad <= 0 ||
    model.maximumAngleOfAttackRad >= Math.PI / 2 ||
    !Number.isFinite(model.inducedDragFactor) || model.inducedDragFactor < 0 ||
    !Number.isFinite(model.controlResponseTimeSeconds) || model.controlResponseTimeSeconds < 0 ||
    !Number.isFinite(model.maximumNormalJerkMps3) || model.maximumNormalJerkMps3 <= 0) {
    throw new RangeError("Missile aerodynamic/control model values are invalid.");
  }
  if (model.dragCoefficientByMach.length < 1) throw new RangeError("At least one Mach drag sample is required.");
  let previousMach = -Infinity;
  for (const sample of model.dragCoefficientByMach) {
    if (!Number.isFinite(sample.mach) || sample.mach < 0 || sample.mach <= previousMach ||
      !Number.isFinite(sample.dragCoefficient) || sample.dragCoefficient <= 0) {
      throw new RangeError("Mach drag samples must have increasing Mach and positive finite coefficients.");
    }
    previousMach = sample.mach;
  }
  let previousEnd = -Infinity;
  for (const stage of model.motorStages) {
    if (!Number.isFinite(stage.startTimeSeconds) || !Number.isFinite(stage.endTimeSeconds) ||
      stage.startTimeSeconds < 0 || stage.endTimeSeconds <= stage.startTimeSeconds ||
      stage.startTimeSeconds < previousEnd || !Number.isFinite(stage.thrustN) || stage.thrustN < 0 ||
      !Number.isFinite(stage.massFlowKgPerSecond) || stage.massFlowKgPerSecond < 0) {
      throw new RangeError("Motor stages must be ordered, non-overlapping and physically non-negative.");
    }
    if (stage.thrustCurve) {
      if (stage.thrustCurve.length < 2 ||
        stage.thrustCurve[0]!.timeSinceStageStartSeconds !== 0 ||
        Math.abs(stage.thrustCurve[stage.thrustCurve.length - 1]!.timeSinceStageStartSeconds -
          (stage.endTimeSeconds - stage.startTimeSeconds)) > 1e-9) {
        throw new RangeError("Motor thrust curves must start at zero and end at the stage duration.");
      }
      let previousCurveTime = -Infinity;
      for (const point of stage.thrustCurve) {
        if (!Number.isFinite(point.timeSinceStageStartSeconds) ||
          point.timeSinceStageStartSeconds <= previousCurveTime ||
          !Number.isFinite(point.thrustN) || point.thrustN < 0 ||
          !Number.isFinite(point.massFlowKgPerSecond) || point.massFlowKgPerSecond < 0) {
          throw new RangeError("Motor thrust curve knots must be ordered with finite non-negative values.");
        }
        previousCurveTime = point.timeSinceStageStartSeconds;
      }
    }
    previousEnd = stage.endTimeSeconds;
  }
}

function validateState(state: MissileState): void {
  if (![...state.positionWorldM, ...state.velocityWorldMps,
    ...state.actualNormalAccelerationWorldMps2].every(Number.isFinite) ||
    !Number.isFinite(state.massKg) || state.massKg <= 0 ||
    !Number.isFinite(state.propellantMassKg) || state.propellantMassKg < 0 ||
    state.propellantMassKg > state.massKg ||
    !Number.isFinite(state.elapsedFlightSeconds) || state.elapsedFlightSeconds < 0) {
    throw new RangeError("Missile state is invalid.");
  }
}

function validateEnvironment(environment: MissileEnvironment): void {
  if (!Number.isFinite(environment.airDensityKgPerM3) || environment.airDensityKgPerM3 < 0 ||
    !Number.isFinite(environment.speedOfSoundMps) || environment.speedOfSoundMps <= 0 ||
    !environment.windWorldMps.every(Number.isFinite) ||
    !Number.isFinite(environment.gravityMps2) || environment.gravityMps2 < 0) {
    throw new RangeError("Missile environment is invalid.");
  }
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
function vectorMagnitude(vector: Vector3): number {
  return Math.hypot(vector[0], vector[1], vector[2]);
}
function normalize(vector: Vector3): Vector3 {
  const length = vectorMagnitude(vector);
  return length > 1e-9 ? scale(vector, 1 / length) : [0, 1, 0];
}
function projectPerpendicular(vector: Vector3, axis: Vector3): Vector3 {
  return subtract(vector, scale(axis, dot(vector, axis)));
}
function clampMagnitude(vector: Vector3, maximum: number): Vector3 {
  const length = vectorMagnitude(vector);
  return length > maximum ? scale(vector, maximum / length) : vector;
}
function airDirection(velocity: Vector3, wind: Vector3): Vector3 {
  const relativeAirVelocity = subtract(velocity, wind);
  return normalize(relativeAirVelocity);
}

function interpolateDragCoefficient(
  samples: readonly MachDragSample[],
  mach: number
): { readonly coefficient: number; readonly inRange: boolean } {
  if (mach <= samples[0]!.mach) {
    return { coefficient: samples[0]!.dragCoefficient, inRange: mach >= samples[0]!.mach };
  }
  const last = samples[samples.length - 1]!;
  if (mach >= last.mach) return { coefficient: last.dragCoefficient, inRange: mach <= last.mach };
  for (let index = 1; index < samples.length; index += 1) {
    const upper = samples[index]!;
    const lower = samples[index - 1]!;
    if (mach <= upper.mach) {
      const fraction = (mach - lower.mach) / (upper.mach - lower.mach);
      return {
        coefficient: lower.dragCoefficient + (upper.dragCoefficient - lower.dragCoefficient) * fraction,
        inRange: true
      };
    }
  }
  return { coefficient: last.dragCoefficient, inRange: false };
}

function evaluateMotorOutput(
  elapsedSeconds: number,
  deltaTimeSeconds: number,
  propellantMassKg: number,
  stages: readonly MissileMotorStage[]
): {
  readonly averageThrustN: number;
  readonly propellantConsumedKg: number;
  readonly activeStageIndices: readonly number[];
} {
  let remainingPropellant = propellantMassKg;
  let impulseNs = 0;
  let consumedKg = 0;
  const activeStageIndices: number[] = [];
  const stepEnd = elapsedSeconds + deltaTimeSeconds;
  for (let index = 0; index < stages.length; index += 1) {
    const stage = stages[index]!;
    const activeStart = Math.max(elapsedSeconds, stage.startTimeSeconds);
    const activeEnd = Math.min(stepEnd, stage.endTimeSeconds);
    if (activeEnd <= activeStart || remainingPropellant <= 0 || stage.thrustN <= 0) continue;
    activeStageIndices.push(index);
    const stageStartOffset = activeStart - stage.startTimeSeconds;
    const stageEndOffset = activeEnd - stage.startTimeSeconds;
    const stageOutput = integrateMotorStage(
      stage,
      stageStartOffset,
      stageEndOffset,
      remainingPropellant
    );
    impulseNs += stageOutput.impulseNs;
    consumedKg += stageOutput.propellantConsumedKg;
    remainingPropellant = Math.max(0, remainingPropellant - stageOutput.propellantConsumedKg);
  }
  return {
    averageThrustN: impulseNs / deltaTimeSeconds,
    propellantConsumedKg: consumedKg,
    activeStageIndices
  };
}

function interpolateMotorCurve(
  curve: readonly MissileMotorCurveSample[],
  timeSinceStageStartSeconds: number
): { readonly thrustN: number; readonly massFlowKgPerSecond: number } {
  if (timeSinceStageStartSeconds <= curve[0]!.timeSinceStageStartSeconds) {
    return curve[0]!;
  }
  const last = curve[curve.length - 1]!;
  if (timeSinceStageStartSeconds >= last.timeSinceStageStartSeconds) return last;
  for (let index = 1; index < curve.length; index += 1) {
    const upper = curve[index]!;
    const lower = curve[index - 1]!;
    if (timeSinceStageStartSeconds <= upper.timeSinceStageStartSeconds) {
      const fraction = (timeSinceStageStartSeconds - lower.timeSinceStageStartSeconds) /
        (upper.timeSinceStageStartSeconds - lower.timeSinceStageStartSeconds);
      return {
        thrustN: lower.thrustN + (upper.thrustN - lower.thrustN) * fraction,
        massFlowKgPerSecond: lower.massFlowKgPerSecond +
          (upper.massFlowKgPerSecond - lower.massFlowKgPerSecond) * fraction
      };
    }
  }
  return last;
}

function integrateMotorStage(
  stage: MissileMotorStage,
  startOffsetSeconds: number,
  endOffsetSeconds: number,
  availablePropellantKg: number
): { readonly impulseNs: number; readonly propellantConsumedKg: number } {
  if (!stage.thrustCurve) {
    const duration = endOffsetSeconds - startOffsetSeconds;
    const burnDuration = stage.massFlowKgPerSecond > 0
      ? Math.min(duration, availablePropellantKg / stage.massFlowKgPerSecond)
      : duration;
    return {
      impulseNs: stage.thrustN * burnDuration,
      propellantConsumedKg: burnDuration * stage.massFlowKgPerSecond
    };
  }

  const boundaries = [
    startOffsetSeconds,
    ...stage.thrustCurve
      .map((point) => point.timeSinceStageStartSeconds)
      .filter((time) => time > startOffsetSeconds && time < endOffsetSeconds),
    endOffsetSeconds
  ];
  let remaining = availablePropellantKg;
  let impulseNs = 0;
  let propellantConsumedKg = 0;
  for (let index = 1; index < boundaries.length && remaining > 0; index += 1) {
    const segmentStart = boundaries[index - 1]!;
    const segmentEnd = boundaries[index]!;
    const segmentDuration = segmentEnd - segmentStart;
    const start = interpolateMotorCurve(stage.thrustCurve, segmentStart);
    const end = interpolateMotorCurve(stage.thrustCurve, segmentEnd);
    const massFlowSlope = (end.massFlowKgPerSecond - start.massFlowKgPerSecond) /
      segmentDuration;
    const fullSegmentConsumption = 0.5 *
      (start.massFlowKgPerSecond + end.massFlowKgPerSecond) * segmentDuration;
    let burnDuration = segmentDuration;
    if (fullSegmentConsumption > remaining) {
      let lower = 0;
      let upper = segmentDuration;
      for (let iteration = 0; iteration < 32; iteration += 1) {
        const midpoint = (lower + upper) / 2;
        const consumedAtMidpoint = start.massFlowKgPerSecond * midpoint +
          0.5 * massFlowSlope * midpoint * midpoint;
        if (consumedAtMidpoint < remaining) lower = midpoint;
        else upper = midpoint;
      }
      burnDuration = (lower + upper) / 2;
    }
    const burnEnd = interpolateMotorCurve(stage.thrustCurve, segmentStart + burnDuration);
    const thrustImpulse = 0.5 * (start.thrustN + burnEnd.thrustN) * burnDuration;
    const stageConsumption = Math.min(
      remaining,
      start.massFlowKgPerSecond * burnDuration +
        0.5 * massFlowSlope * burnDuration * burnDuration
    );
    impulseNs += thrustImpulse;
    propellantConsumedKg += stageConsumption;
    remaining -= stageConsumption;
  }
  return { impulseNs, propellantConsumedKg };
}

function calculateAcceleration(
  velocityWorldMps: Vector3,
  massKg: number,
  thrustN: number,
  normalControlAcceleration: Vector3,
  model: MissileAerodynamicModel,
  environment: MissileEnvironment
): {
  readonly acceleration: Vector3;
  readonly mach: number;
  readonly dynamicPressurePa: number;
  readonly dragForceN: number;
  readonly dragDataInRange: boolean;
  readonly effectiveAngleOfAttackRad: number;
  readonly normalForceCoefficient: number;
} {
  const airVelocity = subtract(velocityWorldMps, environment.windWorldMps);
  const speedMps = vectorMagnitude(airVelocity);
  const direction = speedMps > 1e-6 ? scale(airVelocity, 1 / speedMps) : [0, 1, 0] as const;
  const mach = speedMps / environment.speedOfSoundMps;
  const dynamicPressurePa = 0.5 * environment.airDensityKgPerM3 * speedMps * speedMps;
  const drag = interpolateDragCoefficient(model.dragCoefficientByMach, mach);
  const qArea = dynamicPressurePa * model.referenceAreaM2;
  const normalAccelerationMps2 = vectorMagnitude(normalControlAcceleration);
  const normalForceCoefficient = qArea > 0
    ? (massKg * normalAccelerationMps2) / qArea
    : 0;
  const effectiveAngleOfAttackRad = Math.min(
    model.maximumAngleOfAttackRad,
    normalForceCoefficient / model.normalForceCoefficientSlopePerRad
  );
  const totalDragCoefficient = drag.coefficient +
    model.inducedDragFactor * normalForceCoefficient * normalForceCoefficient;
  const dragForceN = qArea * totalDragCoefficient;
  const axialAcceleration = thrustN / massKg - dragForceN / massKg;
  const gravity: Vector3 = [0, 0, -environment.gravityMps2];
  const acceleration = add(
    add(scale(direction, axialAcceleration), gravity),
    normalControlAcceleration
  );
  return {
    acceleration,
    mach,
    dynamicPressurePa,
    dragForceN,
    dragDataInRange: drag.inRange,
    effectiveAngleOfAttackRad,
    normalForceCoefficient
  };
}
