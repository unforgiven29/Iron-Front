import { describe, expect, it } from "vitest";
import { bodyFrdToWorldEnu, worldEnuToBodyFrd } from "../../src/core/coordinates/CoordinateFrames.js";

const SQRT_HALF = Math.SQRT1_2;
const BODY_FORWARD = { frame: "aircraft.body.frd" as const, value: [1, 0, 0] as const };
const BODY_RIGHT = { frame: "aircraft.body.frd" as const, value: [0, 1, 0] as const };
const BODY_DOWN = { frame: "aircraft.body.frd" as const, value: [0, 0, 1] as const };
const WORLD_DOWN = { frame: "world.enu" as const, value: [0, 0, -9.80665] as const };

function expectVectorClose(actual: readonly number[], expected: readonly number[]): void {
  actual.forEach((component, index) => expect(component).toBeCloseTo(expected[index]!, 10));
}

describe("coordinate-frame transforms", () => {
  it("preserves a vector when body and world frames are aligned", () => {
    const bodyVector = { frame: "aircraft.body.frd" as const, value: [10, 2, -3] as const };
    expect(bodyFrdToWorldEnu(bodyVector, [0, 0, 0, 1]).value).toEqual([10, 2, -3]);
  });
  it("maps a level aircraft pointing north into ENU axes", () => {
    const northAttitude = [SQRT_HALF, SQRT_HALF, 0, 0] as const;
    expectVectorClose(bodyFrdToWorldEnu(BODY_FORWARD, northAttitude).value, [0, 1, 0]);
    expectVectorClose(bodyFrdToWorldEnu(BODY_RIGHT, northAttitude).value, [1, 0, 0]);
    expectVectorClose(bodyFrdToWorldEnu(BODY_DOWN, northAttitude).value, [0, 0, -1]);
  });
  it.each([
    ["east", [1, 0, 0, 0], [1, 0, 0], [0, -1, 0]],
    ["south", [SQRT_HALF, -SQRT_HALF, 0, 0], [0, -1, 0], [-1, 0, 0]],
    ["west", [0, 1, 0, 0], [-1, 0, 0], [0, 1, 0]]
  ] as const)(
    "maps a level aircraft pointing %s into ENU axes",
    (_heading, attitude, expectedForward, expectedRight) => {
      expectVectorClose(bodyFrdToWorldEnu(BODY_FORWARD, attitude).value, expectedForward);
      expectVectorClose(bodyFrdToWorldEnu(BODY_RIGHT, attitude).value, expectedRight);
      expectVectorClose(bodyFrdToWorldEnu(BODY_DOWN, attitude).value, [0, 0, -1]);
    }
  );
  it("maps world gravity into the aircraft down axis for level headings", () => {
    const attitudes = [
      [SQRT_HALF, SQRT_HALF, 0, 0],
      [1, 0, 0, 0],
      [SQRT_HALF, -SQRT_HALF, 0, 0],
      [0, 1, 0, 0]
    ] as const;
    for (const attitude of attitudes) {
      expectVectorClose(worldEnuToBodyFrd(WORLD_DOWN, attitude).value, [0, 0, 9.80665]);
    }
  });
  it("round-trips vectors through normalized body/world orientations", () => {
    const vector = { frame: "aircraft.body.frd" as const, value: [12, -4, 8] as const };
    const halfAngle = Math.PI / 4;
    const orientation = [0, 0, Math.sin(halfAngle), Math.cos(halfAngle)] as const;
    const restored = worldEnuToBodyFrd(bodyFrdToWorldEnu(vector, orientation), orientation);
    restored.value.forEach((component, index) => expect(component).toBeCloseTo(vector.value[index]!, 10));
  });
  it("rejects a zero quaternion and non-finite vector components", () => {
    expect(() => bodyFrdToWorldEnu(BODY_FORWARD, [0, 0, 0, 0])).toThrow(RangeError);
    expect(() => bodyFrdToWorldEnu(
      { frame: "aircraft.body.frd", value: [1, Number.NaN, 0] },
      [0, 0, 0, 1]
    )).toThrow(RangeError);
  });
});
