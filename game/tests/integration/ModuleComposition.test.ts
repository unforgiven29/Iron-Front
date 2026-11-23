import { describe, expect, it } from "vitest";
import { composeModules, ModuleCompositionError, type ModuleFactory } from "../../src/core/modules/ModuleComposer.js";
import { resolveModules } from "../../src/core/modules/ModuleResolver.js";
import type { ModuleManifest } from "../../src/core/modules/ModuleTypes.js";

/** Test-only capability interface shared by the two test modules. */
interface CounterApi {
  increment(): number;
}

const base = { manifestSchemaVersion: 1, kind: "simulation-service", version: "0.1.0", apiCompatibility: { minimum: "0.1.0", maximumExclusive: null }, configuration: [] } as const;
const providerManifest: ModuleManifest = { ...base, id: "test.counter", name: "Test counter", provides: [{ id: "test.counter-api", apiVersion: "0.1.0" }], dependencies: [] };
const consumerManifest: ModuleManifest = {
  ...base, id: "test.consumer", name: "Test consumer",
  provides: [{ id: "test.consumer-api", apiVersion: "0.1.0" }],
  dependencies: [
    { capabilityId: "test.counter-api", versionRange: "^0.1.0", optional: false },
    { capabilityId: "test.logger", versionRange: "^0.1.0", optional: true, degradedBehavior: "No logging." }
  ]
};

function catalog(log: string[], overrides: Record<string, ModuleFactory> = {}): Map<string, ModuleFactory> {
  return new Map<string, ModuleFactory>(Object.entries({
    "test.counter": {
      create: () => {
        let count = 0;
        log.push("create counter");
        return { capabilities: { "test.counter-api": { increment: () => ++count } satisfies CounterApi }, dispose: () => log.push("dispose counter") };
      }
    },
    "test.consumer": {
      create: (ctx) => {
        const counter = ctx.require<CounterApi>("test.counter-api");
        const logger = ctx.optional<unknown>("test.logger");
        log.push(`create consumer logger=${String(logger)}`);
        return { capabilities: { "test.consumer-api": { twice: () => [counter.increment(), counter.increment()] } }, dispose: () => log.push("dispose consumer") };
      }
    },
    ...overrides
  }));
}

describe("composeModules", () => {
  const resolution = resolveModules({ hostApiVersion: "0.1.0", manifests: [consumerManifest, providerManifest] });

  it("composes two test modules through one capability interface and disposes in reverse", () => {
    const log: string[] = [];
    const runtime = composeModules(resolution, catalog(log));
    expect(runtime.moduleIds).toEqual(["test.counter", "test.consumer"]);
    expect(runtime.capability<{ twice(): number[] }>("test.consumer", "test.consumer-api").twice()).toEqual([1, 2]);
    expect(runtime.capability<CounterApi>("test.counter", "test.counter-api").increment()).toBe(3);
    runtime.dispose();
    runtime.dispose();
    expect(log).toEqual(["create counter", "create consumer logger=undefined", "dispose consumer", "dispose counter"]);
    expect(() => runtime.capability("test.counter", "test.counter-api")).toThrow("disposed");
  });

  it("unwinds already-built modules when a factory fails", () => {
    const log: string[] = [];
    const failing = catalog(log, { "test.consumer": { create: () => { throw new Error("boom"); } } });
    const attempt = () => composeModules(resolution, failing);
    expect(attempt).toThrow(ModuleCompositionError);
    expect(attempt).toThrow("test.consumer: factory failed: boom");
    expect(log.filter((l) => l.startsWith("dispose"))).toEqual(["dispose counter", "dispose counter"]);
  });

  it("rejects a module whose instance does not match its declared capabilities", () => {
    const log: string[] = [];
    const wrong = catalog(log, { "test.counter": { create: () => ({ capabilities: { "test.other": {} }, dispose: () => log.push("dispose wrong") }) } });
    expect(() => composeModules(resolution, wrong)).toThrow("do not match manifest provides");
    expect(log).toEqual(["dispose wrong"]);
  });

  it("rejects a missing factory and undeclared capability access", () => {
    expect(() => composeModules(resolution, new Map())).toThrow("no factory is registered");
    const sneaky = catalog([], { "test.consumer": { create: (ctx) => { ctx.require("test.undeclared"); return { capabilities: {} }; } } });
    expect(() => composeModules(resolution, sneaky)).toThrow('did not declare a dependency on "test.undeclared"');
    const misuse = catalog([], { "test.consumer": { create: (ctx) => { ctx.require("test.logger"); return { capabilities: {} }; } } });
    expect(() => composeModules(resolution, misuse)).toThrow('declared "test.logger" as optional');
  });
});
