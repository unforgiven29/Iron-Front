import { describe, expect, it } from "vitest";
import { createScopedRandom, deriveSeed, SeededRandom } from "../../src/core/random/SeededRandom.js";

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
  it("derives repeatable streams from stable entity and subsystem identities", () => {
    const first = createScopedRandom(2026, "aircraft", "f16-01", "radar");
    const second = createScopedRandom(2026, "aircraft", "f16-01", "radar");
    const otherSubsystem = createScopedRandom(2026, "aircraft", "f16-01", "engine");
    expect(deriveSeed(2026, "aircraft", "f16-01", "radar")).toBe(
      deriveSeed(2026, "aircraft", "f16-01", "radar")
    );
    expect(Array.from({ length: 12 }, () => first.nextUint32())).toEqual(
      Array.from({ length: 12 }, () => second.nextUint32())
    );
    expect(otherSubsystem.nextUint32()).not.toBe(
      createScopedRandom(2026, "aircraft", "f16-01", "radar").nextUint32()
    );
  });
  it("keeps an entity stream unchanged when unrelated scopes are created", () => {
    const expected = createScopedRandom(77, "vehicle", "tank-17", "suspension").snapshot();
    createScopedRandom(77, "infantry", "squad-4", "morale").nextUint32();
    createScopedRandom(77, "aircraft", "f16-02", "radar").nextUint32();
    const actual = createScopedRandom(77, "vehicle", "tank-17", "suspension").snapshot();
    expect(actual).toBe(expected);
  });
  it("rejects invalid seeds, ranges and scope identifiers", () => {
    expect(() => new SeededRandom(-1)).toThrow(RangeError);
    expect(() => new SeededRandom(1.5)).toThrow(RangeError);
    expect(() => new SeededRandom(3).nextRange(5, 2)).toThrow(RangeError);
    expect(() => deriveSeed(-1, "entity")).toThrow(RangeError);
    expect(() => deriveSeed(1)).toThrow(RangeError);
    expect(() => deriveSeed(1, "")).toThrow(RangeError);
  });
});
