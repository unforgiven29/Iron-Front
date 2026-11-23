/**
 * Entity identity and lifecycle.
 *
 * Owner: game/core/entities. An entity is an identity/composition record only:
 * physical, fuel, sensor and campaign state stay with their owning modules, which
 * attach retirement hooks to release references when the entity leaves simulation.
 *
 * Identity rules: ids are stable strings derived from scenario/content identity,
 * never array indices or display names, and are never reused within a registry,
 * even after retirement (so saved references and replays cannot alias).
 */

export type EntityState = "constructing" | "active" | "degraded" | "retiring" | "retired";

/** Distinct reasons an entity leaves active simulation; deliberately not synonyms. */
export type RetirementReason = "destroyed" | "despawned" | "captured" | "surrendered" | "campaign-removed";

/** Streaming residency is independent of lifecycle: unloading never retires an entity. */
export type EntityResidency = "resident" | "unloaded";

export interface EntityRecord {
  readonly id: string;
  /** Content kind, e.g. a module kind or package-specific type id. Not used for branching in shared code. */
  readonly kind: string;
  readonly state: EntityState;
  readonly residency: EntityResidency;
  readonly createdAtTick: number;
  readonly retiredAtTick: number | null;
  readonly retirementReason: RetirementReason | null;
  /** Human-readable cause for the current degraded state, if any. */
  readonly degradedCause: string | null;
}

export interface LifecycleTransition {
  readonly entityId: string;
  readonly tick: number;
  readonly from: EntityState | null;
  readonly to: EntityState;
  readonly reason?: string;
}

export interface HookFault {
  readonly entityId: string;
  readonly hookKey: string;
  readonly message: string;
}

export interface RetirementResult {
  readonly transitions: readonly LifecycleTransition[];
  /** Hooks that threw. Retirement still completes; the faults are reported, never swallowed. */
  readonly faults: readonly HookFault[];
  /** False when the entity was already retired (idempotent no-op). */
  readonly changed: boolean;
}

export type RetirementHook = (entity: EntityRecord, reason: RetirementReason) => void;

const ID_SEGMENT = /^[a-z0-9][a-z0-9_-]*$/;

/** Deterministic entity id from scenario identity and a content spawn key, e.g. "scenario-a/flight-1/lead". */
export function deriveEntityId(scenarioId: string, ...spawnPath: readonly string[]): string {
  const segments = [scenarioId, ...spawnPath];
  if (spawnPath.length === 0) throw new RangeError("An entity id needs at least one spawn path segment.");
  for (const s of segments) {
    if (!ID_SEGMENT.test(s)) throw new RangeError(`Invalid entity id segment "${s}": use lowercase letters, digits, "-" or "_".`);
  }
  return segments.join("/");
}

function isValidEntityId(id: string): boolean {
  const parts = id.split("/");
  return parts.length >= 2 && parts.every((p) => ID_SEGMENT.test(p));
}

interface MutableRecord {
  id: string;
  kind: string;
  state: EntityState;
  residency: EntityResidency;
  createdAtTick: number;
  retiredAtTick: number | null;
  retirementReason: RetirementReason | null;
  degradedCause: string | null;
}

const ALLOWED: Readonly<Record<EntityState, readonly EntityState[]>> = {
  constructing: ["active", "retiring"],
  active: ["degraded", "retiring"],
  degraded: ["active", "retiring"],
  retiring: ["retired"],
  retired: []
};

export class EntityRegistry {
  private readonly records = new Map<string, MutableRecord>();
  private readonly hooks = new Map<string, Map<string, RetirementHook>>();

  public get(id: string): EntityRecord | undefined {
    const r = this.records.get(id);
    return r ? { ...r } : undefined;
  }

  /** All records in id order (deterministic). */
  public list(filter?: (record: EntityRecord) => boolean): EntityRecord[] {
    return [...this.records.keys()].sort().map((id) => this.get(id) as EntityRecord).filter((r) => !filter || filter(r));
  }

  /** Register a new identity in the constructing state. */
  public create(id: string, kind: string, tick: number): LifecycleTransition {
    if (!isValidEntityId(id)) throw new RangeError(`Invalid entity id "${id}"; derive it with deriveEntityId().`);
    if (kind.length === 0) throw new RangeError("Entity kind must be non-empty.");
    requireTick(tick);
    if (this.records.has(id)) {
      const existing = this.records.get(id) as MutableRecord;
      throw new Error(`Entity id "${id}" already exists (state ${existing.state}); ids are never reused.`);
    }
    this.records.set(id, {
      id, kind, state: "constructing", residency: "resident", createdAtTick: tick,
      retiredAtTick: null, retirementReason: null, degradedCause: null
    });
    return { entityId: id, tick, from: null, to: "constructing" };
  }

  /** Construction finished: constructing -> active. */
  public activate(id: string, tick: number): LifecycleTransition {
    return this.transition(id, "active", tick);
  }

  public markDegraded(id: string, cause: string, tick: number): LifecycleTransition {
    if (cause.trim().length === 0) throw new RangeError("A degraded state needs a stated cause.");
    const t = this.transition(id, "degraded", tick, cause);
    (this.records.get(id) as MutableRecord).degradedCause = cause;
    return t;
  }

  public restore(id: string, tick: number): LifecycleTransition {
    const r = this.require(id);
    if (r.state !== "degraded") throw new Error(`Entity "${id}" is ${r.state}, not degraded.`);
    const t = this.transition(id, "active", tick);
    r.degradedCause = null;
    return t;
  }

  /** Streaming residency change. Never alters lifecycle or runs retirement hooks. */
  public setResidency(id: string, residency: EntityResidency): void {
    const r = this.require(id);
    if (r.state === "retired") throw new Error(`Entity "${id}" is retired; residency no longer applies.`);
    r.residency = residency;
  }

  /**
   * Attach cleanup that must run when the entity retires (scheduler entries, sensor
   * references, resource allocations, weapon links...). Hooks run in key order.
   */
  public addRetirementHook(id: string, key: string, hook: RetirementHook): void {
    const r = this.require(id);
    if (r.state === "retiring" || r.state === "retired") throw new Error(`Entity "${id}" is ${r.state}; cannot add hook "${key}".`);
    const map = this.hooks.get(id) ?? new Map<string, RetirementHook>();
    if (map.has(key)) throw new Error(`Retirement hook "${key}" already registered for "${id}".`);
    map.set(key, hook);
    this.hooks.set(id, map);
  }

  public removeRetirementHook(id: string, key: string): boolean {
    return this.hooks.get(id)?.delete(key) ?? false;
  }

  /**
   * Retire an entity: -> retiring, run hooks in key order, -> retired.
   * Idempotent: retiring an already retired entity returns changed=false.
   * Used both for normal removal and to clean up a failed construction.
   */
  public retire(id: string, reason: RetirementReason, tick: number): RetirementResult {
    const r = this.require(id);
    if (r.state === "retired") return { transitions: [], faults: [], changed: false };
    if (r.state === "retiring") throw new Error(`Entity "${id}" is already retiring (re-entrant retire from a hook?).`);
    const transitions = [this.transition(id, "retiring", tick, reason)];
    r.retirementReason = reason;
    const faults: HookFault[] = [];
    const hooks = this.hooks.get(id) ?? new Map<string, RetirementHook>();
    for (const key of [...hooks.keys()].sort()) {
      try {
        (hooks.get(key) as RetirementHook)(this.get(id) as EntityRecord, reason);
      } catch (cause) {
        faults.push({ entityId: id, hookKey: key, message: cause instanceof Error ? cause.message : String(cause) });
      }
    }
    this.hooks.delete(id);
    transitions.push(this.transition(id, "retired", tick, reason));
    r.retiredAtTick = tick;
    r.degradedCause = null;
    return { transitions, faults, changed: true };
  }

  private transition(id: string, to: EntityState, tick: number, reason?: string): LifecycleTransition {
    requireTick(tick);
    const r = this.require(id);
    if (!ALLOWED[r.state].includes(to)) throw new Error(`Entity "${id}" cannot go from ${r.state} to ${to}.`);
    if (tick < r.createdAtTick) throw new RangeError(`Tick ${tick} precedes creation of "${id}" at ${r.createdAtTick}.`);
    const from = r.state;
    r.state = to;
    return { entityId: id, tick, from, to, ...(reason === undefined ? {} : { reason }) };
  }

  private require(id: string): MutableRecord {
    const r = this.records.get(id);
    if (!r) throw new Error(`Unknown entity "${id}".`);
    return r;
  }
}

function requireTick(tick: number): void {
  if (!Number.isSafeInteger(tick) || tick < 0) throw new RangeError(`Tick must be a non-negative integer, got ${tick}.`);
}
