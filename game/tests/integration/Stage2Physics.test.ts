import { describe, expect, it } from "vitest";
import type { Vector3 } from "../../src/core/coordinates/CoordinateFrames.js";
import { createSave, loadSave, type PersistableModule } from "../../src/core/persistence/SaveState.js";
import { SimulationScheduler } from "../../src/core/simulation/SimulationScheduler.js";
import { segmentTerrainIntersection, type TerrainSegmentResult } from "../../src/physics/collision/Collision.js";
import { layeredWind, localAirflow, sampleEnvironment, type EnvironmentConfig } from "../../src/physics/environment/Atmosphere.js";
import { RigidBody, type RigidBodyState } from "../../src/physics/rigidbody/RigidBody.js";
import { generateSyntheticTile, TerrainSurface } from "../../src/world/terrain/Terrain.js";

/**
 * Stage 2 exit scenario (test-only): a tumbling body with quadratic drag (synthetic coefficient)
 * falls through a layered wind onto synthetic terrain; impact is found by a swept segment test
 * between ticks. All authoritative services run on the fixed-tick scheduler.
 */
const STEP = 1 / 120;
const DRAG_AREA_M2 = 0.8; // synthetic Cd·A
const ENV: EnvironmentConfig = {
  originAltitudeMslM: 300, temperatureOffsetK: 7,
  wind: layeredWind("test.wind", [{ heightM: 0, velocityEnuMps: [3, 0, 0] }, { heightM: 4000, velocityEnuMps: [25, -10, 0] }])
};

function terrain(): TerrainSurface {
  const t = new TerrainSurface();
  for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
    t.addTile(generateSyntheticTile({ seed: 99, tileId: `test/${i}-${j}`, originEnuM: [i * 4000 - 4000, j * 4000 - 4000], spacingM: 50, columns: 81, rows: 81, baseHeightM: 0, reliefM: 900, featureSizeM: 3000 }));
  }
  return t;
}

class Scenario {
  readonly scheduler = new SimulationScheduler({ stepSeconds: STEP, maxStepsPerFrame: 100_000, maxFrameDeltaSeconds: 1e6 });
  readonly body = new RigidBody({ massKg: 250, inertiaKgM2: [[20, 0, 0], [0, 30, 0], [0, 0, 40]] },
    { positionEnuM: [-1500, -800, 3000], velocityEnuMps: [120, 60, 20], bodyToWorld: [0, 0, 0, 1], angularVelocityBodyRadps: [0.3, -1.1, 0.7] });
  impact: (TerrainSegmentResult & { tick: number }) | null = null;

  constructor(readonly ground: TerrainSurface) {
    this.scheduler.register({ id: "test.body", phase: "integration", run: (ctx) => {
      if (this.impact) return;
      const before = this.body.state.positionEnuM;
      const env = sampleEnvironment(ENV, before, ctx.timeSeconds);
      const flow = localAirflow(this.body.state.velocityEnuMps, this.body.state.bodyToWorld, env);
      const k = -0.5 * env.atmosphere.densityKgM3 * DRAG_AREA_M2 * flow.trueAirspeedMps;
      const drag: Vector3 = [k * flow.airVelocityEnuMps[0], k * flow.airVelocityEnuMps[1], k * flow.airVelocityEnuMps[2]];
      this.body.step(ctx.stepSeconds, { forces: [{ sourceId: "test.drag", frame: "world.enu", forceN: drag }], gravityEnuMps2: env.gravityEnuMps2 });
      const hit = segmentTerrainIntersection(this.ground, before, this.body.state.positionEnuM, 10);
      if (hit.status !== "clear") this.impact = { ...hit, tick: ctx.tick };
    } });
  }

  readonly persist: PersistableModule = {
    moduleId: "test.body", stateVersion: 1,
    save: () => this.body.state,
    validate: (s) => (Array.isArray((s as RigidBodyState).positionEnuM) ? [] : ["missing rigid body state"]),
    load: (s) => this.body.setState(s as RigidBodyState)
  };
}

describe("Stage 2 exit: physics and world foundations together", () => {
  it("gives identical authoritative results at 30, 60 and 144 fps and through save/load", () => {
    const run = (fps: number) => {
      const s = new Scenario(terrain());
      while (!s.impact && s.scheduler.currentTick < 120 * 120) s.scheduler.advanceFrame(1 / fps);
      // Run the same number of ticks regardless of how frames landed.
      while (s.scheduler.currentTick < 120 * 120) s.scheduler.step();
      return { impact: s.impact, state: s.body.state };
    };
    const at30 = run(30), at60 = run(60), at144 = run(144);
    expect(at30.impact?.status).toBe("hit");
    expect(at60).toEqual(at30);
    expect(at144).toEqual(at30);

    // Save mid-flight, load into a fresh scenario, continue: identical impact.
    const first = new Scenario(terrain());
    for (let i = 0; i < 600; i++) first.scheduler.step();
    const save = JSON.parse(JSON.stringify(createSave({ scenarioId: "stage2", seed: 99, tick: first.scheduler.currentTick, stepSeconds: STEP }, [first.persist])));
    const resumed = new Scenario(terrain());
    const outcome = loadSave(save, { scenarioId: "stage2", stepSeconds: STEP }, [resumed.persist]);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) resumed.scheduler.restoreTick(outcome.tick);
    while (resumed.scheduler.currentTick < 120 * 120) resumed.scheduler.step();
    expect(resumed.impact).toEqual(at30.impact);
  });

  it("drifts with the wind and refuses to treat missing terrain as flat ground", () => {
    const partial = terrain();
    partial.removeTile("test/1-0"); // the tile the full run impacts in
    const s = new Scenario(partial);
    while (!s.impact && s.scheduler.currentTick < 120 * 120) s.scheduler.step();
    expect(s.impact?.status).toBe("unknown");
    expect(s.body.state.positionEnuM[0]).toBeGreaterThan(0);
  });
});
