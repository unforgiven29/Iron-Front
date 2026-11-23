import { describe, expect, it } from "vitest";
import { resolveModules, type ResolutionDiagnosticCode, type ResolutionResult } from "../../src/core/modules/ModuleResolver.js";
import type { ModuleDependency, ModuleManifest } from "../../src/core/modules/ModuleTypes.js";

const HOST = "0.1.0";

function manifest(id: string, provides: [string, string][], dependencies: ModuleDependency[] = [], overrides: Partial<ModuleManifest> = {}): ModuleManifest {
  return {
    manifestSchemaVersion: 1,
    id,
    kind: "simulation-service",
    name: `Test module ${id}`,
    version: "0.1.0",
    apiCompatibility: { minimum: "0.1.0", maximumExclusive: "0.2.0" },
    provides: provides.map(([capability, apiVersion]) => ({ id: capability, apiVersion })),
    dependencies,
    configuration: [],
    ...overrides
  };
}
const req = (capabilityId: string, versionRange = "^0.1.0", providerModuleId?: string): ModuleDependency =>
  ({ capabilityId, versionRange, optional: false, ...(providerModuleId === undefined ? {} : { providerModuleId }) });
const opt = (capabilityId: string, versionRange = "^0.1.0"): ModuleDependency =>
  ({ capabilityId, versionRange, optional: true, degradedBehavior: "Operate without it and report reduced capability." });

const codes = (r: ResolutionResult): ResolutionDiagnosticCode[] => r.diagnostics.map((d) => d.code);
const ids = (r: ResolutionResult): string[] => r.modules.map((m) => m.manifest.id);

describe("resolveModules", () => {
  it("composes a consumer with one provider through one capability, providers first", () => {
    const result = resolveModules({
      hostApiVersion: HOST,
      manifests: [
        manifest("test.consumer", [["test.consumer.api", "0.1.0"]], [req("test.counter")]),
        manifest("test.provider", [["test.counter", "0.1.4"]])
      ]
    });
    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(ids(result)).toEqual(["test.provider", "test.consumer"]);
    expect(result.modules[1]?.bindings).toEqual([
      { capabilityId: "test.counter", optional: false, providerModuleId: "test.provider", reason: "Only compatible provider (test.provider@0.1.4)." }
    ]);
  });

  it("is independent of manifest input order", () => {
    const set = [
      manifest("test.c", [], [req("cap.b"), req("cap.a")]),
      manifest("test.b", [["cap.b", "0.1.0"]], [req("cap.a")]),
      manifest("test.a", [["cap.a", "0.1.0"]]),
      manifest("test.z", [])
    ];
    const forward = resolveModules({ hostApiVersion: HOST, manifests: set });
    const reversed = resolveModules({ hostApiVersion: HOST, manifests: [...set].reverse() });
    expect(ids(forward)).toEqual(["test.a", "test.b", "test.c", "test.z"]);
    expect(reversed).toEqual(forward);
  });

  it("rejects a schema-invalid manifest with the schema error", () => {
    const bad = { ...manifest("test.bad", []), apiCompatibility: { minimum: "0.1.0" } };
    const result = resolveModules({ hostApiVersion: HOST, manifests: [bad] });
    expect(result.ok).toBe(false);
    expect(codes(result)).toEqual(["MANIFEST_INVALID"]);
    expect(result.diagnostics[0]?.moduleId).toBe("test.bad");
    expect(result.diagnostics[0]?.message).toContain("maximumExclusive");
  });

  it("rejects a missing required dependency and every module that requires the rejected one", () => {
    const result = resolveModules({
      hostApiVersion: HOST,
      manifests: [
        manifest("test.top", [], [req("cap.mid")]),
        manifest("test.mid", [["cap.mid", "0.1.0"]], [req("cap.absent")]),
        manifest("test.unrelated", [])
      ]
    });
    expect(result.ok).toBe(false);
    expect(ids(result)).toEqual(["test.unrelated"]);
    expect(result.rejectedModuleIds).toEqual(["test.mid", "test.top"]);
    expect(codes(result)).toEqual(["MISSING_PROVIDER", "PROVIDER_UNAVAILABLE"]);
    expect(result.diagnostics[0]?.message).toContain("cap.absent");
  });

  it("rejects an incompatible provider version and names what was available", () => {
    const result = resolveModules({
      hostApiVersion: HOST,
      manifests: [manifest("test.consumer", [], [req("cap.x", "^0.2.0")]), manifest("test.old", [["cap.x", "0.1.9"]])]
    });
    expect(codes(result)).toEqual(["INCOMPATIBLE_PROVIDER"]);
    expect(result.diagnostics[0]?.message).toContain("test.old@0.1.9");
    expect(ids(result)).toEqual(["test.old"]);
  });

  it("rejects every module in a dependency cycle and reports the cycle path", () => {
    const result = resolveModules({
      hostApiVersion: HOST,
      manifests: [
        manifest("test.a", [["cap.a", "0.1.0"]], [req("cap.b")]),
        manifest("test.b", [["cap.b", "0.1.0"]], [req("cap.c")]),
        manifest("test.c", [["cap.c", "0.1.0"]], [req("cap.a")]),
        manifest("test.d", [], [req("cap.a")])
      ]
    });
    expect(result.modules).toEqual([]);
    expect(result.rejectedModuleIds).toEqual(["test.a", "test.b", "test.c", "test.d"]);
    expect(codes(result)).toEqual(["DEPENDENCY_CYCLE", "DEPENDENCY_CYCLE", "DEPENDENCY_CYCLE", "PROVIDER_UNAVAILABLE"]);
    expect(result.diagnostics[0]?.message).toContain("test.a -> test.b -> test.c -> test.a");
  });

  it("rejects self dependency", () => {
    const result = resolveModules({ hostApiVersion: HOST, manifests: [manifest("test.self", [["cap.s", "0.1.0"]], [req("cap.s")])] });
    expect(codes(result)).toEqual(["SELF_DEPENDENCY"]);
  });

  it("rejects all copies of a duplicated module id instead of choosing by input order", () => {
    const result = resolveModules({ hostApiVersion: HOST, manifests: [manifest("test.dup", []), manifest("test.dup", [])] });
    expect(codes(result)).toEqual(["DUPLICATE_MODULE"]);
    expect(result.modules).toEqual([]);
  });

  it("checks host API compatibility at both bounds, with null as unbounded", () => {
    const tooNew = manifest("test.new", [], [], { apiCompatibility: { minimum: "0.2.0", maximumExclusive: null } });
    const tooOld = manifest("test.old", [], [], { apiCompatibility: { minimum: "0.0.1", maximumExclusive: "0.1.0" } });
    const open = manifest("test.open", [], [], { apiCompatibility: { minimum: "0.1.0", maximumExclusive: null } });
    const result = resolveModules({ hostApiVersion: HOST, manifests: [tooNew, tooOld, open] });
    expect(ids(result)).toEqual(["test.open"]);
    expect(codes(result)).toEqual(["HOST_API_INCOMPATIBLE", "HOST_API_INCOMPATIBLE"]);
  });

  it("runs degraded with a warning when an optional provider is absent", () => {
    const result = resolveModules({ hostApiVersion: HOST, manifests: [manifest("test.consumer", [], [opt("cap.radar")])] });
    expect(result.ok).toBe(true);
    expect(result.modules[0]?.status).toBe("degraded");
    expect(result.modules[0]?.bindings[0]?.providerModuleId).toBeNull();
    expect(result.diagnostics).toMatchObject([{ code: "OPTIONAL_DEPENDENCY_DEGRADED", severity: "warning" }]);
  });

  it("degrades an optional binding when its provider is later rejected", () => {
    const result = resolveModules({
      hostApiVersion: HOST,
      manifests: [manifest("test.consumer", [], [opt("cap.p")]), manifest("test.p", [["cap.p", "0.1.0"]], [req("cap.absent")])]
    });
    expect(ids(result)).toEqual(["test.consumer"]);
    expect(result.modules[0]?.status).toBe("degraded");
    expect(codes(result)).toEqual(["MISSING_PROVIDER", "OPTIONAL_DEPENDENCY_DEGRADED"]);
  });

  it("requires an explicit selection when several providers are compatible", () => {
    const manifests = [
      manifest("test.consumer", [], [req("cap.engine")]),
      manifest("test.engine-a", [["cap.engine", "0.1.0"]]),
      manifest("test.engine-b", [["cap.engine", "0.1.2"]])
    ];
    const ambiguous = resolveModules({ hostApiVersion: HOST, manifests });
    expect(codes(ambiguous)).toEqual(["AMBIGUOUS_PROVIDER"]);

    const selected = resolveModules({ hostApiVersion: HOST, manifests, providerSelections: { "cap.engine": "test.engine-a" } });
    expect(selected.ok).toBe(true);
    expect(selected.modules.find((m) => m.manifest.id === "test.consumer")?.bindings[0]?.providerModuleId).toBe("test.engine-a");

    const wrong = resolveModules({ hostApiVersion: HOST, manifests, providerSelections: { "cap.engine": "test.nope" } });
    expect(codes(wrong)).toEqual(["INVALID_SELECTION"]);
  });

  it("treats ambiguity as an error even for optional dependencies", () => {
    const result = resolveModules({
      hostApiVersion: HOST,
      manifests: [manifest("test.c", [], [opt("cap.x")]), manifest("test.x1", [["cap.x", "0.1.0"]]), manifest("test.x2", [["cap.x", "0.1.0"]])]
    });
    expect(codes(result)).toEqual(["AMBIGUOUS_PROVIDER"]);
    expect(result.rejectedModuleIds).toEqual(["test.c"]);
  });

  it("honours a manifest-named provider and never substitutes another", () => {
    const manifests = [
      manifest("test.consumer", [], [req("cap.engine", "^0.1.0", "test.engine-b")]),
      manifest("test.engine-a", [["cap.engine", "0.1.0"]]),
      manifest("test.engine-b", [["cap.engine", "0.2.0"]])
    ];
    const result = resolveModules({ hostApiVersion: HOST, manifests });
    expect(codes(result)).toEqual(["INCOMPATIBLE_PROVIDER"]);
    expect(result.rejectedModuleIds).toEqual(["test.consumer"]);
  });

  it("rejects an unparseable version range rather than treating it as any version", () => {
    const result = resolveModules({
      hostApiVersion: HOST,
      manifests: [manifest("test.c", [], [opt("cap.x", "latest")]), manifest("test.x", [["cap.x", "0.1.0"]])]
    });
    expect(codes(result)).toEqual(["INVALID_VERSION_RANGE"]);
  });
});
