import { describe, expect, it } from "vitest";
import { createRuntimeDemo, type DemoStatusSnapshot } from "../../src/debug/RuntimeDemo.js";

describe("runtime monitor demo", () => {
  it("resolves both demo modules and spawns one turbine", () => {
    const demo = createRuntimeDemo();
    expect(demo.resolution.ok).toBe(true);
    expect(demo.runtime.moduleIds).toEqual(["demo.turbine", "demo.telemetry"]);
    expect(demo.entities().map((e) => `${e.id}:${e.state}`)).toEqual(["demo-monitor/turbine/t1:active"]);
  });

  it("applies a throttle command via the bus and reports spool through snapshots only", () => {
    const demo = createRuntimeDemo();
    const snapshots: DemoStatusSnapshot[] = [];
    demo.onSnapshot((s) => snapshots.push(s));
    demo.setThrottle("demo-monitor/turbine/t1", 1);
    for (let i = 0; i < 240; i++) demo.step();
    const last = snapshots[snapshots.length - 1];
    expect(last?.turbines[0]?.throttle).toBe(1);
    expect(last?.turbines[0]?.spool).toBeGreaterThan(0.7);
    expect(Object.isFrozen(last)).toBe(true);
    expect(demo.log().some((e) => e.kind === "command" && e.text.endsWith("accepted"))).toBe(true);
    expect(demo.log().some((e) => e.kind === "event" && e.text.includes("spool crossed 25%"))).toBe(true);
  });

  it("rejects an out-of-range throttle and stops a retired turbine", () => {
    const demo = createRuntimeDemo();
    const snapshots: DemoStatusSnapshot[] = [];
    demo.onSnapshot((s) => snapshots.push(s));
    demo.setThrottle("demo-monitor/turbine/t1", 1.5);
    demo.step();
    expect(demo.log().some((e) => e.text.includes("rejected (throttle must be within 0..1)"))).toBe(true);
    const second = demo.spawnTurbine();
    demo.retireTurbine("demo-monitor/turbine/t1");
    for (let i = 0; i < 12; i++) demo.step();
    expect(snapshots[snapshots.length - 1]?.turbines.map((t) => t.entityId)).toEqual([second]);
    expect(demo.entities().find((e) => e.id === "demo-monitor/turbine/t1")?.retirementReason).toBe("despawned");
  });
});
