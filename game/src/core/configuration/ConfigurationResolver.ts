/**
 * Layered configuration resolution with schema and semantic validation.
 *
 * Owner: game/core/configuration. Produces an immutable resolved configuration plus the
 * origin layer of every resolved leaf value, before any runtime construction uses it.
 *
 * Precedence (later overrides earlier): global < family < variant < installation < scenario.
 * Objects merge key by key. Arrays and scalars replace wholesale. Values are never coerced:
 * a malformed value fails validation instead of being "fixed".
 */
import Ajv2020, { type AnySchema } from "ajv/dist/2020.js";

export const CONFIGURATION_LAYERS = ["global", "family", "variant", "installation", "scenario"] as const;
export type ConfigurationLayerName = (typeof CONFIGURATION_LAYERS)[number];

export interface ConfigurationLayer {
  readonly layer: ConfigurationLayerName;
  /** Where the data came from (file path, package id...), reported in origins and errors. */
  readonly source: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface ConfigurationIssue {
  /** JSON-pointer style path of the offending field, "/" for the root. */
  readonly path: string;
  readonly message: string;
}

/** Cross-field checks a schema cannot express. Returns issues; empty means valid. */
export type SemanticCheck<T> = (config: T) => readonly ConfigurationIssue[];

export interface ConfigurationDefinition<T> {
  readonly configurationId: string;
  readonly schemaVersion: number;
  readonly schema: AnySchema;
  readonly semanticChecks?: readonly SemanticCheck<T>[];
}

export interface ResolvedConfiguration<T> {
  readonly configurationId: string;
  readonly schemaVersion: number;
  readonly value: T;
  /** Leaf path -> "layer:source" that supplied it. */
  readonly origins: Readonly<Record<string, string>>;
}

export type ResolutionOutcome<T> =
  | { readonly ok: true; readonly resolved: ResolvedConfiguration<T> }
  | { readonly ok: false; readonly issues: readonly ConfigurationIssue[] };

const ajv = new Ajv2020({ allErrors: true, strict: false });
const compiled = new WeakMap<object, ReturnType<typeof ajv.compile>>();

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

function merge(
  target: Record<string, unknown>, source: Readonly<Record<string, unknown>>, origin: string,
  origins: Record<string, string>, path: string
): void {
  for (const key of Object.keys(source).sort()) {
    const value = source[key];
    const childPath = `${path}/${key}`;
    if (isPlainObject(value)) {
      const existing = target[key];
      const next: Record<string, unknown> = isPlainObject(existing) ? existing : {};
      if (!isPlainObject(existing)) {
        for (const p of Object.keys(origins)) if (p === childPath || p.startsWith(`${childPath}/`)) delete origins[p];
      }
      target[key] = next;
      merge(next, value, origin, origins, childPath);
    } else {
      for (const p of Object.keys(origins)) if (p.startsWith(`${childPath}/`)) delete origins[p];
      target[key] = structuredClone(value);
      origins[childPath] = origin;
    }
  }
}

export function resolveConfiguration<T>(definition: ConfigurationDefinition<T>, layers: readonly ConfigurationLayer[]): ResolutionOutcome<T> {
  const issues: ConfigurationIssue[] = [];
  const seen = new Map<ConfigurationLayerName, string>();
  for (const l of layers) {
    if (!CONFIGURATION_LAYERS.includes(l.layer)) {
      issues.push({ path: "/", message: `Unknown configuration layer "${String(l.layer)}" from ${l.source}.` });
      continue;
    }
    const previous = seen.get(l.layer);
    if (previous !== undefined) {
      issues.push({ path: "/", message: `Layer "${l.layer}" supplied twice (${previous} and ${l.source}); precedence would be ambiguous.` });
    }
    seen.set(l.layer, l.source);
    if (!isPlainObject(l.data)) issues.push({ path: "/", message: `Layer "${l.layer}" from ${l.source} is not a plain object.` });
  }
  if (issues.length > 0) return { ok: false, issues };

  const value: Record<string, unknown> = {};
  const origins: Record<string, string> = {};
  const ordered = [...layers].sort((a, b) => CONFIGURATION_LAYERS.indexOf(a.layer) - CONFIGURATION_LAYERS.indexOf(b.layer));
  for (const l of ordered) merge(value, l.data, `${l.layer}:${l.source}`, origins, "");

  let validate = compiled.get(definition.schema as object);
  if (!validate) {
    validate = ajv.compile(definition.schema);
    compiled.set(definition.schema as object, validate);
  }
  if (!validate(value)) {
    for (const e of validate.errors ?? []) {
      const path = e.instancePath || "/";
      const supplied = origins[path];
      issues.push({ path, message: `${e.message ?? "invalid"}${supplied ? ` (value from ${supplied})` : ""}` });
    }
    return { ok: false, issues };
  }
  for (const check of definition.semanticChecks ?? []) issues.push(...check(value as T));
  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    resolved: deepFreeze({ configurationId: definition.configurationId, schemaVersion: definition.schemaVersion, value: value as T, origins })
  };
}
