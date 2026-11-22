import { describe, expect, it } from "vitest";
import { createUniformAesaTestArray, evaluatePlanarAesaArrayFactor } from "../../src/sensors/radar/AesaArray.js";

describe("finite planar AESA array factor", () => {
  it("forms a coherent main beam at its steering direction", () => {
    const config = createUniformAesaTestArray(8, 8);
    const result = evaluatePlanarAesaArrayFactor(config, 0, 0, 0, 0);
    expect(result.usable).toBe(true);
    expect(result.relativeGainDb).toBeCloseTo(0, 10);
    expect(result.effectiveApertureFraction).toBe(1);
  });

  it("steers the coherent main beam and includes module failures", () => {
    const config = createUniformAesaTestArray(8, 8);
    const steered = evaluatePlanarAesaArrayFactor(config, 20, 5, 20, 5);
    const broadside = evaluatePlanarAesaArrayFactor(config, 20, 5, 0, 0);
    expect(steered.relativeGainDb).toBeGreaterThan(broadside.relativeGainDb);

    const degraded = {
      ...config,
      elements: config.elements.map((element, index) => ({
        ...element,
        healthFraction: index % 2 === 0 ? 0 : 1
      }))
    };
    const failedModules = evaluatePlanarAesaArrayFactor(degraded, 0, 0, 0, 0);
    expect(failedModules.healthyElementCount).toBe(32);
    expect(failedModules.effectiveApertureFraction).toBeCloseTo(0.5, 10);
    expect(failedModules.relativeGainDb).toBeCloseTo(-6.0206, 3);
  });

  it("rejects invalid and duplicate element locations", () => {
    const config = createUniformAesaTestArray(2, 2);
    const duplicate = { ...config, elements: [config.elements[0]!, ...config.elements.slice(1).map((item) => ({ ...item, row: 0, column: 0 }))] };
    expect(() => evaluatePlanarAesaArrayFactor(duplicate, 0, 0, 0, 0)).toThrow(RangeError);
  });
});
