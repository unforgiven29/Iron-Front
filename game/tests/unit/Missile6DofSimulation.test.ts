import { describe, expect, it } from "vitest";
import { createMissile6DofState, type Missile6DofModel } from "../../src/physics/ballistics/Missile6DofDynamics.js";
import { stepGuidedMissile6Dof } from "../../src/weapons/Missile6DofSimulation.js";
import type { GuidanceStateEstimate } from "../../src/physics/guidance/GuidanceLaws.js";

const model: Missile6DofModel = {
  referenceAreaM2: 0.01,
  referenceLengthM: 1.5,
  referenceSpanM: 0.25,
  zeroLiftDragMachTable: [0, 3].map((mach) => ({
    mach,
    zeroLiftDragCoefficient: 0.3,
    normalForceSlopePerRad: 5,
    sideForceSlopePerRad: 3,
    rollDampingDerivative: -0.2,
    pitchDampingDerivative: -0.3,
    yawDampingDerivative: -0.2,
    rollSideslipDerivative: -0.1,
    pitchAlphaDerivative: 0,
    yawSideslipDerivative: 0.1,
    rollControlEffectiveness: 0.2,
    pitchControlEffectiveness: 0.2,
    yawControlEffectiveness: 0.2
  })),
  inducedDragFactor: 0.05,
  maximumAngleOfAttackRad: 0.35,
  maximumSideslipRad: 0.25,
  dryMassKg: 10,
  initialPropellantMassKg: 0,
  dryInertiaKgM2: [1, 2, 2.5],
  launchInertiaKgM2: [1, 2, 2.5],
  dryCenterOfGravityBodyM: [0, 0, 0],
  launchCenterOfGravityBodyM: [0, 0, 0],
  aerodynamicCenterBodyM: [0, 0, 0],
  thrustApplicationPointBodyM: [0, 0, 0],
  motorStages: [],
  actuatorTimeConstantSeconds: 0.1,
  maximumFinDeflectionRadians: 0.25,
  maximumFinRateRadiansPerSecond: 1,
  maximumBodyRateRadPerSecond: 20,
  actuatorAuthorityFraction: 1,
  maximumNormalAccelerationG: 30,
  maximumAngularAccelerationRadPerSecond2: 200
};

const state = createMissile6DofState({
  positionWorldM: [0, 0, 1000],
  velocityWorldMps: [300, 0, 0],
  bodyToWorld: [0, 0, 0, 1],
  angularRatesBodyRadPerSecond: [0, 0, 0]
}, model);

const environment = {
  airDensityKgPerM3: 1,
  speedOfSoundMps: 340,
  windWorldMps: [0, 0, 0] as const,
  gravityMps2: 9.80665
};

const estimate: GuidanceStateEstimate = {
  missilePositionWorldM: [0, 0, 1000],
  missileVelocityWorldMps: [300, 0, 0],
  targetPositionEstimateWorldM: [5000, 1000, 1000],
  targetVelocityEstimateWorldMps: [250, 0, 0],
  estimateTimeSeconds: 1,
  measurementAgeSeconds: 0.05,
  positionStandardDeviationM: 10,
  velocityStandardDeviationMps: 2
};

describe("guided 6-DoF missile simulation", () => {
  it("connects uncertain guidance output to body fin demand and rigid-body motion", () => {
    const result = stepGuidedMissile6Dof(state, model, environment, {
      deltaTimeSeconds: 0.05,
      guidanceEstimate: estimate,
      guidanceMethod: "proportional-navigation",
      guidanceConfiguration: {
        navigationConstant: 3,
        maximumCommandedAccelerationMps2: 100,
        maximumMeasurementAgeSeconds: 0.5,
        maximumPositionUncertaintyM: 100,
        minimumEngagementRangeM: 10
      },
      controllerConfiguration: {
        rollRateDampingGain: 0.1,
        pitchRateDampingGain: 0.05,
        yawRateDampingGain: 0.05,
        lowDynamicPressureCutoffPa: 100
      }
    });
    expect(result.guidanceValid).toBe(true);
    expect(result.controlAvailable).toBe(true);
    expect(result.finCommandsRad.some((value) => Math.abs(value) > 0)).toBe(true);
    expect(result.state.elapsedFlightSeconds).toBeCloseTo(0.05, 10);
    expect(Math.hypot(...result.state.bodyToWorld)).toBeCloseTo(1, 10);
  });

  it("fails closed on stale guidance estimates rather than steering from outdated state", () => {
    const result = stepGuidedMissile6Dof(state, model, environment, {
      deltaTimeSeconds: 0.05,
      guidanceEstimate: { ...estimate, measurementAgeSeconds: 5 },
      guidanceMethod: "proportional-navigation",
      guidanceConfiguration: {
        navigationConstant: 3,
        maximumCommandedAccelerationMps2: 100,
        maximumMeasurementAgeSeconds: 0.5,
        maximumPositionUncertaintyM: 100,
        minimumEngagementRangeM: 10
      },
      controllerConfiguration: {
        rollRateDampingGain: 0.1,
        pitchRateDampingGain: 0.05,
        yawRateDampingGain: 0.05,
        lowDynamicPressureCutoffPa: 100
      }
    });
    expect(result.guidanceValid).toBe(false);
    expect(result.guidanceReason).toBe("stale-measurement");
    expect(result.commandedAccelerationWorldMps2).toEqual([0, 0, 0]);
  });
});
