/**
 * Constructs resolved modules from an explicit factory catalog, in dependency order.
 *
 * Owner: game/core/module-registry. Factories are registered by module id; manifests
 * never name code paths to import. A module receives only the capability instances
 * its manifest bindings grant. Construction failure disposes every already-built
 * module in reverse order and reports the cause.
 */
import type { ResolutionResult } from "./ModuleResolver.js";

export interface ModuleContext {
  readonly moduleId: string;
  /** Instance of a bound required capability. Throws if the manifest did not declare it as required. */
  require<T>(capabilityId: string): T;
  /** Instance of a declared optional capability, or undefined when running degraded. */
  optional<T>(capabilityId: string): T | undefined;
}

export interface ModuleInstance {
  /** Instances keyed by capability id; must match the manifest's `provides` exactly. */
  readonly capabilities: Readonly<Record<string, unknown>>;
  dispose?(): void;
}

export interface ModuleFactory {
  create(context: ModuleContext): ModuleInstance;
}

export type ModuleFactoryCatalog = ReadonlyMap<string, ModuleFactory>;

export interface ComposedRuntime {
  readonly moduleIds: readonly string[];
  capability<T>(moduleId: string, capabilityId: string): T;
  /** Disposes in reverse construction order. Idempotent. */
  dispose(): void;
}

export class ModuleCompositionError extends Error {
  constructor(message: string, readonly moduleId: string, readonly cleanupErrors: readonly unknown[] = []) {
    super(message);
    this.name = "ModuleCompositionError";
  }
}

export function composeModules(resolution: ResolutionResult, catalog: ModuleFactoryCatalog): ComposedRuntime {
  const built: { id: string; instance: ModuleInstance }[] = [];
  const instances = new Map<string, ModuleInstance>();

  const unwind = (): unknown[] => {
    const errors: unknown[] = [];
    for (const { instance } of [...built].reverse()) {
      try {
        instance.dispose?.();
      } catch (cause) {
        errors.push(cause);
      }
    }
    built.length = 0;
    instances.clear();
    return errors;
  };

  for (const resolved of resolution.modules) {
    const { manifest, bindings } = resolved;
    const fail = (message: string): never => {
      throw new ModuleCompositionError(`${manifest.id}: ${message}`, manifest.id, unwind());
    };
    const factory = catalog.get(manifest.id);
    if (!factory) fail("no factory is registered in the catalog.");

    const lookup = (capabilityId: string, wantOptional: boolean): unknown => {
      const binding = bindings.find((b) => b.capabilityId === capabilityId);
      if (!binding) throw new Error(`${manifest.id} did not declare a dependency on "${capabilityId}".`);
      if (binding.optional !== wantOptional) {
        throw new Error(`${manifest.id} declared "${capabilityId}" as ${binding.optional ? "optional" : "required"}.`);
      }
      if (binding.providerModuleId === null) return undefined;
      return instances.get(binding.providerModuleId)?.capabilities[capabilityId];
    };
    const context: ModuleContext = {
      moduleId: manifest.id,
      require: <T>(capabilityId: string) => lookup(capabilityId, false) as T,
      optional: <T>(capabilityId: string) => lookup(capabilityId, true) as T | undefined
    };

    let instance: ModuleInstance;
    try {
      instance = (factory as ModuleFactory).create(context);
    } catch (cause) {
      return fail(`factory failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
    built.push({ id: manifest.id, instance });
    instances.set(manifest.id, instance);

    const declared = manifest.provides.map((c) => c.id).sort();
    const supplied = Object.keys(instance.capabilities).sort();
    if (declared.join("\n") !== supplied.join("\n")) {
      fail(`supplied capabilities [${supplied.join(", ")}] do not match manifest provides [${declared.join(", ")}].`);
    }
  }

  let disposed = false;
  const moduleIds = built.map((b) => b.id);
  return {
    moduleIds,
    capability<T>(moduleId: string, capabilityId: string): T {
      if (disposed) throw new Error("Runtime has been disposed.");
      const instance = instances.get(moduleId);
      if (!instance || !(capabilityId in instance.capabilities)) {
        throw new Error(`Module "${moduleId}" does not provide "${capabilityId}".`);
      }
      return instance.capabilities[capabilityId] as T;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      const errors = unwind();
      if (errors.length > 0) throw new AggregateError(errors, "One or more modules failed to dispose.");
    }
  };
}
