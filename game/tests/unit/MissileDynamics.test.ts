import { describe, expect, it } from "vitest";
import { stepMissile3Dof, type MissileAerodynamicModel, type MissileState } from "../../src/physics/ballistics/MissileDynamics.js";

const model: MissileAerodynamicModel = {
  referenceAreaM2: 0.02,
  dragCoefficientByMach: [
    { mach: 0, dragCoefficient: 0.3 },
    { mach: 1, dragCoefficient: 0.5 },
    { mach: 2, dragCoefficient: 0.35 }
  ],
  maximumNormalAccelerationG: 20,
  controlResponseTimeSeconds: 0.1,
  maximumNormalJerkMps3: 1000,
  motorStages: [
    { startTimeSeconds: 0, endTimeSeconds: 1, thrustN: 1000, massFlowKgPerSecond: 0.1 },
    { startTimeSeconds: 1, endTimeSeconds: 2, thrustN: 500, massFlowKgPerSecond: 0.05 }
  ]
};

const state: MissileState = {
  positionWorldM: [0, 0, 1000],
  velocityWorldMps: [0, 300, 0],
  massKg: 100,
  propellantMassKg: 10,
  elapsedFlightSeconds: 0,
  actualNormalAccelerationWorldMps2: [0, 0, 0]
};

describe("3-DoF staged missile flight dynamics", () => {
  it("consumes propellant, changes mass and accelerates under staged thrust", () => {
    const result = stepMissile3Dof(state, model, {
      airDensityKgPerM3: 1.0,
      speedOfSoundMps: 340,
      windWorldMps: [0, 0, 0],
      gravityMps2: 9.80665
    }, {
      deltaTimeSeconds: 0.1,
      commandedAccelerationWorldMps2: [0, 0, 0]
    });
    expect(result.state.propellantMassKg).toBeCloseTo(9.99, 8);
    expect(result.state.massKg).toBeCloseTo(99.99, 8);
    expect(result.state.velocityWorldMps[1]).toBeGreaterThan(300);
    expect(result.diagnostics.thrustN).toBe(1000);
    expect(result.diagnostics.dynamicPressurePa).toBeGreaterThan(0);
  });

  it("limits normal acceleration using command response, jerk and maximum G", () => {
    const result = stepMissile3Dof(state, model, {
      airDensityKgPerM3: 0,
      speedOfSoundMps: 340,
      windWorldMps: [0, 0, 0],
      gravityMps2: 0
    }, {
      deltaTimeSeconds: 0.1,
      commandedAccelerationWorldMps2: [10000, 0, 0]
    });
    expect(result.diagnostics.normalAccelerationMps2).toBeLessThanOrEqual(20 * 9.80665);
    expect(result.diagnostics.normalAccelerationMps2).toBeGreaterThan(0);
    expect(result.state.actualNormalAccelerationWorldMps2[1]).toBeCloseTo(0, 10);
  });

  it("rejects invalid mass, motor staging and integration intervals", () => {
    expect(() => stepMissile3Dof({ ...state, massKg: 0 }, model, {
      airDensityKgPerM3: 1, speedOfSoundMps: 340, windWorldMps: [0, 0, 0], gravityMps2: 9.8
    }, { deltaTimeSeconds: 0.1, commandedAccelerationWorldMps2: [0, 0, 0] })).toThrow(RangeError);
    expect(() => stepMissile3Dof(state, model, {
      airDensityKgPerM3: 1, speedOfSoundMps: 340, windWorldMps: [0, 0, 0], gravityMps2: 9.8
    }, { deltaTimeSeconds: 0, commandedAccelerationWorldMps2: [0, 0, 0] })).toThrow(RangeError);
  });
});
