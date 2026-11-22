import { describe, expect, it } from "vitest";
import { createMissileRuntimeState, stepMissileRuntime } from "../../src/weapons/MissileRuntime.js";
import type { MissileAerodynamicModel, MissileState } from "../../src/physics/ballistics/MissileDynamics.js";

const aero: MissileAerodynamicModel = {
  referenceAreaM2: 0.01,
  dragCoefficientByMach: [{ mach: 0, dragCoefficient: 0.3 }, { mach: 2, dragCoefficient: 0.4 }],
  maximumNormalAccelerationG: 15,
  normalForceCoefficientSlopePerRad: 10,
  maximumAngleOfAttackRad: 0.3,
  inducedDragFactor: 0.05,
  controlResponseTimeSeconds: 0.1,
  maximumNormalJerkMps3: 500,
  motorStages: []
};
const initial: MissileState = {
  positionWorldM: [0, 0, 1000],
  velocityWorldMps: [0, 1000, 0],
  massKg: 80,
  propellantMassKg: 0,
  elapsedFlightSeconds: 0,
  actualNormalAccelerationWorldMps2: [0, 0, 0]
};
const model = {
  aerodynamic: aero,
  guidanceMethod: "proportional-navigation" as const,
  guidance: {
    navigationConstant: 3,
    maximumCommandedAccelerationMps2: 100,
    maximumMeasurementAgeSeconds: 0.5,
    maximumPositionUncertaintyM: 100,
    minimumEngagementRangeM: 10
  },
  fuze: {
    armingDelaySeconds: 0.1,
    armingDistanceM: 50,
    proximityRadiusM: 10,
    minimumEventConfidence: 0.8,
    maximumFlightTimeSeconds: 10
  },
  terminalSeekerRequired: true
};
const environment = {
  airDensityKgPerM3: 0,
  speedOfSoundMps: 340,
  windWorldMps: [0, 0, 0] as const,
  gravityMps2: 0
};

describe("post-launch missile lifecycle", () => {
  it("does not arm early and requires an externally supplied fuze event", () => {
    const first = stepMissileRuntime(createMissileRuntimeState(initial), model, {
      deltaTimeSeconds: 0.1,
      environment,
      seekerState: "track",
      fuzeEvent: {
        kind: "impact",
        eventTimeSeconds: 0.05,
        missDistanceM: 0,
        confidence: 1
      }
    });
    expect(first.detonated).toBe(false);
    expect(first.state.phase).toBe("terminal");

    const second = stepMissileRuntime(first.state, model, {
      deltaTimeSeconds: 0.1,
      environment,
      seekerState: "track",
      fuzeEvent: {
        kind: "proximity",
        eventTimeSeconds: 0.15,
        missDistanceM: 5,
        confidence: 0.9
      }
    });
    expect(second.detonated).toBe(true);
    expect(second.state.phase).toBe("detonated");
  });

  it("self-destructs at its configured maximum flight time", () => {
    const shortFuse = {
      ...model,
      fuze: { ...model.fuze, maximumFlightTimeSeconds: 0.1 }
    };
    const result = stepMissileRuntime(createMissileRuntimeState(initial), shortFuse, {
      deltaTimeSeconds: 0.1,
      environment,
      seekerState: "search"
    });
    expect(result.selfDestructed).toBe(true);
    expect(result.state.phase).toBe("self-destructed");
  });
});
