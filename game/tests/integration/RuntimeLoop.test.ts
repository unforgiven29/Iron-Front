import { describe, expect, it } from "vitest";
import { deriveEntityId, EntityRegistry } from "../../src/core/entities/EntityRegistry.js";
import { MessageBus } from "../../src/core/events/MessageBus.js";
import { SimulationScheduler } from "../../src/core/simulation/SimulationScheduler.js";

/**
 * Test-only wiring of scheduler + bus + entity registry: a throttle command is delivered in the
 * commands phase, a test engine integrates in the integration phase and publishes a committed event,
 * and retiring the entity removes its scheduled task through a retirement hook.
 */
function runScenario(frames: readonly number[]) {
  const scheduler = new SimulationScheduler({ stepSeconds: 0.01, maxStepsPerFrame: 1000, maxFrameDeltaSeconds: 10 });
  const bus = new MessageBus();
  const entities = new EntityRegistry();
  bus.registerContract({ contractId: "test.throttle", contractVersion: 1, kind: "command" });
  bus.registerContract({ contractId: "test.engine-rpm", contractVersion: 1, kind: "event" });

  const id = deriveEntityId("test-scenario", "engine-1");
  entities.create(id, "test-engine", 0);
  const engine = { throttle: 0, rpm: 0 };
  const rpmLog: string[] = [];
  bus.handleCommands("test.throttle", id, (c) => { engine.throttle = (c.payload as { value: number }).value; return { accepted: true }; });
  bus.subscribe("test.engine-rpm", "test.observer", (m) => rpmLog.push(`${m.simulationTick}:${(m.payload as { rpm: number }).rpm.toFixed(6)}`));

  let seq = 0;
  const envelope = (contractId: string, tick: number) =>
    ({ messageId: `${contractId}-${++seq}`, contractId, contractVersion: 1, producerModuleId: "test.runtime", simulationTick: tick, simulationTimeSeconds: tick * 0.01, status: "valid" as const });

  scheduler.register({ id: "core.bus", phase: "commands", run: (ctx) => { bus.setTick(ctx.tick); bus.deliver(); } });
  scheduler.register({ id: `engine:${id}`, phase: "integration", run: (ctx) => {
    engine.rpm += (engine.throttle * 100 - engine.rpm) * 0.5 * ctx.stepSeconds;
  } });
  scheduler.register({ id: `engine-publish:${id}`, phase: "publish", periodTicks: 10, run: (ctx) => {
    bus.publish({ ...envelope("test.engine-rpm", ctx.tick), kind: "event", eventType: "rpm", payload: { rpm: engine.rpm } });
  } });
  entities.activate(id, 0);
  entities.addRetirementHook(id, "scheduler", () => {
    scheduler.unregister(`engine:${id}`);
    scheduler.unregister(`engine-publish:${id}`);
  });
  scheduler.scheduleAt({ tick: 1, phase: "commands", priority: -1, label: "pilot", run: (ctx) => {
    bus.publish({ ...envelope("test.throttle", ctx.tick), kind: "command", issuerId: "test.pilot", targetModuleId: id, payload: { value: 0.9 } });
  } });

  for (const dt of frames) scheduler.advanceFrame(dt);
  const retirement = entities.retire(id, "despawned", scheduler.currentTick);
  const rpmAtRetire = engine.rpm;
  for (let i = 0; i < 20; i++) scheduler.step();
  return { rpmLog, rpmAtRetire, rpmAfter: engine.rpm, faults: retirement.faults, tick: scheduler.currentTick };
}

describe("runtime loop (scheduler + bus + entities)", () => {
  it("is cadence-independent end to end and retirement stops the entity's tasks", () => {
    const at30 = runScenario(Array.from({ length: 30 }, () => 1 / 30));
    const at144 = runScenario(Array.from({ length: 144 }, () => 1 / 144));
    expect(at30.tick).toBe(120);
    expect(at30).toEqual(at144);
    expect(at30.rpmLog).toHaveLength(10);
    expect(at30.rpmAfter).toBe(at30.rpmAtRetire);
    expect(at30.faults).toEqual([]);
  });
});
