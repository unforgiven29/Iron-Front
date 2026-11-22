import type { Quaternion, Vector3 } from "../../core/coordinates/CoordinateFrames.js";
import {
  sampleMissile6DofAerodynamics,
  type Missile6DofEnvironment,
  type Missile6DofModel,
  type Missile6DofState
} from "../ballistics/Missile6DofDynamics.js";

export interface MissileFinControllerConfiguration {
  readonly rollRateDampingGain: number;
  readonly pitchRateDampingGain: number;
  readonly yawRateDampingGain: number;
  readonly lowDynamicPressureCutoffPa: number;
}

export interface MissileFinControllerResult {
  readonly finCommandsRad: Vector3;
  readonly desiredNormalForceCoefficient: number;
  readonly desiredSideForceCoefficient: number;
  readonly currentAngleOfAttackRad: number;
  readonly currentSideslipRad: number;
  readonly dynamicPressurePa: number;
  readonly controlAvailable: boolean;
}

/**
 * Converts an inertial guidance acceleration command into missile fin demands.
 * The controller closes body-normal acceleration loops against the current
 * measured/estimated body-axis air state and Mach-interpolated control derivatives.
 * It does not bypass actuator lag, rate limits, aerodynamic force limits or
 * sensor/guidance uncertainty; those are enforced in the 6-DoF integrator.
 */
export function computeMissile6DofFinCommands(
  state: Missile6DofState,
  model: Missile6DofModel,
  environment: Missile6DofEnvironment,
  desiredAccelerationWorldMps2: Vector3,
  controller: MissileFinControllerConfiguration,
  controlAuthorityFraction = 1
): MissileFinControllerResult {
  if (!desiredAccelerationWorldMps2.every(Number.isFinite) ||
    !environment.windWorldMps.every(Number.isFinite) ||
    !Number.isFinite(environment.airDensityKgPerM3) || environment.airDensityKgPerM3 < 0 ||
    !Number.isFinite(environment.speedOfSoundMps) || environment.speedOfSoundMps <= 0 ||
    !Number.isFinite(controlAuthorityFraction) || controlAuthorityFraction < 0 ||
    controlAuthorityFraction > 1 ||
    ![controller.rollRateDampingGain, controller.pitchRateDampingGain,
      controller.yawRateDampingGain, controller.lowDynamicPressureCutoffPa].every(Number.isFinite) ||
    controller.rollRateDampingGain < 0 || controller.pitchRateDampingGain < 0 ||
    controller.yawRateDampingGain < 0 || controller.lowDynamicPressureCutoffPa < 0) {
    throw new RangeError("Missile fin-controller input or configuration is invalid.");
  }

  const relativeAirVelocityWorld = subtract(state.velocityWorldMps, environment.windWorldMps);
  const relativeAirVelocityBody = rotateWorldToBody(relativeAirVelocityWorld, state.bodyToWorld);
  const airspeed = magnitude(relativeAirVelocityBody);
  const mach = airspeed / environment.speedOfSoundMps;
  const dynamicPressurePa = 0.5 * environment.airDensityKgPerM3 * airspeed ** 2;
  const desiredBodyAcceleration = rotateWorldToBody(
    desiredAccelerationWorldMps2,
    state.bodyToWorld
  );

  if (dynamicPressurePa <= controller.lowDynamicPressureCutoffPa ||
    state.massKg <= 0 || model.actuatorAuthorityFraction * controlAuthorityFraction <= 0) {
    return {
      finCommandsRad: [0, 0, 0],
      desiredNormalForceCoefficient: 0,
      desiredSideForceCoefficient: 0,
      currentAngleOfAttackRad: 0,
      currentSideslipRad: 0,
      dynamicPressurePa,
      controlAvailable: false
    };
  }

  const aero = sampleMissile6DofAerodynamics(model, mach).sample;
  const alpha = clamp(
    Math.atan2(relativeAirVelocityBody[2], relativeAirVelocityBody[0]),
    -model.maximumAngleOfAttackRad,
    model.maximumAngleOfAttackRad
  );
  const beta = clamp(
    Math.asin(clamp(relativeAirVelocityBody[1] / Math.max(airspeed, 1e-9), -1, 1)),
    -model.maximumSideslipRad,
    model.maximumSideslipRad
  );
  const speedForRate = Math.max(airspeed, 1);
  const pHat = state.angularRatesBodyRadPerSecond[0] * model.referenceSpanM / (2 * speedForRate);
  const qHat = state.angularRatesBodyRadPerSecond[1] * model.referenceLengthM / (2 * speedForRate);
  const rHat = state.angularRatesBodyRadPerSecond[2] * model.referenceSpanM / (2 * speedForRate);
  const qArea = dynamicPressurePa * model.referenceAreaM2;
  const authority = model.actuatorAuthorityFraction * controlAuthorityFraction;

  const maximumNormalCoefficient = model.maximumNormalAccelerationG * 9.80665 *
    state.massKg / qArea;
  const desiredCnRaw = -state.massKg * desiredBodyAcceleration[2] / qArea;
  const desiredCyRaw = state.massKg * desiredBodyAcceleration[1] / qArea;
  const requestedNormalCoefficient = Math.hypot(desiredCnRaw, desiredCyRaw);
  const normalScale = requestedNormalCoefficient > maximumNormalCoefficient
    ? maximumNormalCoefficient / requestedNormalCoefficient
    : 1;
  const desiredCn = desiredCnRaw * normalScale;
  const desiredCy = desiredCyRaw * normalScale;

  const currentStaticCn = aero.normalForceSlopePerRad * alpha +
    aero.pitchDampingDerivative * qHat;
  const currentStaticCy = aero.sideForceSlopePerRad * beta +
    aero.yawDampingDerivative * rHat;
  const currentRollCoefficient = aero.rollSideslipDerivative * beta +
    aero.rollDampingDerivative * pHat;

  const pitchDemand = aero.pitchControlEffectiveness !== 0
    ? (desiredCn - currentStaticCn) /
      (aero.pitchControlEffectiveness * authority)
    : 0;
  const yawDemand = aero.yawControlEffectiveness !== 0
    ? (desiredCy - currentStaticCy) /
      (aero.yawControlEffectiveness * authority)
    : 0;
  const rollDemand = aero.rollControlEffectiveness !== 0
    ? (-currentRollCoefficient - controller.rollRateDampingGain *
      state.angularRatesBodyRadPerSecond[0]) /
      (aero.rollControlEffectiveness * authority)
    : 0;

  const finCommandsRad: Vector3 = [
    clamp(rollDemand, -model.maximumFinDeflectionRadians, model.maximumFinDeflectionRadians),
    clamp(pitchDemand - controller.pitchRateDampingGain *
      state.angularRatesBodyRadPerSecond[1], -model.maximumFinDeflectionRadians, model.maximumFinDeflectionRadians),
    clamp(yawDemand - controller.yawRateDampingGain *
      state.angularRatesBodyRadPerSecond[2], -model.maximumFinDeflectionRadians, model.maximumFinDeflectionRadians)
  ];
  return {
    finCommandsRad,
    desiredNormalForceCoefficient: desiredCn,
    desiredSideForceCoefficient: desiredCy,
    currentAngleOfAttackRad: alpha,
    currentSideslipRad: beta,
    dynamicPressurePa,
    controlAvailable: true
  };
}

function subtract(a: Vector3, b: Vector3): Vector3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function magnitude(vector: Vector3): number {
  return Math.hypot(vector[0], vector[1], vector[2]);
}
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function rotateWorldToBody(vector: Vector3, bodyToWorld: Quaternion): Vector3 {
  const length = Math.hypot(
    bodyToWorld[0], bodyToWorld[1], bodyToWorld[2], bodyToWorld[3]
  );
  if (!Number.isFinite(length) || length < 1e-12) {
    throw new RangeError("Missile body attitude quaternion is invalid.");
  }
  const qx = -bodyToWorld[0] / length;
  const qy = -bodyToWorld[1] / length;
  const qz = -bodyToWorld[2] / length;
  const qw = bodyToWorld[3] / length;
  const uv: Vector3 = [
    qy * vector[2] - qz * vector[1],
    qz * vector[0] - qx * vector[2],
    qx * vector[1] - qy * vector[0]
  ];
  const uuv: Vector3 = [
    qy * uv[2] - qz * uv[1],
    qz * uv[0] - qx * uv[2],
    qx * uv[1] - qy * uv[0]
  ];
  return [
    vector[0] + 2 * (qw * uv[0] + uuv[0]),
    vector[1] + 2 * (qw * uv[1] + uuv[1]),
    vector[2] + 2 * (qw * uv[2] + uuv[2])
  ];
}
