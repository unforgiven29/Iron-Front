import { describe, expect, it } from "vitest";
import { groundEffect, inducedDragGroundFactor } from "../../src/physics/aerodynamics/GroundEffect.js";
import { createF16Definition } from "../../src/platforms/aircraft/f16c-block50/F16Definition.js";

const DEG = Math.PI / 180;

describe("Ground effect (shared, image-vortex theory)", () => {
  it("McCormick's induced-drag factor: ≈1 at one span, strong reduction close to the ground", () => {
    expect(inducedDragGroundFactor(10, 10)).toBeCloseTo(256 / 257, 9);
    expect(inducedDragGroundFactor(1, 10)).toBeCloseTo(2.56 / 3.56, 9);
    expect(inducedDragGroundFactor(0.5, 10)).toBeCloseTo(0.64 / 1.64, 9);
  });

  it("raises the lift slope near the ground and vanishes well above it", () => {
    const wing = { spanM: 9.144, aspectRatio: 3, midChordSweepRad: 32 * DEG };
    const low = groundEffect(wing, 1.6, 0.2), high = groundEffect(wing, 40, 0.2);
    expect(low.liftSlopeFactor).toBeGreaterThan(1.03);
    expect(low.inducedDragFactor).toBeLessThan(0.92);
    expect(high.liftSlopeFactor).toBeCloseTo(1, 3);
    expect(groundEffect(wing, undefined, 0.2)).toEqual({ inducedDragFactor: 1, liftSlopeFactor: 1 });
  });

  it("the F-16 at gear height makes more lift and less drag than in free air at the same alpha", () => {
    const aero = createF16Definition().createSystems().aero;
    const at = (h: number | undefined) => {
      const a = 10 * DEG;
      const o = aero.compute({ alphaRad: a, betaRad: 0, trueAirspeedMps: 75, dynamicPressurePa: 3445, mach: 0.22, ratesRadps: [0, 0, 0], surfaces: { elevator: 0, lef: 10 }, cgFractionMac: 0.35, ...(h === undefined ? {} : { heightAboveGroundM: h }) });
      const [fx, , fz] = o.forceBodyN;
      return { lift: -fz * Math.cos(a) + fx * Math.sin(a), drag: -fx * Math.cos(a) - fz * Math.sin(a) };
    };
    const ground = at(1.7), free = at(500), none = at(undefined);
    expect(ground.lift).toBeGreaterThan(1.03 * free.lift);
    expect(ground.drag).toBeLessThan(free.drag);
    expect(free.lift).toBeCloseTo(none.lift, 0);
  });
});
