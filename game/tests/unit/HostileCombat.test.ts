import { describe, expect, it } from "vitest";
import type { Vector3 } from "../../src/core/coordinates/CoordinateFrames.js";
import { NOTIONAL_AAM } from "../../src/weapons/catalog/NotionalAirToAir.js";
import { NotionalMissileWorld, type CombatTarget } from "../../src/world/weapons/NotionalMissiles.js";
import { canSee, HostileFighter, type HostileEnvironment } from "../../src/world/combat/HostileFighters.js";
import { SIGNATURES } from "../../src/world/targets/AirTargets.js";
import { hostileSpecs } from "../../src/app/TestRange.js";
import { F16FireControl } from "../../src/platforms/aircraft/f16c-block50/avionics/F16FireControl.js";
import { F16_STORES } from "../../src/platforms/aircraft/f16c-block50/F16Stores.js";
import { MIG29_STORES } from "../../src/platforms/aircraft/mig29/MiG29Stores.js";
import { encodeStores } from "../../src/platforms/aircraft/common/Avionics.js";

/** A straight-flying target moved by the test. */
function mover(id: string, side: "blue" | "red", p: Vector3, v: Vector3) {
  const t = { id, side, positionEnuM: [...p] as Vector3, velocityEnuMps: v };
  return { t, step: (dt: number) => { t.positionEnuM = [t.positionEnuM[0] + v[0] * dt, t.positionEnuM[1] + v[1] * dt, t.positionEnuM[2] + v[2] * dt]; } };
}

describe("notional missiles (low fidelity)", () => {
  it("an AIM-120 with a launcher cue reaches and fuzes on a non-manoeuvring head-on target", () => {
    const target = mover("bandit", "red", [0, 25000, 5000], [0, -250, 0]);
    const killed: string[] = [];
    const world = new NotionalMissileWorld(() => [target.t as CombatTarget], (id) => killed.push(id));
    world.launch(NOTIONAL_AAM.AIM120, "blue", "player", [0, 0, 5000], [0, 250, 0], () => ({ positionEnuM: target.t.positionEnuM, velocityEnuMps: target.t.velocityEnuMps }), "bandit");
    for (let i = 0; i < 60 * 50 && world.states().length > 0; i++) { target.step(0.02); world.step(0.02); }
    const end = world.events().find((e) => e.kind !== "launch");
    expect(end?.kind === "kill" || end?.kind === "miss").toBe(true);
    expect(end?.targetId).toBe("bandit");
  });

  it("never fuzes on its own side and a radar missile without any cue goes ballistic", () => {
    const friend = mover("wingman", "blue", [0, 3000, 5000], [0, 250, 0]);
    const world = new NotionalMissileWorld(() => [friend.t as CombatTarget], () => { throw new Error("friendly kill"); });
    world.launch(NOTIONAL_AAM.AIM120, "blue", "player", [0, 0, 5000], [0, 250, 0], () => null);
    for (let i = 0; i < 90 * 50 && world.states().length > 0; i++) { friend.step(0.02); world.step(0.02); }
    expect(world.events().some((e) => e.kind === "lost")).toBe(true);
  });

  it("an AIM-9X acquires an opposing aircraft inside its field of regard without a cue", () => {
    const target = mover("bandit", "red", [800, 4000, 5000], [200, 0, 0]);
    const world = new NotionalMissileWorld(() => [target.t as CombatTarget], () => undefined);
    world.launch(NOTIONAL_AAM.AIM9X, "blue", "player", [0, 0, 5000], [0, 250, 0], () => null);
    world.step(0.02);
    expect(world.states()[0]?.seekerTargetId).toBe("bandit");
  });
});

describe("hostile F-16C (low fidelity)", () => {
  const env = (player: CombatTarget | null, fired: string[]): HostileEnvironment => ({
    opponents: () => (player ? [player] : []), threats: () => [], groundHeightAt: () => 0,
    fire: (spec) => { fired.push(spec.id); }, missileInFlight: () => false
  });
  const spec = { id: "h1", label: "test", modelId: "f16c-aggressor", signature: SIGNATURES.fighter, side: "red" as const, positionEnuM: [0, 0, 6000] as Vector3, headingRad: 0, speedMps: 250, loadout: [NOTIONAL_AAM.AIM120, NOTIONAL_AAM.AIM9X] };

  it("perception gate: sees ahead inside the radar cone, not far behind, always inside the visual bubble", () => {
    expect(canSee({ positionEnuM: [0, 0, 5000], headingRad: 0 }, [0, 40000, 5000])).toBe(true);
    expect(canSee({ positionEnuM: [0, 0, 5000], headingRad: 0 }, [0, -40000, 5000])).toBe(false);
    expect(canSee({ positionEnuM: [0, 0, 5000], headingRad: 0 }, [0, -4000, 5000])).toBe(true);
    expect(canSee({ positionEnuM: [0, 0, 5000], headingRad: 0 }, [0, 90000, 5000])).toBe(false);
  });

  it("intercepts and fires an AIM-120 at a player it can see, but not at one behind it", () => {
    const fired: string[] = [];
    const ahead = new HostileFighter(spec, env({ id: "player", side: "blue", positionEnuM: [0, 22000, 6000], velocityEnuMps: [0, -200, 0] }, fired));
    for (let i = 0; i < 50 * 10; i++) ahead.update(0.02);
    expect(fired).toContain("aim120");
    expect(ahead.remainingStores.length).toBe(1);

    const quiet: string[] = [];
    const behind = new HostileFighter(spec, env({ id: "player", side: "blue", positionEnuM: [0, -40000, 6000], velocityEnuMps: [0, 0, 0] }, quiet));
    for (let i = 0; i < 50 * 2; i++) behind.update(0.02);
    expect(quiet).toEqual([]);
    expect(behind.mode).toBe("patrol");
  });

  it("stays above the terrain floor while manoeuvring", () => {
    const fired: string[] = [];
    const h = new HostileFighter({ ...spec, positionEnuM: [0, 0, 1200] }, { ...env({ id: "player", side: "blue", positionEnuM: [0, 8000, 200], velocityEnuMps: [0, 0, 0] }, fired), groundHeightAt: () => 500 });
    let minAlt = Infinity;
    for (let i = 0; i < 50 * 60; i++) { h.update(0.02); minAlt = Math.min(minAlt, h.positionEnuM[2]); }
    expect(minAlt).toBeGreaterThan(500);
  });

  it("hostile scenarios build the requested flight sizes on the red side", () => {
    expect(hostileSpecs("hostile-1")).toHaveLength(1);
    expect(hostileSpecs("hostile-4")).toHaveLength(4);
    expect(hostileSpecs("range")).toHaveLength(0);
    expect(hostileSpecs("hostile-2").every((h) => h.side === "red" && h.loadout.length > 0)).toBe(true);
  });
});

describe("stores plans", () => {
  it("F-16 stores option sets the stations; invalid lists are ignored", () => {
    const fc = new F16FireControl();
    fc.setOption("stores", encodeStores(F16_STORES.presets.find((p) => p.id === "a2a-bvr")!.stations));
    expect(fc.inventory).toEqual({ "AIM-120": 6 });
    fc.setOption("stores", encodeStores(["AIM-120", "", "", "AIM-9X", "", "", "", "", ""])); // station 4 cannot carry AAMs
    expect(fc.inventory).toEqual({ "AIM-120": 6 });
    fc.setOption("stores", encodeStores(["", "", "", "", "", "", "", "", ""]));
    expect(fc.weapon).toBeNull();
  });

  it("every preset is valid", () => {
    for (const plan of [F16_STORES, MIG29_STORES]) for (const l of plan.presets) expect(plan.validate(l.stations)).toEqual([]);
  });

  it("MiG-29: R-27 only on the inboard pylons, at most two, one guidance family", () => {
    expect(MIG29_STORES.validate(["R-27R", "", "", "", "", ""]).length).toBeGreaterThan(0);
    expect(MIG29_STORES.validate(["", "", "R-27R", "R-27ER", "", ""])).toEqual([]);
    expect(MIG29_STORES.validate(["", "", "R-27T", "R-27ET", "", ""])).toEqual([]);
    expect(MIG29_STORES.validate(["", "", "R-27R", "R-27T", "", ""]).join()).toContain("one family");
    expect(MIG29_STORES.validate(["R-73", "R-60M", "", "", "R-73", "R-73"])).toEqual([]);
    expect(MIG29_STORES.validate(["R-73", "R-73", "R-73", "", "", ""]).length).toBeGreaterThan(0);
  });
});
