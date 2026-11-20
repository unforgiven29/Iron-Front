import { describe, expect, it } from "vitest";
import { SimulationClock } from "../../src/core/time/SimulationClock.js";

describe("SimulationClock", () => {
  it("uses fixed steps independently of a 60 Hz render frame", () => {
    const clock = new SimulationClock();
    const result = clock.advanceFrame(1 / 60);

    expect(result.stepsExecuted).toBe(2);
    expect(result.currentTick).toBe(2);
    expect(clock.simulationTimeSeconds).toBeCloseTo(1 / 60, 12);
  });

  it("preserves catch-up backlog when the per-frame cap is reached", () => {
    const clock = new SimulationClock({
      stepSeconds: 0.1,
      maxFrameDeltaSeconds: 0.5,
      maxStepsPerFrame: 2
    });
    const first = clock.advanceFrame(0.5);

    expect(first.stepsExecuted).toBe(2);
    expect(first.overloaded).toBe(true);
    expect(first.interpolationAlpha).toBe(0);
    expect(first.backlogSeconds).toBeCloseTo(0.3, 12);

    const second = clock.advanceFrame(0);
    expect(second.stepsExecuted).toBe(2);
    expect(second.currentTick).toBe(4);
  });

  it("reports time beyond the suspension clamp", () => {
    const clock = new SimulationClock({ stepSeconds: 0.1, maxFrameDeltaSeconds: 0.25 });
    const result = clock.advanceFrame(1);

    expect(result.droppedFrameSeconds).toBeCloseTo(0.75, 12);
    expect(result.stepsExecuted).toBe(2);
    expect(result.overloaded).toBe(false);
  });

  it("rejects invalid deltas and options", () => {
    const clock = new SimulationClock();
    expect(() => clock.advanceFrame(-0.1)).toThrow(RangeError);
    expect(() => clock.advanceFrame(Number.NaN)).toThrow(RangeError);
    expect(() => new SimulationClock({ stepSeconds: 0 })).toThrow(RangeError);
  });

  it("resets tick and accumulator explicitly", () => {
    const clock = new SimulationClock({ stepSeconds: 0.1 });
    clock.advanceFrame(0.25);
    clock.reset(40);

    expect(clock.currentTick).toBe(40);
    expect(clock.simulationTimeSeconds).toBe(4);
    expect(clock.advanceFrame(0.05).stepsExecuted).toBe(0);
  });
});
