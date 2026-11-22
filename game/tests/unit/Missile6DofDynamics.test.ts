import { describe, expect, it } from "vitest";
import {
  createMissile6DofState,
  stepMissile6Dof,
  type Missile6DofModel
} from "../../src/physics/ballistics/Missile6DofDynamics.js";

const model: Missile6DofModel = {
  referenceAreaM2: 0.01,
  referenceLengthM: 1.5,
  referenceSpanM: 0.25,
  zeroLiftDragMachTable: [
    {
      mach: 0,
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
    },
    {
      mach: 3,
      zeroLiftDragCoefficient: 0.4,
      normalForceSlopePerRad: 4,
      sideForceSlopePerRad: 2,
      rollDampingDerivative: -0.2,
      pitchDampingDerivative: -0.3,
      yawDampingDerivative: -0.2,
      rollSideslipDerivative: -0.1,
      pitchAlphaDerivative: 0,
      yawSideslipDerivative: 0.1,
      rollControlEffectiveness: 0.2,
      pitchControlEffectiveness: 0.2,
      yawControlEffectiveness: 0.2
    }
  ],
  inducedDragFactor: 0.05,
  maximumAngleOfAttackRad: 0.35,
  maximumSideslipRad: 0.25,
  dryMassKg: 10,
  initialPropellantMassKg: 2,
  dryInertiaKgM2: [1, 2, 2.5],
  launchInertiaKgM2: [1.4, 2.6, 3.1],
  dryCenterOfGravityBodyM: [0.1, 0, 0],
  launchCenterOfGravityBodyM: [0, 0, 0],
  aerodynamicCenterBodyM: [0, 0, 0],
  thrustApplicationPointBodyM: [0, 0, 0],
  motorStages: [
    { startTimeSeconds: 0, endTimeSeconds: 1, thrustN: 500, massFlowKgPerSecond: 0.1 }
  ],
  actuatorTimeConstantSeconds: 0.1,
  maximumFinDeflectionRadians: 0.25,
  maximumFinRateRadiansPerSecond: 1,
  maximumBodyRateRadPerSecond: 20,
  actuatorAuthorityFraction: 1,
  maximumNormalAccelerationG: 30,
  maximumAngularAccelerationRadPerSecond2: 200
};

const environment = {
  airDensityKgPerM3: 1,
  speedOfSoundMps: 340,
  windWorldMps: [0, 0, 0] as const,
  gravityMps2: 0
};

function initialState() {
  return createMissile6DofState({
    positionWorldM: [0, 0, 1000],
    velocityWorldMps: [150, 0, 15],
    bodyToWorld: [0, 0, 0, 1],
    angularRatesBodyRadPerSecond: [0, 0, 0]
  }, model);
}

describe("six-degree-of-freedom missile rigid-body dynamics", () => {
  it("integrates translational forces, motor mass flow and moving inertia/CG", () => {
    const initial = initialState();
    const result = stepMissile6Dof(initial, model, environment, {
      deltaTimeSeconds: 0.1,
      commandedFinDeflectionsRad: [0, 0, 0]
    });
    expect(result.state.massKg).toBeCloseTo(11.99, 8);
    expect(result.state.propellantMassKg).toBeCloseTo(1.99, 8);
    expect(result.diagnostics.propulsiveThrustN).toBe(500);
    expect(result.state.velocityWorldMps[0]).toBeGreaterThan(150);
    expect(result.diagnostics.effectiveInertiaKgM2[0]).toBeLessThan(model.launchInertiaKgM2[0]);
    expect(result.diagnostics.effectiveMassCenterBodyM[0]).toBeGreaterThan(0);
  });

  it("moves the fin servos, generates body moment and changes attitude", () => {
    const result = stepMissile6Dof(initialState(), {
      ...model,
      motorStages: []
    }, environment, {
      deltaTimeSeconds: 0.2,
      commandedFinDeflectionsRad: [0, 0.1, 0]
    });
    expect(result.state.finDeflectionsRad[1]).toBeGreaterThan(0);
    expect(result.diagnostics.totalMomentBodyNm[1]).toBeGreaterThan(0);
    expect(result.state.angularRatesBodyRadPerSecond[1]).toBeGreaterThan(0);
    expect(result.state.bodyToWorld).not.toEqual([0, 0, 0, 1]);
    expect(Math.hypot(...result.state.bodyToWorld)).toBeCloseTo(1, 10);
  });

  it("rejects malformed Mach tables, invalid inertia and impossible motor stages", () => {
    expect(() => stepMissile6Dof(initialState(), {
      ...model,
      dryInertiaKgM2: [0, 2, 2.5]
    }, environment, {
      deltaTimeSeconds: 0.1,
      commandedFinDeflectionsRad: [0, 0, 0]
    })).toThrow(RangeError);
    expect(() => stepMissile6Dof(initialState(), {
      ...model,
      motorStages: [
        { startTimeSeconds: 0.5, endTimeSeconds: 2, thrustN: 100, massFlowKgPerSecond: 0.1 },
        { startTimeSeconds: 1, endTimeSeconds: 3, thrustN: 100, massFlowKgPerSecond: 0.1 }
      ]
    }, environment, {
      deltaTimeSeconds: 0.1,
      commandedFinDeflectionsRad: [0, 0, 0]
    })).toThrow(RangeError);
  });
});
