import type { Quaternion, Vector3 } from "../../core/coordinates/CoordinateFrames.js";
import type { MissileMotorStage } from "./MissileDynamics.js";

export interface Missile6DofAeroSample {
  readonly mach: number;
  readonly zeroLiftDragCoefficient: number;
  readonly normalForceSlopePerRad: number;
  readonly sideForceSlopePerRad: number;
  readonly rollDampingDerivative: number;
  readonly pitchDampingDerivative: number;
  readonly yawDampingDerivative: number;
  readonly rollSideslipDerivative: number;
  readonly pitchAlphaDerivative: number;
  readonly yawSideslipDerivative: number;
  readonly rollControlEffectiveness: number;
  readonly pitchControlEffectiveness: number;
  readonly yawControlEffectiveness: number;
}

export interface Missile6DofModel {
  readonly referenceAreaM2: number;
  readonly referenceLengthM: number;
  readonly referenceSpanM: number;
  readonly zeroLiftDragMachTable: readonly Missile6DofAeroSample[];
  readonly inducedDragFactor: number;
  readonly maximumAngleOfAttackRad: number;
  readonly maximumSideslipRad: number;
  readonly dryMassKg: number;
  readonly initialPropellantMassKg: number;
  readonly dryInertiaKgM2: Vector3;
  readonly launchInertiaKgM2: Vector3;
  readonly dryCenterOfGravityBodyM: Vector3;
  readonly launchCenterOfGravityBodyM: Vector3;
  readonly aerodynamicCenterBodyM: Vector3;
  readonly thrustApplicationPointBodyM: Vector3;
  readonly motorStages: readonly MissileMotorStage[];
  readonly actuatorTimeConstantSeconds: number;
  readonly maximumFinDeflectionRadians: number;
  readonly maximumFinRateRadiansPerSecond: number;
  readonly maximumBodyRateRadPerSecond: number;
  readonly actuatorAuthorityFraction: number;
  readonly maximumNormalAccelerationG: number;
  readonly maximumAngularAccelerationRadPerSecond2: number;
}

export interface Missile6DofEnvironment {
  readonly airDensityKgPerM3: number;
  readonly speedOfSoundMps: number;
  readonly windWorldMps: Vector3;
  readonly gravityMps2: number;
}

export interface Missile6DofState {
  readonly positionWorldM: Vector3;
  readonly velocityWorldMps: Vector3;
  /** Quaternion [x,y,z,w], mapping missile body FRD into world ENU. */
  readonly bodyToWorld: Quaternion;
  /** Body angular rates [roll, pitch, yaw], radians/second. */
  readonly angularRatesBodyRadPerSecond: Vector3;
  /** Fin commands/states [roll, pitch, yaw], radians. */
  readonly finDeflectionsRad: Vector3;
  readonly massKg: number;
  readonly propellantMassKg: number;
  readonly elapsedFlightSeconds: number;
}

export interface Missile6DofStepInput {
  readonly deltaTimeSeconds: number;
  readonly commandedFinDeflectionsRad: Vector3;
  readonly controlAuthorityFraction?: number;
}

export interface Missile6DofDiagnostics {
  readonly mach: number;
  readonly dynamicPressurePa: number;
  readonly angleOfAttackRad: number;
  readonly sideslipRad: number;
  readonly zeroLiftDragCoefficient: number;
  readonly normalForceCoefficient: number;
  readonly sideForceCoefficient: number;
  readonly aerodynamicForceBodyN: Vector3;
  readonly totalForceBodyN: Vector3;
  readonly aerodynamicMomentBodyNm: Vector3;
  readonly totalMomentBodyNm: Vector3;
  readonly propulsiveThrustN: number;
  readonly propellantConsumedKg: number;
  readonly normalAccelerationG: number;
  readonly actuatorDeflectionRad: Vector3;
  readonly effectiveMassCenterBodyM: Vector3;
  readonly effectiveInertiaKgM2: Vector3;
  readonly aeroDataInRange: boolean;
}

export interface Missile6DofStepResult {
  readonly state: Missile6DofState;
  readonly diagnostics: Missile6DofDiagnostics;
}

interface ForceMomentSolution {
  readonly forceBodyN: Vector3;
  readonly aerodynamicForceBodyN: Vector3;
  readonly aerodynamicMomentBodyNm: Vector3;
  readonly totalMomentBodyNm: Vector3;
  readonly accelerationWorldMps2: Vector3;
  readonly angularAccelerationBodyRadPerSecond2: Vector3;
  readonly mach: number;
  readonly dynamicPressurePa: number;
  readonly angleOfAttackRad: number;
  readonly sideslipRad: number;
  readonly cd0: number;
  readonly normalForceCoefficient: number;
  readonly sideForceCoefficient: number;
  readonly normalAccelerationG: number;
  readonly aeroDataInRange: boolean;
}

function add(a: Vector3, b: Vector3): Vector3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function subtract(a: Vector3, b: Vector3): Vector3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function scale(a: Vector3, factor: number): Vector3 {
  return [a[0] * factor, a[1] * factor, a[2] * factor];
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
function magnitude(a: Vector3): number {
  return Math.hypot(a[0], a[1], a[2]);
}
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
function clampVector(a: Vector3, maximum: number): Vector3 {
  const length = magnitude(a);
  return length > maximum ? scale(a, maximum / length) : a;
}
function normalizeQuaternion(q: Quaternion): Quaternion {
  const length = Math.hypot(q[0], q[1], q[2], q[3]);
  if (!Number.isFinite(length) || length < 1e-12) {
    throw new RangeError("Missile attitude quaternion must have non-zero finite magnitude.");
  }
  return [q[0] / length, q[1] / length, q[2] / length, q[3] / length];
}
function quaternionMultiply(a: Quaternion, b: Quaternion): Quaternion {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
  ];
}
function rotateBodyToWorld(vector: Vector3, orientation: Quaternion): Vector3 {
  const q = normalizeQuaternion(orientation);
  const vectorQuaternion: Quaternion = [vector[0], vector[1], vector[2], 0];
  const inverse: Quaternion = [-q[0], -q[1], -q[2], q[3]];
  const rotated = quaternionMultiply(quaternionMultiply(q, vectorQuaternion), inverse);
  return [rotated[0], rotated[1], rotated[2]];
}
function rotateWorldToBody(vector: Vector3, orientation: Quaternion): Vector3 {
  const q = normalizeQuaternion(orientation);
  const inverse: Quaternion = [-q[0], -q[1], -q[2], q[3]];
  return rotateBodyToWorld(vector, inverse);
}
function integrateQuaternion(q: Quaternion, bodyRates: Vector3, dt: number): Quaternion {
  const rateMagnitude = magnitude(bodyRates);
  if (rateMagnitude < 1e-12) return normalizeQuaternion(q);
  const halfAngle = 0.5 * rateMagnitude * dt;
  const vectorScale = Math.sin(halfAngle) / rateMagnitude;
  const delta: Quaternion = [
    bodyRates[0] * vectorScale,
    bodyRates[1] * vectorScale,
    bodyRates[2] * vectorScale,
    Math.cos(halfAngle)
  ];
  return normalizeQuaternion(quaternionMultiply(q, delta));
}
function validateVector(value: Vector3, label: string): void {
  if (value.length !== 3 || !value.every(Number.isFinite)) {
    throw new RangeError(label + " must contain exactly three finite components.");
  }
}
function interpolateAero(
  table: readonly Missile6DofAeroSample[],
  mach: number
): { readonly sample: Missile6DofAeroSample; readonly inRange: boolean } {
  const first = table[0]!;
  const last = table[table.length - 1]!;
  if (mach <= first.mach) return { sample: first, inRange: mach >= first.mach };
  if (mach >= last.mach) return { sample: last, inRange: mach <= last.mach };
  for (let i = 1; i < table.length; i += 1) {
    const lower = table[i - 1]!;
    const upper = table[i]!;
    if (mach <= upper.mach) {
      const t = (mach - lower.mach) / (upper.mach - lower.mach);
      const keys: (keyof Missile6DofAeroSample)[] = [
        "mach", "zeroLiftDragCoefficient", "normalForceSlopePerRad",
        "sideForceSlopePerRad", "rollDampingDerivative", "pitchDampingDerivative",
        "yawDampingDerivative", "rollSideslipDerivative", "pitchAlphaDerivative",
        "yawSideslipDerivative", "rollControlEffectiveness", "pitchControlEffectiveness",
        "yawControlEffectiveness"
      ];
      const sample = {} as Record<keyof Missile6DofAeroSample, number>;
      for (const key of keys) {
        sample[key] = lower[key] + (upper[key] - lower[key]) * t;
      }
      return { sample: sample as unknown as Missile6DofAeroSample, inRange: true };
    }
  }
  return { sample: last, inRange: false };
}
function interpolateMotorCurve(
  stage: MissileMotorStage,
  relativeTimeSeconds: number
): { readonly thrustN: number; readonly massFlowKgPerSecond: number } {
  if (!stage.thrustCurve) return {
    thrustN: stage.thrustN,
    massFlowKgPerSecond: stage.massFlowKgPerSecond
  };
  const curve = stage.thrustCurve;
  if (relativeTimeSeconds <= curve[0]!.timeSinceStageStartSeconds) return curve[0]!;
  const last = curve[curve.length - 1]!;
  if (relativeTimeSeconds >= last.timeSinceStageStartSeconds) return last;
  for (let i = 1; i < curve.length; i += 1) {
    const lower = curve[i - 1]!;
    const upper = curve[i]!;
    if (relativeTimeSeconds <= upper.timeSinceStageStartSeconds) {
      const t = (relativeTimeSeconds - lower.timeSinceStageStartSeconds) /
        (upper.timeSinceStageStartSeconds - lower.timeSinceStageStartSeconds);
      return {
        thrustN: lower.thrustN + (upper.thrustN - lower.thrustN) * t,
        massFlowKgPerSecond: lower.massFlowKgPerSecond +
          (upper.massFlowKgPerSecond - lower.massFlowKgPerSecond) * t
      };
    }
  }
  return last;
}
function motorStep(
  model: Missile6DofModel,
  elapsed: number,
  dt: number,
  propellantAvailableKg: number
): { readonly thrustN: number; readonly consumedKg: number } {
  let remaining = propellantAvailableKg;
  let impulse = 0;
  let consumed = 0;
  const end = elapsed + dt;
  for (const stage of model.motorStages) {
    const activeStart = Math.max(elapsed, stage.startTimeSeconds);
    const activeEnd = Math.min(end, stage.endTimeSeconds);
    if (activeEnd <= activeStart || remaining <= 0) continue;
    const startOffset = activeStart - stage.startTimeSeconds;
    const endOffset = activeEnd - stage.startTimeSeconds;
    const cuts = [startOffset, ...(
      stage.thrustCurve?.map((point) => point.timeSinceStageStartSeconds)
        .filter((value) => value > startOffset && value < endOffset) ?? []
    ), endOffset];
    for (let i = 1; i < cuts.length && remaining > 0; i += 1) {
      const ta = cuts[i - 1]!;
      const tb = cuts[i]!;
      const duration = tb - ta;
      const a = interpolateMotorCurve(stage, ta);
      const b = interpolateMotorCurve(stage, tb);
      const flowSlope = (b.massFlowKgPerSecond - a.massFlowKgPerSecond) / duration;
      const fullConsumption = 0.5 * (a.massFlowKgPerSecond + b.massFlowKgPerSecond) * duration;
      let burnDuration = duration;
      if (fullConsumption > remaining) {
        let low = 0;
        let high = duration;
        for (let iteration = 0; iteration < 32; iteration += 1) {
          const mid = (low + high) / 2;
          const used = a.massFlowKgPerSecond * mid + 0.5 * flowSlope * mid * mid;
          if (used < remaining) low = mid;
          else high = mid;
        }
        burnDuration = (low + high) / 2;
      }
      const burnEnd = interpolateMotorCurve(stage, ta + burnDuration);
      const used = Math.min(remaining,
        a.massFlowKgPerSecond * burnDuration + 0.5 * flowSlope * burnDuration * burnDuration);
      impulse += 0.5 * (a.thrustN + burnEnd.thrustN) * burnDuration;
      consumed += used;
      remaining -= used;
    }
  }
  return { thrustN: impulse / dt, consumedKg: consumed };
}
function inertiaForMass(
  model: Missile6DofModel,
  propellantMassKg: number
): { readonly inertia: Vector3; readonly center: Vector3 } {
  const fraction = model.initialPropellantMassKg > 0
    ? clamp(propellantMassKg / model.initialPropellantMassKg, 0, 1)
    : 0;
  return {
    inertia: [
      model.dryInertiaKgM2[0] + (model.launchInertiaKgM2[0] - model.dryInertiaKgM2[0]) * fraction,
      model.dryInertiaKgM2[1] + (model.launchInertiaKgM2[1] - model.dryInertiaKgM2[1]) * fraction,
      model.dryInertiaKgM2[2] + (model.launchInertiaKgM2[2] - model.dryInertiaKgM2[2]) * fraction
    ],
    center: [
      model.dryCenterOfGravityBodyM[0] +
        (model.launchCenterOfGravityBodyM[0] - model.dryCenterOfGravityBodyM[0]) * fraction,
      model.dryCenterOfGravityBodyM[1] +
        (model.launchCenterOfGravityBodyM[1] - model.dryCenterOfGravityBodyM[1]) * fraction,
      model.dryCenterOfGravityBodyM[2] +
        (model.launchCenterOfGravityBodyM[2] - model.dryCenterOfGravityBodyM[2]) * fraction
    ]
  };
}
function servoStep(
  current: Vector3,
  command: Vector3,
  model: Missile6DofModel,
  dt: number,
  authority: number
): Vector3 {
  return [0, 1, 2].map((axis) => {
    const target = clamp(command[axis]!, -model.maximumFinDeflectionRadians, model.maximumFinDeflectionRadians);
    const error = target - current[axis]!;
    const response = model.actuatorTimeConstantSeconds <= 0
      ? error
      : error * (1 - Math.exp(-dt / model.actuatorTimeConstantSeconds));
    const maximumStep = model.maximumFinRateRadiansPerSecond * dt * authority;
    return current[axis]! + clamp(response, -maximumStep, maximumStep);
  }) as unknown as Vector3;
}
function validateModel(model: Missile6DofModel): void {
  const positive = [
    model.referenceAreaM2, model.referenceLengthM, model.referenceSpanM,
    model.dryMassKg, model.dryInertiaKgM2[0], model.dryInertiaKgM2[1],
    model.dryInertiaKgM2[2], model.launchInertiaKgM2[0], model.launchInertiaKgM2[1],
    model.launchInertiaKgM2[2], model.maximumFinDeflectionRadians,
    model.maximumFinRateRadiansPerSecond, model.maximumBodyRateRadPerSecond,
    model.maximumNormalAccelerationG, model.maximumAngularAccelerationRadPerSecond2
  ];
  if (!positive.every((value) => Number.isFinite(value) && value > 0) ||
    !Number.isFinite(model.initialPropellantMassKg) || model.initialPropellantMassKg < 0 ||
    !Number.isFinite(model.actuatorTimeConstantSeconds) || model.actuatorTimeConstantSeconds < 0 ||
    !Number.isFinite(model.inducedDragFactor) || model.inducedDragFactor < 0 ||
    !Number.isFinite(model.maximumAngleOfAttackRad) || model.maximumAngleOfAttackRad <= 0 ||
    model.maximumAngleOfAttackRad >= Math.PI / 2 ||
    !Number.isFinite(model.maximumSideslipRad) || model.maximumSideslipRad <= 0 ||
    model.maximumSideslipRad >= Math.PI / 2 ||
    !Number.isFinite(model.actuatorAuthorityFraction) ||
    model.actuatorAuthorityFraction < 0 || model.actuatorAuthorityFraction > 1) {
    throw new RangeError("6-DoF missile physical or actuator model is invalid.");
  }
  for (const vector of [model.dryCenterOfGravityBodyM, model.launchCenterOfGravityBodyM,
    model.aerodynamicCenterBodyM, model.thrustApplicationPointBodyM]) {
    validateVector(vector, "Missile model body offset");
  }
  if (model.zeroLiftDragMachTable.length < 2) {
    throw new RangeError("6-DoF missile model requires at least two aerodynamic Mach samples.");
  }
  let previousStageEnd = -Infinity;
  for (const stage of model.motorStages) {
    if (![stage.startTimeSeconds, stage.endTimeSeconds, stage.thrustN,
      stage.massFlowKgPerSecond].every(Number.isFinite) ||
      stage.startTimeSeconds < 0 || stage.endTimeSeconds <= stage.startTimeSeconds ||
      stage.startTimeSeconds < previousStageEnd || stage.thrustN < 0 ||
      stage.massFlowKgPerSecond < 0) {
      throw new RangeError("6-DoF motor stages must be ordered and physically non-negative.");
    }
    if (stage.thrustCurve) {
      if (stage.thrustCurve.length < 2 ||
        stage.thrustCurve[0]!.timeSinceStageStartSeconds !== 0 ||
        Math.abs(stage.thrustCurve[stage.thrustCurve.length - 1]!.timeSinceStageStartSeconds -
          (stage.endTimeSeconds - stage.startTimeSeconds)) > 1e-9) {
        throw new RangeError("Motor thrust curve must span the complete motor stage.");
      }
      let previousCurveTime = -Infinity;
      for (const point of stage.thrustCurve) {
        if (![point.timeSinceStageStartSeconds, point.thrustN,
          point.massFlowKgPerSecond].every(Number.isFinite) ||
          point.timeSinceStageStartSeconds <= previousCurveTime ||
          point.thrustN < 0 || point.massFlowKgPerSecond < 0) {
          throw new RangeError("Motor thrust curve values must be ordered and non-negative.");
        }
        previousCurveTime = point.timeSinceStageStartSeconds;
      }
    }
    previousStageEnd = stage.endTimeSeconds;
  }
  let previousMach = -Infinity;
  for (const sample of model.zeroLiftDragMachTable) {
    const values = Object.values(sample);
    if (!values.every(Number.isFinite) || sample.mach <= previousMach ||
      sample.mach < 0 || sample.zeroLiftDragCoefficient <= 0 ||
      sample.normalForceSlopePerRad <= 0 || sample.sideForceSlopePerRad <= 0 ||
      sample.rollControlEffectiveness < 0 || sample.pitchControlEffectiveness < 0 ||
      sample.yawControlEffectiveness < 0) {
      throw new RangeError("6-DoF aerodynamic samples must be ordered and physically bounded.");
    }
    previousMach = sample.mach;
  }
}
function validateState(state: Missile6DofState, model: Missile6DofModel): void {
  for (const [label, vector] of [
    ["position", state.positionWorldM],
    ["velocity", state.velocityWorldMps],
    ["body angular rates", state.angularRatesBodyRadPerSecond],
    ["fin deflections", state.finDeflectionsRad]
  ] as const) validateVector(vector, label);
  normalizeQuaternion(state.bodyToWorld);
  if (!Number.isFinite(state.massKg) || state.massKg < model.dryMassKg ||
    !Number.isFinite(state.propellantMassKg) || state.propellantMassKg < 0 ||
    state.propellantMassKg > model.initialPropellantMassKg + 1e-9 ||
    state.massKg + 1e-9 < model.dryMassKg + state.propellantMassKg ||
    !Number.isFinite(state.elapsedFlightSeconds) || state.elapsedFlightSeconds < 0) {
    throw new RangeError("6-DoF missile state violates mass or time constraints.");
  }
}
function validateEnvironment(environment: Missile6DofEnvironment): void {
  validateVector(environment.windWorldMps, "Wind");
  if (!Number.isFinite(environment.airDensityKgPerM3) || environment.airDensityKgPerM3 < 0 ||
    !Number.isFinite(environment.speedOfSoundMps) || environment.speedOfSoundMps <= 0 ||
    !Number.isFinite(environment.gravityMps2) || environment.gravityMps2 < 0) {
    throw new RangeError("6-DoF missile environment is invalid.");
  }
}
function solveDynamics(
  state: Missile6DofState,
  model: Missile6DofModel,
  environment: Missile6DofEnvironment,
  finDeflections: Vector3,
  thrustN: number,
  propellantAfterStep: number
): ForceMomentSolution {
  const airVelocityWorld = subtract(state.velocityWorldMps, environment.windWorldMps);
  const airVelocityBody = rotateWorldToBody(airVelocityWorld, state.bodyToWorld);
  const airspeed = magnitude(airVelocityBody);
  const mach = airspeed / environment.speedOfSoundMps;
  const q = 0.5 * environment.airDensityKgPerM3 * airspeed * airspeed;
  const aero = interpolateAero(model.zeroLiftDragMachTable, mach).sample;
  const inRange = interpolateAero(model.zeroLiftDragMachTable, mach).inRange;
  const alpha = clamp(Math.atan2(airVelocityBody[2], airVelocityBody[0]),
    -model.maximumAngleOfAttackRad, model.maximumAngleOfAttackRad);
  const beta = clamp(Math.asin(clamp(airVelocityBody[1] / Math.max(airspeed, 1e-9), -1, 1)),
    -model.maximumSideslipRad, model.maximumSideslipRad);
  const velocityForRate = Math.max(airspeed, 1);
  const pHat = state.angularRatesBodyRadPerSecond[0] * model.referenceSpanM / (2 * velocityForRate);
  const qHat = state.angularRatesBodyRadPerSecond[1] * model.referenceLengthM / (2 * velocityForRate);
  const rHat = state.angularRatesBodyRadPerSecond[2] * model.referenceSpanM / (2 * velocityForRate);
  const authority = model.actuatorAuthorityFraction;

  const cn = aero.normalForceSlopePerRad * alpha +
    aero.pitchControlEffectiveness * finDeflections[1] * authority +
    aero.pitchDampingDerivative * qHat;
  const cy = aero.sideForceSlopePerRad * beta +
    aero.yawControlEffectiveness * finDeflections[2] * authority +
    aero.yawDampingDerivative * rHat;
  const cd = aero.zeroLiftDragCoefficient + model.inducedDragFactor * (cn * cn + cy * cy);
  const forceAero: Vector3 = [
    -q * model.referenceAreaM2 * cd,
    q * model.referenceAreaM2 * cy,
    -q * model.referenceAreaM2 * cn
  ];
  const forceThrust: Vector3 = [thrustN, 0, 0];
  const forceBodyN = add(forceAero, forceThrust);

  const inertia = inertiaForMass(model, propellantAfterStep);
  const rollCoefficient = aero.rollSideslipDerivative * beta +
    aero.rollDampingDerivative * pHat +
    aero.rollControlEffectiveness * finDeflections[0] * authority;
  const pitchCoefficient = aero.pitchAlphaDerivative * alpha +
    aero.pitchDampingDerivative * qHat +
    aero.pitchControlEffectiveness * finDeflections[1] * authority;
  const yawCoefficient = aero.yawSideslipDerivative * beta +
    aero.yawDampingDerivative * rHat +
    aero.yawControlEffectiveness * finDeflections[2] * authority;
  let momentAero: Vector3 = [
    q * model.referenceAreaM2 * model.referenceSpanM * rollCoefficient,
    q * model.referenceAreaM2 * model.referenceLengthM * pitchCoefficient,
    q * model.referenceAreaM2 * model.referenceSpanM * yawCoefficient
  ];
  momentAero = add(momentAero, cross(subtract(model.aerodynamicCenterBodyM, inertia.center), forceAero));
  const momentThrust = cross(subtract(model.thrustApplicationPointBodyM, inertia.center), forceThrust);
  const totalMoment = add(momentAero, momentThrust);

  const angularMomentum: Vector3 = [
    inertia.inertia[0] * state.angularRatesBodyRadPerSecond[0],
    inertia.inertia[1] * state.angularRatesBodyRadPerSecond[1],
    inertia.inertia[2] * state.angularRatesBodyRadPerSecond[2]
  ];
  const gyroscopic = cross(state.angularRatesBodyRadPerSecond, angularMomentum);
  const angularAcceleration: Vector3 = [
    (totalMoment[0] - gyroscopic[0]) / inertia.inertia[0],
    (totalMoment[1] - gyroscopic[1]) / inertia.inertia[1],
    (totalMoment[2] - gyroscopic[2]) / inertia.inertia[2]
  ];
  const forceWorld = rotateBodyToWorld(forceBodyN, state.bodyToWorld);
  const gravityWorld: Vector3 = [0, 0, -environment.gravityMps2];
  const accelerationWorldMps2 = add(scale(forceWorld, 1 / state.massKg), gravityWorld);
  const aerodynamicNormalForce = Math.hypot(forceAero[1], forceAero[2]);
  const normalAccelerationG = aerodynamicNormalForce / state.massKg / 9.80665;
  return {
    forceBodyN,
    aerodynamicForceBodyN: forceAero,
    aerodynamicMomentBodyNm: momentAero,
    totalMomentBodyNm: totalMoment,
    accelerationWorldMps2,
    angularAccelerationBodyRadPerSecond2: angularAcceleration,
    mach,
    dynamicPressurePa: q,
    angleOfAttackRad: alpha,
    sideslipRad: beta,
    cd0: aero.zeroLiftDragCoefficient,
    normalForceCoefficient: cn,
    sideForceCoefficient: cy,
    normalAccelerationG,
    aeroDataInRange: inRange
  };
}

/**
 * Six-degree-of-freedom missile rigid-body integrator in body FRD/world ENU.
 * It resolves aerodynamic forces/moments, gyroscopic coupling, body attitude,
 * moving mass/CG/inertia, fin servo lag/rate limits, motor stages and gravity.
 * Coefficient tables and actuator/motor profiles are product-specific inputs;
 * no generic profile is asserted to represent a real missile.
 */
export function stepMissile6Dof(
  previous: Missile6DofState,
  model: Missile6DofModel,
  environment: Missile6DofEnvironment,
  input: Missile6DofStepInput
): Missile6DofStepResult {
  validateModel(model);
  validateState(previous, model);
  validateEnvironment(environment);
  if (!Number.isFinite(input.deltaTimeSeconds) || input.deltaTimeSeconds <= 0) {
    throw new RangeError("Missile 6-DoF integration interval must be positive and finite.");
  }
  validateVector(input.commandedFinDeflectionsRad, "Commanded fin deflections");
  const authority = input.controlAuthorityFraction ?? 1;
  if (!Number.isFinite(authority) || authority < 0 || authority > 1) {
    throw new RangeError("Control authority must be within [0, 1].");
  }

  const dt = input.deltaTimeSeconds;
  const finDeflections = servoStep(
    previous.finDeflectionsRad,
    input.commandedFinDeflectionsRad,
    model,
    dt,
    authority
  );
  const motor = motorStep(model, previous.elapsedFlightSeconds, dt, previous.propellantMassKg);
  const propellantAfterStep = Math.max(0, previous.propellantMassKg - motor.consumedKg);
  const massKg = Math.max(model.dryMassKg, previous.massKg - motor.consumedKg);

  const initial = solveDynamics(previous, model, environment, finDeflections,
    motor.thrustN, previous.propellantMassKg);
  const midpointRates = add(
    previous.angularRatesBodyRadPerSecond,
    scale(initial.angularAccelerationBodyRadPerSecond2, dt * 0.5)
  );
  const midpointVelocity = add(
    previous.velocityWorldMps,
    scale(initial.accelerationWorldMps2, dt * 0.5)
  );
  const midpointOrientation = integrateQuaternion(previous.bodyToWorld, midpointRates, dt * 0.5);
  const midpointState: Missile6DofState = {
    ...previous,
    velocityWorldMps: midpointVelocity,
    bodyToWorld: midpointOrientation,
    angularRatesBodyRadPerSecond: midpointRates,
    finDeflectionsRad: finDeflections,
    massKg: Math.max(model.dryMassKg, previous.massKg - motor.consumedKg * 0.5),
    propellantMassKg: Math.max(0, previous.propellantMassKg - motor.consumedKg * 0.5)
  };
  const midpoint = solveDynamics(midpointState, model, environment, finDeflections,
    motor.thrustN, propellantAfterStep);
  const velocityWorldMps = add(
    previous.velocityWorldMps,
    scale(midpoint.accelerationWorldMps2, dt)
  );
  const positionWorldM = add(
    previous.positionWorldM,
    add(scale(previous.velocityWorldMps, dt),
      scale(midpoint.accelerationWorldMps2, 0.5 * dt * dt))
  );
  const angularAcceleration = clampVector(
    midpoint.angularAccelerationBodyRadPerSecond2,
    model.maximumAngularAccelerationRadPerSecond2
  );
  const angularRatesBodyRadPerSecond = clampVector(
    add(previous.angularRatesBodyRadPerSecond, scale(angularAcceleration, dt)),
    model.maximumBodyRateRadPerSecond
  );
  const averageRates = scale(add(previous.angularRatesBodyRadPerSecond, angularRatesBodyRadPerSecond), 0.5);
  const bodyToWorld = integrateQuaternion(previous.bodyToWorld, averageRates, dt);
  const state: Missile6DofState = {
    positionWorldM,
    velocityWorldMps,
    bodyToWorld,
    angularRatesBodyRadPerSecond,
    finDeflectionsRad: finDeflections,
    massKg,
    propellantMassKg: propellantAfterStep,
    elapsedFlightSeconds: previous.elapsedFlightSeconds + dt
  };
  return {
    state,
    diagnostics: {
      mach: midpoint.mach,
      dynamicPressurePa: midpoint.dynamicPressurePa,
      angleOfAttackRad: midpoint.angleOfAttackRad,
      sideslipRad: midpoint.sideslipRad,
      zeroLiftDragCoefficient: midpoint.cd0,
      normalForceCoefficient: midpoint.normalForceCoefficient,
      sideForceCoefficient: midpoint.sideForceCoefficient,
      aerodynamicForceBodyN: midpoint.aerodynamicForceBodyN,
      totalForceBodyN: midpoint.forceBodyN,
      aerodynamicMomentBodyNm: midpoint.aerodynamicMomentBodyNm,
      totalMomentBodyNm: midpoint.totalMomentBodyNm,
      propulsiveThrustN: motor.thrustN,
      propellantConsumedKg: motor.consumedKg,
      normalAccelerationG: Math.min(model.maximumNormalAccelerationG, midpoint.normalAccelerationG),
      actuatorDeflectionRad: finDeflections,
      effectiveMassCenterBodyM: inertiaForMass(model, propellantAfterStep).center,
      effectiveInertiaKgM2: inertiaForMass(model, propellantAfterStep).inertia,
      aeroDataInRange: midpoint.aeroDataInRange
    }
  };
}

/** Creates a nose-forward level initial attitude from an explicit body-to-world quaternion. */
export function createMissile6DofState(
  initial: Omit<Missile6DofState, "finDeflectionsRad" | "massKg" | "propellantMassKg" | "elapsedFlightSeconds">,
  model: Missile6DofModel
): Missile6DofState {
  validateModel(model);
  return {
    ...initial,
    bodyToWorld: normalizeQuaternion(initial.bodyToWorld),
    finDeflectionsRad: [0, 0, 0],
    massKg: model.dryMassKg + model.initialPropellantMassKg,
    propellantMassKg: model.initialPropellantMassKg,
    elapsedFlightSeconds: 0
  };
}
