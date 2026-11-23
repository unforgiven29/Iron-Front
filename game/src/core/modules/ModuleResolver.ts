/**
 * Module manifest validation and capability/dependency resolution.
 *
 * Owner: game/core/module-registry. This resolves composition metadata only; it
 * never constructs modules or performs domain behaviour (see ModuleComposer).
 * Resolution is a pure function of its inputs: the order manifests are supplied
 * in never changes the outcome.
 */
import Ajv2020 from "ajv/dist/2020.js";
import manifestSchema from "../../../../docs/module-system/schemas/module-manifest.schema.json";
import type { ModuleDependency, ModuleManifest } from "./ModuleTypes.js";
import { compareVersions, parseRange, parseVersion, satisfies, type SemanticVersion } from "./SemanticVersion.js";

export type ResolutionDiagnosticCode =
  | "MANIFEST_INVALID"
  | "DUPLICATE_MODULE"
  | "HOST_API_INCOMPATIBLE"
  | "INVALID_VERSION_RANGE"
  | "SELF_DEPENDENCY"
  | "MISSING_PROVIDER"
  | "INCOMPATIBLE_PROVIDER"
  | "AMBIGUOUS_PROVIDER"
  | "INVALID_SELECTION"
  | "PROVIDER_UNAVAILABLE"
  | "DEPENDENCY_CYCLE"
  | "OPTIONAL_DEPENDENCY_DEGRADED";

export interface ResolutionDiagnostic {
  readonly code: ResolutionDiagnosticCode;
  readonly severity: "error" | "warning";
  /** Module the diagnostic is about, or null when the manifest had no readable id. */
  readonly moduleId: string | null;
  readonly capabilityId?: string;
  readonly message: string;
}

export interface CapabilityBinding {
  readonly capabilityId: string;
  readonly optional: boolean;
  /** Selected provider, or null for an optional dependency running degraded. */
  readonly providerModuleId: string | null;
  readonly reason: string;
}

export interface ResolvedModule {
  readonly manifest: ModuleManifest;
  readonly status: "ready" | "degraded";
  readonly bindings: readonly CapabilityBinding[];
}

export interface ResolutionResult {
  /** True when every supplied manifest resolved (possibly degraded). */
  readonly ok: boolean;
  /** Accepted modules in deterministic dependency order: providers before consumers. */
  readonly modules: readonly ResolvedModule[];
  readonly rejectedModuleIds: readonly string[];
  readonly diagnostics: readonly ResolutionDiagnostic[];
}

export interface ResolutionRequest {
  readonly manifests: readonly unknown[];
  /** Version of the host module API the manifests' apiCompatibility is checked against. */
  readonly hostApiVersion: string;
  /** Explicit provider choice per capability ID when several compatible providers exist. */
  readonly providerSelections?: Readonly<Record<string, string>>;
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateManifestSchema = ajv.compile<ModuleManifest>(manifestSchema);

const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function validateManifest(candidate: unknown): { ok: true; manifest: ModuleManifest } | { ok: false; errors: string[] } {
  if (validateManifestSchema(candidate)) return { ok: true, manifest: candidate };
  const errors = (validateManifestSchema.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? "invalid"}`);
  return { ok: false, errors };
}

/** Faults in the manifest or selection itself: never downgraded to optional degradation. */
const CONFIGURATION_ERRORS: ReadonlySet<ResolutionDiagnosticCode> = new Set([
  "INVALID_VERSION_RANGE", "SELF_DEPENDENCY", "AMBIGUOUS_PROVIDER", "INVALID_SELECTION"
]);

interface Working {
  readonly manifest: ModuleManifest;
  readonly bindings: CapabilityBinding[];
  degraded: boolean;
}

export function resolveModules(request: ResolutionRequest): ResolutionResult {
  const diagnostics: ResolutionDiagnostic[] = [];
  const rejected = new Set<string>();
  const error = (code: ResolutionDiagnosticCode, moduleId: string | null, message: string, capabilityId?: string): void => {
    diagnostics.push({ code, severity: "error", moduleId, message, ...(capabilityId === undefined ? {} : { capabilityId }) });
  };

  const hostApi = parseVersion(request.hostApiVersion);
  if (!hostApi) throw new Error(`Host API version "${request.hostApiVersion}" is not a semantic version.`);

  // 1. Schema validation.
  const valid: ModuleManifest[] = [];
  for (const candidate of request.manifests) {
    const result = validateManifest(candidate);
    if (result.ok) {
      valid.push(result.manifest);
      continue;
    }
    const id = typeof (candidate as { id?: unknown } | null)?.id === "string" ? (candidate as { id: string }).id : null;
    if (id !== null) rejected.add(id);
    error("MANIFEST_INVALID", id, `Manifest failed schema validation: ${result.errors.join("; ")}`);
  }

  // 2. Duplicate identities: reject every copy rather than picking one by input order.
  const counts = new Map<string, number>();
  for (const m of valid) counts.set(m.id, (counts.get(m.id) ?? 0) + 1);
  const modules = new Map<string, Working>();
  for (const m of [...valid].sort((a, b) => byId(a.id, b.id))) {
    const count = counts.get(m.id) ?? 0;
    if (count > 1) {
      if (!rejected.has(m.id)) error("DUPLICATE_MODULE", m.id, `Module id "${m.id}" is declared by ${count} manifests.`);
      rejected.add(m.id);
      continue;
    }
    if (rejected.has(m.id)) continue;
    modules.set(m.id, { manifest: m, bindings: [], degraded: false });
  }

  // 3. Host API compatibility.
  for (const [id, w] of modules) {
    const min = parseVersion(w.manifest.apiCompatibility.minimum) as SemanticVersion;
    const maxText = w.manifest.apiCompatibility.maximumExclusive;
    const max = maxText === null ? null : (parseVersion(maxText) as SemanticVersion);
    if (compareVersions(hostApi, min) < 0 || (max !== null && compareVersions(hostApi, max) >= 0)) {
      error("HOST_API_INCOMPATIBLE", id, `Host API ${request.hostApiVersion} is outside [${w.manifest.apiCompatibility.minimum}, ${maxText ?? "unbounded"}).`);
      modules.delete(id);
      rejected.add(id);
    }
  }

  // 4. Bind each dependency to exactly one provider.
  const blockedBy = new Map<string, Set<string>>(); // consumer -> providers whose failure blocks it
  for (const [id, w] of modules) {
    const deps = new Set<string>();
    blockedBy.set(id, deps);
    for (const dep of w.manifest.dependencies) {
      const outcome = bindDependency(id, dep, modules, request.providerSelections ?? {});
      if (outcome.kind === "bound") {
        w.bindings.push({ capabilityId: dep.capabilityId, optional: dep.optional, providerModuleId: outcome.providerId, reason: outcome.reason });
        deps.add(outcome.providerId);
      } else if (dep.optional && !CONFIGURATION_ERRORS.has(outcome.code)) {
        w.degraded = true;
        w.bindings.push({ capabilityId: dep.capabilityId, optional: true, providerModuleId: null, reason: outcome.message });
        diagnostics.push({
          code: "OPTIONAL_DEPENDENCY_DEGRADED", severity: "warning", moduleId: id, capabilityId: dep.capabilityId,
          message: `${outcome.message} Running degraded: ${dep.degradedBehavior ?? ""}`
        });
      } else {
        error(outcome.code, id, outcome.message, dep.capabilityId);
        rejected.add(id);
      }
    }
  }
  for (const id of rejected) modules.delete(id);

  // 5. Cycles among remaining modules (all bound edges, optional included: construction order must exist).
  for (const cycle of findCycles(modules)) {
    for (const id of cycle) {
      error("DEPENDENCY_CYCLE", id, `Dependency cycle: ${[...cycle, cycle[0]].join(" -> ")}.`);
      rejected.add(id);
      modules.delete(id);
    }
  }

  // 6. Propagate provider loss to a fixpoint.
  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, w] of [...modules].sort((a, b) => byId(a[0], b[0]))) {
      for (let i = 0; i < w.bindings.length; i++) {
        const b = w.bindings[i] as CapabilityBinding;
        if (b.providerModuleId === null || !rejected.has(b.providerModuleId)) continue;
        if (b.optional) {
          const dep = w.manifest.dependencies.find((d) => d.capabilityId === b.capabilityId);
          w.bindings[i] = { ...b, providerModuleId: null, reason: `Provider "${b.providerModuleId}" was rejected.` };
          w.degraded = true;
          diagnostics.push({
            code: "OPTIONAL_DEPENDENCY_DEGRADED", severity: "warning", moduleId: id, capabilityId: b.capabilityId,
            message: `Provider "${b.providerModuleId}" was rejected. Running degraded: ${dep?.degradedBehavior ?? ""}`
          });
        } else {
          error("PROVIDER_UNAVAILABLE", id, `Required provider "${b.providerModuleId}" for "${b.capabilityId}" was rejected.`, b.capabilityId);
          rejected.add(id);
          modules.delete(id);
          changed = true;
          break;
        }
      }
    }
  }

  const ordered = topologicalOrder(modules).map((id) => {
    const w = modules.get(id) as Working;
    return { manifest: w.manifest, status: w.degraded ? "degraded" : "ready", bindings: w.bindings } as const;
  });
  return {
    ok: rejected.size === 0 && diagnostics.every((d) => d.severity !== "error"),
    modules: ordered,
    rejectedModuleIds: [...rejected].sort(byId),
    diagnostics
  };
}

type BindOutcome =
  | { kind: "bound"; providerId: string; reason: string }
  | { kind: "failed"; code: ResolutionDiagnosticCode; message: string };

function bindDependency(
  consumerId: string,
  dep: ModuleDependency,
  modules: ReadonlyMap<string, Working>,
  selections: Readonly<Record<string, string>>
): BindOutcome {
  const fail = (code: ResolutionDiagnosticCode, message: string): BindOutcome => ({ kind: "failed", code, message });
  const range = parseRange(dep.versionRange);
  if (!range) return fail("INVALID_VERSION_RANGE", `Version range "${dep.versionRange}" for "${dep.capabilityId}" is not understood.`);

  const consumer = modules.get(consumerId)?.manifest;
  if (consumer?.provides.some((c) => c.id === dep.capabilityId) && dep.providerModuleId === undefined) {
    return fail("SELF_DEPENDENCY", `Module depends on capability "${dep.capabilityId}" that it provides itself.`);
  }
  if (dep.providerModuleId === consumerId) return fail("SELF_DEPENDENCY", `Module names itself as provider of "${dep.capabilityId}".`);

  const providers = [...modules.values()]
    .filter((w) => w.manifest.id !== consumerId)
    .flatMap((w) => w.manifest.provides.filter((c) => c.id === dep.capabilityId).map((c) => ({ id: w.manifest.id, apiVersion: c.apiVersion })))
    .sort((a, b) => byId(a.id, b.id));
  const compatible = providers.filter((p) => satisfies(parseVersion(p.apiVersion) as SemanticVersion, range));
  const describe = (ps: typeof providers): string => ps.map((p) => `${p.id}@${p.apiVersion}`).join(", ");

  if (dep.providerModuleId !== undefined) {
    const named = providers.find((p) => p.id === dep.providerModuleId);
    if (!named) return fail("MISSING_PROVIDER", `Named provider "${dep.providerModuleId}" for "${dep.capabilityId}" is not available.`);
    if (!compatible.includes(named)) {
      return fail("INCOMPATIBLE_PROVIDER", `Named provider ${named.id}@${named.apiVersion} does not satisfy "${dep.versionRange}" for "${dep.capabilityId}".`);
    }
    return { kind: "bound", providerId: named.id, reason: "Explicit providerModuleId in manifest." };
  }
  if (compatible.length === 0) {
    if (providers.length > 0) {
      return fail("INCOMPATIBLE_PROVIDER", `No provider of "${dep.capabilityId}" satisfies "${dep.versionRange}" (available: ${describe(providers)}).`);
    }
    return fail("MISSING_PROVIDER", `No module provides required capability "${dep.capabilityId}".`);
  }
  if (compatible.length === 1) {
    const only = compatible[0] as (typeof providers)[number];
    return { kind: "bound", providerId: only.id, reason: `Only compatible provider (${only.id}@${only.apiVersion}).` };
  }
  const selected = selections[dep.capabilityId];
  if (selected === undefined) {
    return fail("AMBIGUOUS_PROVIDER", `Several providers satisfy "${dep.capabilityId}" (${describe(compatible)}); select one explicitly.`);
  }
  if (!compatible.some((p) => p.id === selected)) {
    return fail("INVALID_SELECTION", `Configured provider "${selected}" is not a compatible provider of "${dep.capabilityId}" (compatible: ${describe(compatible)}).`);
  }
  return { kind: "bound", providerId: selected, reason: "Configured provider selection." };
}

function edges(w: Working): string[] {
  return w.bindings.flatMap((b) => (b.providerModuleId === null ? [] : [b.providerModuleId])).sort(byId);
}

/** Tarjan strongly-connected components; returns each cycle with ids sorted for stable reporting. */
function findCycles(modules: ReadonlyMap<string, Working>): string[][] {
  let index = 0;
  const indices = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const cycles: string[][] = [];
  const visit = (v: string): void => {
    indices.set(v, index);
    low.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);
    for (const w of edges(modules.get(v) as Working)) {
      if (!modules.has(w)) continue;
      if (!indices.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v) as number, low.get(w) as number));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v) as number, indices.get(w) as number));
      }
    }
    if (low.get(v) === indices.get(v)) {
      const component: string[] = [];
      let w: string;
      do {
        w = stack.pop() as string;
        onStack.delete(w);
        component.push(w);
      } while (w !== v);
      if (component.length > 1) cycles.push(component.sort(byId));
    }
  };
  for (const id of [...modules.keys()].sort(byId)) if (!indices.has(id)) visit(id);
  return cycles;
}

/** Kahn's algorithm with lexicographic tie-breaking: providers first, deterministic. */
function topologicalOrder(modules: ReadonlyMap<string, Working>): string[] {
  const pending = new Map<string, Set<string>>();
  for (const [id, w] of modules) pending.set(id, new Set(edges(w).filter((p) => modules.has(p))));
  const order: string[] = [];
  while (pending.size > 0) {
    const next = [...pending].filter(([, deps]) => deps.size === 0).map(([id]) => id).sort(byId)[0];
    if (next === undefined) throw new Error("Internal error: cycle survived cycle rejection.");
    order.push(next);
    pending.delete(next);
    for (const deps of pending.values()) deps.delete(next);
  }
  return order;
}
