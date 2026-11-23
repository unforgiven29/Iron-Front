import { describe, expect, it } from "vitest";
import { SimulationScheduler, type ScheduledTask, type SimulationPhase } from "../../src/core/simulation/SimulationScheduler.js";

const STEP = 1 / 120;

function recorder(log: string[], id: string, phase: SimulationPhase, extra: Partial<ScheduledTask> = {}): ScheduledTask {
  return { id, phase, ...extra, run: (ctx) => log.push(`${ctx.tick}:${id}`) };
}

/** A tiny deterministic "simulation": a body integrated by a fixed-tick task. */
function runSimulation(frames: readonly number[]): { position: number; velocity: number; tick: number } {
  const scheduler = new SimulationScheduler({ stepSeconds: STEP, maxStepsPerFrame: 1000, maxFrameDeltaSeconds: 10 });
  const state = { position: 0, velocity: 0, force: 0 };
  scheduler.register({ id: "test.force", phase: "forces", run: (ctx) => { state.force = Math.sin(ctx.timeSeconds) * 10; } });
  scheduler.register({ id: "test.integrate", phase: "integration", run: (ctx) => {
    state.velocity += state.force * ctx.stepSeconds;
    state.position += state.velocity * ctx.stepSeconds;
  } });
  for (const dt of frames) scheduler.advanceFrame(dt);
  return { position: state.position, velocity: state.velocity, tick: scheduler.currentTick };
}

describe("SimulationScheduler", () => {
  it("produces identical authoritative results for different render cadences over equal ticks", () => {
    const at60 = runSimulation(Array.from({ length: 600 }, () => 1 / 60));
    const at144 = runSimulation(Array.from({ length: 1440 }, () => 1 / 144));
    const jittery = runSimulation(Array.from({ length: 800 }, (_, i) => (i % 2 === 0 ? 0.02 : 0.005)));
    expect(at60.tick).toBe(1200);
    expect(at144.tick).toBe(1200);
    expect(jittery.tick).toBe(1200);
    expect(at144).toEqual(at60);
    expect(jittery).toEqual(at60);
  });

  it("orders by phase, then priority, then id, independent of registration order", () => {
    const run = (order: number[]) => {
      const log: string[] = [];
      const s = new SimulationScheduler();
      const tasks = [
        recorder(log, "b.sensor", "sensors"),
        recorder(log, "z.cmd", "commands"),
        recorder(log, "a.forces", "forces", { priority: 5 }),
        recorder(log, "c.forces", "forces", { priority: -1 }),
        recorder(log, "b.forces", "forces", { priority: 5 })
      ];
      for (const i of order) s.register(tasks[i] as ScheduledTask);
      s.step();
      return log;
    };
    const expected = ["1:z.cmd", "1:c.forces", "1:a.forces", "1:b.forces", "1:b.sensor"];
    expect(run([0, 1, 2, 3, 4])).toEqual(expected);
    expect(run([4, 3, 2, 1, 0])).toEqual(expected);
  });

  it("runs multi-rate tasks on their due ticks with offsets and reports covered time", () => {
    const log: string[] = [];
    const elapsed: number[] = [];
    const s = new SimulationScheduler({ stepSeconds: 0.01 });
    s.register(recorder(log, "every", "controllers"));
    s.register({ id: "slow", phase: "sensors", periodTicks: 4, offsetTicks: 1, run: (ctx) => { log.push(`${ctx.tick}:slow`); elapsed.push(ctx.elapsedSeconds); } });
    for (let i = 0; i < 9; i++) s.step();
    expect(log.filter((l) => l.endsWith("slow"))).toEqual(["1:slow", "5:slow", "9:slow"]);
    expect(log.filter((l) => l.endsWith("every"))).toHaveLength(9);
    expect(elapsed).toEqual([0.04, 0.04, 0.04]);
  });

  it("validates task registration", () => {
    const s = new SimulationScheduler();
    const noop = () => undefined;
    expect(() => s.register({ id: "", phase: "forces", run: noop })).toThrow("non-empty");
    expect(() => s.register({ id: "x", phase: "render" as SimulationPhase, run: noop })).toThrow("Unknown simulation phase");
    expect(() => s.register({ id: "x", phase: "forces", periodTicks: 0, run: noop })).toThrow("periodTicks");
    expect(() => s.register({ id: "x", phase: "forces", periodTicks: 2.5, run: noop })).toThrow("periodTicks");
    expect(() => s.register({ id: "x", phase: "forces", periodTicks: 4, offsetTicks: 4, run: noop })).toThrow("offsetTicks");
    expect(() => s.register({ id: "x", phase: "forces", priority: Number.NaN, run: noop })).toThrow("priority");
    s.register({ id: "x", phase: "forces", run: noop });
    expect(() => s.register({ id: "x", phase: "sensors", run: noop })).toThrow("already registered");
    expect(s.unregister("x")).toBe(true);
    expect(s.unregister("x")).toBe(false);
  });

  it("forbids registration changes and stepping during a tick", () => {
    const s = new SimulationScheduler();
    const errors: string[] = [];
    s.register({ id: "meddler", phase: "decisions", run: () => {
      for (const attempt of [() => s.register({ id: "late", phase: "publish", run: () => undefined }), () => s.unregister("meddler"), () => s.step()]) {
        try { attempt(); } catch (e) { errors.push((e as Error).message); }
      }
    } });
    s.step();
    expect(errors).toEqual([
      "Cannot register a task while a tick is executing.",
      "Cannot unregister a task while a tick is executing.",
      "Cannot step while a tick is executing."
    ]);
  });

  it("runs one-shot work at its tick and phase with stable ordering and supports cancel", () => {
    const log: string[] = [];
    const s = new SimulationScheduler();
    s.register(recorder(log, "task.p0", "commit-events"));
    s.register(recorder(log, "task.p2", "commit-events", { priority: 2 }));
    s.scheduleAt({ tick: 2, phase: "commit-events", priority: 1, label: "first", run: (c) => log.push(`${c.tick}:first`) });
    s.scheduleAt({ tick: 2, phase: "commit-events", priority: 1, label: "second", run: (c) => log.push(`${c.tick}:second`) });
    s.scheduleAt({ tick: 2, phase: "commit-events", priority: 0, label: "tie", run: (c) => log.push(`${c.tick}:tie`) });
    const cancelled = s.scheduleAt({ tick: 2, phase: "commands", label: "cancelled", run: (c) => log.push(`${c.tick}:cancelled`) });
    expect(s.cancel(cancelled)).toBe(true);
    expect(s.cancel(cancelled)).toBe(false);
    s.step();
    s.step();
    expect(log.filter((l) => l.startsWith("2:"))).toEqual(["2:task.p0", "2:tie", "2:first", "2:second", "2:task.p2"]);
  });

  it("lets work schedule later phases of the same tick or future ticks, never the past", () => {
    const log: string[] = [];
    const errors: string[] = [];
    const s = new SimulationScheduler();
    s.register({ id: "sensor", phase: "sensors", run: (ctx) => {
      if (ctx.tick !== 1) return;
      ctx.scheduleAt({ tick: 1, phase: "decisions", label: "same-tick-later", run: (c) => log.push(`${c.tick}:${c.phase}`) });
      ctx.scheduleAt({ tick: 2, phase: "commands", label: "next-tick", run: (c) => log.push(`${c.tick}:${c.phase}`) });
      for (const phase of ["sensors", "forces"] as const) {
        try { ctx.scheduleAt({ tick: 1, phase, label: "past", run: () => undefined }); } catch (e) { errors.push((e as Error).message); }
      }
    } });
    expect(() => s.scheduleAt({ tick: 0, phase: "commands", label: "x", run: () => undefined })).toThrow("current tick is 0");
    s.step();
    s.step();
    expect(log).toEqual(["1:decisions", "2:commands"]);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain("must be after tick 1 phase sensors");
  });

  it("isolates a faulting task: reports it, disables it, and keeps the tick running", () => {
    const log: string[] = [];
    const s = new SimulationScheduler({ stepSeconds: 0.01 });
    s.register({ id: "bad", phase: "controllers", run: () => { throw new Error("actuator exploded"); } });
    s.register(recorder(log, "good", "integration"));
    const first = s.advanceFrame(0.01);
    expect(first.faults).toEqual([{ tick: 1, phase: "controllers", source: "bad", message: "actuator exploded" }]);
    expect(s.faultedTaskIds).toEqual(["bad"]);
    const second = s.advanceFrame(0.01);
    expect(second.faults).toEqual([]);
    expect(log).toEqual(["1:good", "2:good"]);
    s.unregister("bad");
    expect(s.faultedTaskIds).toEqual([]);
  });

  it("accumulates no time while paused and reports the removed frame time", () => {
    const s = new SimulationScheduler({ stepSeconds: 0.01 });
    let runs = 0;
    s.register({ id: "t", phase: "integration", run: () => { runs++; } });
    s.pause();
    const paused = s.advanceFrame(0.5);
    expect(paused).toMatchObject({ paused: true, stepsExecuted: 0, droppedFrameSeconds: 0.5 });
    s.resume();
    const resumed = s.advanceFrame(0.025);
    expect(resumed).toMatchObject({ paused: false, stepsExecuted: 2 });
    expect(runs).toBe(2);
  });

  it("passes through overload backlog without dropping simulation time", () => {
    const s = new SimulationScheduler({ stepSeconds: 0.01, maxStepsPerFrame: 3 });
    const advance = s.advanceFrame(0.1);
    expect(advance).toMatchObject({ stepsExecuted: 3, overloaded: true });
    expect(advance.backlogSeconds).toBeCloseTo(0.07, 12);
  });

  it("derives time from tick count so long runs do not drift", () => {
    const s = new SimulationScheduler({ stepSeconds: 1 / 120 });
    let last = 0;
    s.register({ id: "clock", phase: "publish", run: (ctx) => { last = ctx.timeSeconds; } });
    for (let i = 0; i < 120 * 3600; i++) s.step();
    expect(s.currentTick).toBe(432000);
    expect(last).toBe(432000 / 120);
    expect(last).toBe(3600);
  });
});
