import { describe, expect, it } from "vitest";
import { resolveConfiguration, type ConfigurationDefinition } from "../../src/core/configuration/ConfigurationResolver.js";

interface TestConfig { generator: { ratedPowerW: number; minimumW: number }; lights: string[]; label?: string }

const definition: ConfigurationDefinition<TestConfig> = {
  configurationId: "test.power-config",
  schemaVersion: 1,
  schema: {
    type: "object", additionalProperties: false, required: ["generator", "lights"],
    properties: {
      generator: { type: "object", additionalProperties: false, required: ["ratedPowerW", "minimumW"], properties: { ratedPowerW: { type: "number", exclusiveMinimum: 0 }, minimumW: { type: "number", minimum: 0 } } },
      lights: { type: "array", items: { type: "string" } },
      label: { type: "string" }
    }
  },
  semanticChecks: [(c) => (c.generator.minimumW > c.generator.ratedPowerW ? [{ path: "/generator/minimumW", message: "must not exceed ratedPowerW" }] : [])]
};

describe("resolveConfiguration", () => {
  it("applies precedence regardless of layer order and records the origin of every leaf", () => {
    const layers = [
      { layer: "scenario" as const, source: "scenario.json", data: { generator: { ratedPowerW: 800 } } },
      { layer: "global" as const, source: "global.json", data: { generator: { ratedPowerW: 1000, minimumW: 100 }, lights: ["nav", "strobe"] } },
      { layer: "variant" as const, source: "variant.json", data: { lights: ["nav"], label: "test variant" } }
    ];
    const out = resolveConfiguration(definition, layers);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.resolved.value).toEqual({ generator: { ratedPowerW: 800, minimumW: 100 }, lights: ["nav"], label: "test variant" });
    expect(out.resolved.origins).toEqual({
      "/generator/ratedPowerW": "scenario:scenario.json",
      "/generator/minimumW": "global:global.json",
      "/lights": "variant:variant.json",
      "/label": "variant:variant.json"
    });
    expect(Object.isFrozen(out.resolved.value.generator)).toBe(true);
    expect(resolveConfiguration(definition, [...layers].reverse())).toEqual(out);
  });

  it("reports schema errors with the path and the layer that supplied the bad value, never coercing", () => {
    const out = resolveConfiguration(definition, [
      { layer: "global", source: "g.json", data: { generator: { ratedPowerW: 1000, minimumW: 0 }, lights: [] } },
      { layer: "installation", source: "fit.json", data: { generator: { ratedPowerW: "900" } } }
    ]);
    expect(out).toEqual({ ok: false, issues: [{ path: "/generator/ratedPowerW", message: "must be number (value from installation:fit.json)" }] });
  });

  it("rejects unknown fields, missing required data and semantic violations", () => {
    expect(resolveConfiguration(definition, [{ layer: "global", source: "g", data: { generator: { ratedPowerW: 1, minimumW: 0 }, lights: [], typo: 1 } }]).ok).toBe(false);
    expect(resolveConfiguration(definition, [{ layer: "global", source: "g", data: { lights: [] } }]).ok).toBe(false);
    expect(resolveConfiguration(definition, [{ layer: "global", source: "g", data: { generator: { ratedPowerW: 100, minimumW: 200 }, lights: [] } }]))
      .toEqual({ ok: false, issues: [{ path: "/generator/minimumW", message: "must not exceed ratedPowerW" }] });
  });

  it("rejects duplicate and unknown layers instead of guessing precedence", () => {
    const dup = resolveConfiguration(definition, [{ layer: "global", source: "a", data: {} }, { layer: "global", source: "b", data: {} }]);
    expect(dup.ok ? [] : dup.issues[0]?.message).toContain("supplied twice");
    const unknown = resolveConfiguration(definition, [{ layer: "user" as never, source: "u", data: {} }]);
    expect(unknown.ok ? [] : unknown.issues[0]?.message).toContain('Unknown configuration layer "user"');
  });

  it("a scalar replacing an object drops the object's stale origins", () => {
    const loose: ConfigurationDefinition<Record<string, unknown>> = { configurationId: "t", schemaVersion: 1, schema: { type: "object" } };
    const out = resolveConfiguration(loose, [
      { layer: "global", source: "g", data: { a: { b: 1, c: 2 } } },
      { layer: "variant", source: "v", data: { a: 5 } }
    ]);
    expect(out.ok && out.resolved.origins).toEqual({ "/a": "variant:v" });
  });
});
