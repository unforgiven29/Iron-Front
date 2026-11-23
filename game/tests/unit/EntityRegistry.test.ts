import { describe, expect, it } from "vitest";
import { deriveEntityId, EntityRegistry } from "../../src/core/entities/EntityRegistry.js";

const ID = deriveEntityId("scenario-a", "flight-1", "lead");

describe("EntityRegistry", () => {
  it("derives stable ids from scenario identity and rejects unstable ones", () => {
    expect(ID).toBe("scenario-a/flight-1/lead");
    expect(() => deriveEntityId("scenario-a")).toThrow("at least one");
    expect(() => deriveEntityId("Scenario A", "x")).toThrow("Invalid entity id segment");
    const r = new EntityRegistry();
    expect(() => r.create("42", "aircraft", 0)).toThrow("deriveEntityId");
    expect(() => r.create("scenario-a/../x", "aircraft", 0)).toThrow("Invalid entity id");
  });

  it("walks the lifecycle and reports every transition", () => {
    const r = new EntityRegistry();
    expect(r.create(ID, "aircraft", 1)).toEqual({ entityId: ID, tick: 1, from: null, to: "constructing" });
    expect(r.activate(ID, 1).to).toBe("active");
    expect(r.markDegraded(ID, "left generator offline", 5)).toMatchObject({ from: "active", to: "degraded", reason: "left generator offline" });
    expect(r.get(ID)?.degradedCause).toBe("left generator offline");
    r.restore(ID, 6);
    expect(r.get(ID)).toMatchObject({ state: "active", degradedCause: null });
    const result = r.retire(ID, "destroyed", 9);
    expect(result.transitions.map((t) => t.to)).toEqual(["retiring", "retired"]);
    expect(r.get(ID)).toMatchObject({ state: "retired", retiredAtTick: 9, retirementReason: "destroyed" });
  });

  it("rejects illegal transitions, empty degraded cause and ticks before creation", () => {
    const r = new EntityRegistry();
    r.create(ID, "aircraft", 10);
    expect(() => r.markDegraded(ID, "x", 10)).toThrow("cannot go from constructing to degraded");
    expect(() => r.activate(ID, 9)).toThrow("precedes creation");
    r.activate(ID, 10);
    expect(() => r.activate(ID, 11)).toThrow("cannot go from active to active");
    expect(() => r.markDegraded(ID, "  ", 11)).toThrow("stated cause");
    expect(() => r.restore(ID, 11)).toThrow("not degraded");
    expect(() => r.activate("scenario-a/nobody", 11)).toThrow("Unknown entity");
  });

  it("never reuses an id, even after retirement", () => {
    const r = new EntityRegistry();
    r.create(ID, "aircraft", 0);
    expect(() => r.create(ID, "aircraft", 0)).toThrow("already exists");
    r.retire(ID, "despawned", 1);
    expect(() => r.create(ID, "aircraft", 2)).toThrow("never reused");
  });

  it("runs retirement hooks in key order, reports hook faults and still retires", () => {
    const r = new EntityRegistry();
    const calls: string[] = [];
    r.create(ID, "aircraft", 0);
    r.activate(ID, 0);
    r.addRetirementHook(ID, "sensor.radar", (e, reason) => calls.push(`radar:${e.state}:${reason}`));
    r.addRetirementHook(ID, "scheduler", () => calls.push("scheduler"));
    r.addRetirementHook(ID, "resource.power", () => { throw new Error("bus fault"); });
    r.addRetirementHook(ID, "removed", () => calls.push("removed"));
    expect(() => r.addRetirementHook(ID, "scheduler", () => undefined)).toThrow("already registered");
    expect(r.removeRetirementHook(ID, "removed")).toBe(true);
    const result = r.retire(ID, "captured", 3);
    expect(calls).toEqual(["scheduler", "radar:retiring:captured"]);
    expect(result.faults).toEqual([{ entityId: ID, hookKey: "resource.power", message: "bus fault" }]);
    expect(r.get(ID)?.state).toBe("retired");
  });

  it("makes retirement idempotent and cleans up a failed construction", () => {
    const r = new EntityRegistry();
    let cleaned = 0;
    r.create(ID, "aircraft", 0);
    r.addRetirementHook(ID, "partial", () => { cleaned++; });
    expect(r.retire(ID, "despawned", 0).changed).toBe(true);
    expect(r.retire(ID, "destroyed", 1)).toEqual({ transitions: [], faults: [], changed: false });
    expect(cleaned).toBe(1);
    expect(r.get(ID)?.retirementReason).toBe("despawned");
    expect(() => r.addRetirementHook(ID, "late", () => undefined)).toThrow("retired");
  });

  it("reports a re-entrant retire from a hook as a fault without corrupting state", () => {
    const r = new EntityRegistry();
    r.create(ID, "aircraft", 0);
    r.addRetirementHook(ID, "loop", () => { r.retire(ID, "destroyed", 0); });
    const result = r.retire(ID, "destroyed", 0);
    expect(result.faults[0]?.message).toContain("already retiring");
    expect(r.get(ID)?.state).toBe("retired");
  });

  it("unloads for streaming without retiring or running hooks", () => {
    const r = new EntityRegistry();
    let hookRuns = 0;
    r.create(ID, "aircraft", 0);
    r.activate(ID, 0);
    r.addRetirementHook(ID, "h", () => { hookRuns++; });
    r.setResidency(ID, "unloaded");
    expect(r.get(ID)).toMatchObject({ state: "active", residency: "unloaded" });
    r.setResidency(ID, "resident");
    expect(hookRuns).toBe(0);
  });

  it("lists in deterministic id order and returns copies, not live records", () => {
    const r = new EntityRegistry();
    for (const k of ["c", "a", "b"]) r.create(deriveEntityId("s", k), "test", 0);
    expect(r.list().map((e) => e.id)).toEqual(["s/a", "s/b", "s/c"]);
    const copy = r.get("s/a") as { state: string };
    copy.state = "retired";
    expect(r.get("s/a")?.state).toBe("constructing");
  });
});
