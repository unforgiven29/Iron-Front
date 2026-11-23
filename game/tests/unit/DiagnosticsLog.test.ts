import { describe, expect, it } from "vitest";
import { DiagnosticsLog } from "../../src/core/diagnostics/DiagnosticsLog.js";

const base = { ownerModuleId: "test.power", message: "radar denied power" } as const;

describe("DiagnosticsLog", () => {
  it("records structured faults with unknown cause and recovery when not established", () => {
    const log = new DiagnosticsLog();
    const r = log.record({ ...base, code: "RESOURCE_DENIED", severity: "warning", tick: 12, entityId: "s/jet", capabilityId: "test.power" });
    expect(r).toMatchObject({ sequence: 1, cause: "unknown", recovery: "unknown" });
    expect(Object.isFrozen(r)).toBe(true);
    expect(() => log.record({ ...base, code: "bad code", severity: "info", tick: 0 })).toThrow("UPPER_SNAKE_CASE");
    expect(() => log.record({ ...base, code: "X", severity: "info", tick: -1 })).toThrow("tick");
  });

  it("filters by code, entity, correlation, severity and tick", () => {
    const log = new DiagnosticsLog();
    log.record({ ...base, code: "A", severity: "info", tick: 1, entityId: "s/a" });
    log.record({ ...base, code: "B", severity: "error", tick: 5, entityId: "s/b", correlationId: "c-9", cause: "generator offline", recovery: "active" });
    log.record({ ...base, code: "A", severity: "critical", tick: 9, entityId: "s/b" });
    expect(log.query({ code: "A" }).map((r) => r.tick)).toEqual([1, 9]);
    expect(log.query({ entityId: "s/b", minimumSeverity: "error" }).map((r) => r.code)).toEqual(["B", "A"]);
    expect(log.query({ correlationId: "c-9" })[0]?.cause).toBe("generator offline");
    expect(log.query({ sinceTick: 6 })).toHaveLength(1);
  });

  it("is bounded and counts evictions so gaps are visible", () => {
    const log = new DiagnosticsLog(3);
    for (let t = 0; t < 5; t++) log.record({ ...base, code: "T", severity: "info", tick: t });
    expect(log.query().map((r) => r.sequence)).toEqual([3, 4, 5]);
    expect(log.evicted).toBe(2);
    expect(() => new DiagnosticsLog(0)).toThrow("capacity");
  });
});
