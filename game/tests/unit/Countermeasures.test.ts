import { describe, expect, it } from "vitest";
import { CountermeasureWorld } from "../../src/world/weapons/Countermeasures.js";
import { NotionalMissileWorld, type CombatTarget } from "../../src/world/weapons/NotionalMissiles.js";
import { NOTIONAL_BY_ID } from "../../src/weapons/catalog/NotionalAirToAir.js";

describe("countermeasures", () => {
  it("decoys fall behind the dispensing aircraft, then burn out / disperse", () => {
    const w = new CountermeasureWorld();
    w.dispense("flare", "blue", "p", [0, 0, 3000], [0, 250, 0], 1);
    w.dispense("chaff", "blue", "p", [0, 0, 3000], [0, 250, 0], -1);
    for (let i = 0; i < 100; i++) w.step(0.02);
    const [flare, chaff] = w.decoys();
    expect(flare!.velocityEnuMps[1]).toBeLessThan(50); // slowed from 250 m/s
    expect(flare!.positionEnuM[2]).toBeLessThan(3000);
    expect(chaff!.positionEnuM[1]).toBeLessThan(flare!.positionEnuM[1]); // chaff stops faster
    for (let i = 0; i < 400; i++) w.step(0.02);
    expect(w.decoys()).toHaveLength(0);
  });

  /** A missile chasing a target that dispenses `kind` every second; returns the decoyed event count over seeds. */
  const run = (specId: string, kind: "flare" | "chaff" | null) => {
    const spec = NOTIONAL_BY_ID[specId]!;
    const cm = new CountermeasureWorld();
    let target: [number, number, number] = [0, 6000, 3000];
    const vel: [number, number, number] = [0, 200, 0];
    const targets = (): readonly CombatTarget[] => [{ id: "t", side: "red", positionEnuM: target, velocityEnuMps: vel }];
    const w = new NotionalMissileWorld(targets, () => {}, () => 0, () => cm.decoys());
    w.launch(spec, "blue", "s", [0, 0, 3000], [0, 300, 0], () => ({ positionEnuM: target, velocityEnuMps: vel }), "t");
    for (let i = 0; i < 50 * 25; i++) {
      if (kind && i % 50 === 0) cm.dispense(kind, "red", "t", target, vel, 1);
      cm.step(0.02);
      w.step(0.02);
      target = [target[0], target[1] + vel[1] * 0.02, target[2]];
    }
    return w.events().filter((e) => e.kind === "decoyed").length;
  };

  it("flares can seduce an IR missile; chaff can seduce a radar missile", () => {
    expect(run("aim9x", "flare")).toBeGreaterThan(0);
    expect(run("aim120", "chaff")).toBeGreaterThan(0);
  });

  it("the wrong decoy type, or none, never seduces", () => {
    expect(run("aim9x", "chaff")).toBe(0);
    expect(run("aim120", "flare")).toBe(0);
    expect(run("aim9x", null)).toBe(0);
  });
});
