import { describe, expect, it } from "vitest";
import { SeededRandom } from "../../src/core/random/SeededRandom.js";

describe("SeededRandom", () => {
  it("repeats the same sequence for the same seed", () => {
    const first = new SeededRandom(123456);
    const second = new SeededRandom(123456);

    expect(Array.from({ length: 20 }, () => first.nextUint32())).toEqual(
      Array.from({ length: 20 }, () => second.nextUint32())
    );
  });

  it("can snapshot and restore its state", () => {
    const random = new SeededRandom(42);
    random.nextUint32();
    const state = random.snapshot();
    const expected = random.nextUint32();

    random.restore(state);
    expect(random.nextUint32()).toBe(expected);
  });

  it("returns values in the documented half-open interval", () => {
    const random = new SeededRandom(7);
    for (let index = 0; index < 100; index += 1) {
      const value = random.nextFloat();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("rejects invalid seed and range inputs", () => {
    expect(() => new SeededRandom(-1)).toThrow(RangeError);
    expect(() => new SeededRandom(1.5)).toThrow(RangeError);
    expect(() => new SeededRandom(3).nextRange(5, 2)).toThrow(RangeError);
  });
});
