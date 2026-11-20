import { describe, expect, it } from "vitest";
import { bodyFrdToWorldEnu, worldEnuToBodyFrd } from "../../src/core/coordinates/CoordinateFrames.js";

describe("coordinate-frame transforms", () => {
  it("preserves a vector when body and world frames are aligned", () => {
    const bodyVector = { frame: "aircraft.body.frd" as const, value: [10, 2, -3] as const };
    const world = bodyFrdToWorldEnu(bodyVector, [0, 0, 0, 1]);

    expect(world.value).toEqual([10, 2, -3]);
  });

  it("round-trips vectors through normalized body/world orientations", () => {
    const vector = { frame: "aircraft.body.frd" as const, value: [12, -4, 8] as const };
    const halfAngle = Math.PI / 4;
    const orientation = [0, 0, Math.sin(halfAngle), Math.cos(halfAngle)] as const;
    const world = bodyFrdToWorldEnu(vector, orientation);
    const restored = worldEnuToBodyFrd(world, orientation);

    restored.value.forEach((component, index) => {
      expect(component).toBeCloseTo(vector.value[index]!, 10);
    });
  });

  it("rejects a zero quaternion", () => {
    const vector = { frame: "aircraft.body.frd" as const, value: [1, 0, 0] as const };
    expect(() => bodyFrdToWorldEnu(vector, [0, 0, 0, 0])).toThrow(RangeError);
  });
});
