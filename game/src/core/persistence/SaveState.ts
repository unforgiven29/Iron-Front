/**
 * Save/load envelope with atomic restore, and an external-input journal for deterministic replay.
 *
 * Owner: game/core/persistence. It coordinates serialization only: each module serializes and
 * validates its own authoritative state through PersistableModule. No JavaScript object graphs,
 * closures or renderer handles are stored. Every payload must survive a JSON round trip.
 *
 * Save restores a snapshot. Replay rebuilds a timeline from the initial state plus the journal.
 */

export const SAVE_FORMAT_VERSION = 1;

export interface PersistableModule {
  readonly moduleId: string;
  readonly stateVersion: number;
  /** JSON-safe copy of this module's authoritative state. */
  save(): unknown;
  /** Problems with a candidate state; empty means it can be loaded. Must not mutate anything. */
  validate(state: unknown): readonly string[];
  /** Replace live state. Called only after every module's validate() passed. */
  load(state: unknown): void;
}

export interface SaveContext {
  readonly scenarioId: string;
  readonly seed: number;
  readonly tick: number;
  readonly stepSeconds: number;
}

export interface SaveEnvelope extends SaveContext {
  readonly formatVersion: number;
  readonly modules: readonly { readonly moduleId: string; readonly stateVersion: number; readonly state: unknown }[];
}

export type LoadOutcome =
  | { readonly ok: true; readonly tick: number }
  | { readonly ok: false; readonly errors: readonly string[]; readonly rolledBack: boolean };

function jsonRoundTrip(value: unknown, what: string): unknown {
  const text = JSON.stringify(value);
  if (text === undefined) throw new Error(`${what} is not JSON-serializable.`);
  return JSON.parse(text) as unknown;
}

export function createSave(context: SaveContext, modules: readonly PersistableModule[]): SaveEnvelope {
  const ids = new Set<string>();
  for (const m of modules) {
    if (ids.has(m.moduleId)) throw new Error(`Module "${m.moduleId}" is listed twice.`);
    ids.add(m.moduleId);
  }
  return {
    formatVersion: SAVE_FORMAT_VERSION,
    ...context,
    modules: [...modules]
      .sort((a, b) => (a.moduleId < b.moduleId ? -1 : 1))
      .map((m) => ({ moduleId: m.moduleId, stateVersion: m.stateVersion, state: jsonRoundTrip(m.save(), `State of "${m.moduleId}"`) }))
  };
}

/**
 * Validate everything first, then commit. If a module's load() still throws, every module is
 * restored to its pre-load state, so a failed load never leaves a half-loaded scenario.
 */
export function loadSave(envelope: unknown, expected: { readonly scenarioId: string; readonly stepSeconds: number }, modules: readonly PersistableModule[]): LoadOutcome {
  const errors: string[] = [];
  const e = envelope as Partial<SaveEnvelope> | null;
  if (typeof e !== "object" || e === null) return { ok: false, errors: ["Save is not an object."], rolledBack: false };
  if (e.formatVersion !== SAVE_FORMAT_VERSION) errors.push(`Unsupported save format version ${String(e.formatVersion)} (expected ${SAVE_FORMAT_VERSION}).`);
  if (e.scenarioId !== expected.scenarioId) errors.push(`Save is for scenario "${String(e.scenarioId)}", not "${expected.scenarioId}".`);
  if (e.stepSeconds !== expected.stepSeconds) errors.push(`Save uses step ${String(e.stepSeconds)} s, runtime uses ${expected.stepSeconds} s.`);
  if (!Number.isSafeInteger(e.tick) || (e.tick as number) < 0) errors.push("Save tick is not a non-negative integer.");
  if (!Array.isArray(e.modules)) errors.push("Save has no module list.");
  if (errors.length > 0) return { ok: false, errors, rolledBack: false };

  const saved = new Map((e.modules as SaveEnvelope["modules"]).map((m) => [m.moduleId, m]));
  const live = new Map(modules.map((m) => [m.moduleId, m]));
  for (const id of [...saved.keys()].sort()) if (!live.has(id)) errors.push(`Save contains state for unknown module "${id}".`);
  for (const m of [...modules].sort((a, b) => (a.moduleId < b.moduleId ? -1 : 1))) {
    const entry = saved.get(m.moduleId);
    if (!entry) {
      errors.push(`Save is missing state for module "${m.moduleId}".`);
      continue;
    }
    if (entry.stateVersion !== m.stateVersion) {
      errors.push(`Module "${m.moduleId}" state version ${entry.stateVersion} does not match runtime version ${m.stateVersion}; a migration is required.`);
      continue;
    }
    for (const problem of m.validate(entry.state)) errors.push(`${m.moduleId}: ${problem}`);
  }
  if (errors.length > 0) return { ok: false, errors, rolledBack: false };

  const before = modules.map((m) => ({ m, state: jsonRoundTrip(m.save(), `State of "${m.moduleId}"`) }));
  let attempted = 0;
  try {
    for (const m of modules) {
      attempted++;
      m.load(structuredClone((saved.get(m.moduleId) as SaveEnvelope["modules"][number]).state));
    }
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    // Restore every module that was touched, including the one that failed partway.
    const rollbackErrors: string[] = [];
    for (const { m, state } of before.slice(0, attempted)) {
      try {
        m.load(state);
      } catch (rollbackCause) {
        rollbackErrors.push(`${m.moduleId}: ${rollbackCause instanceof Error ? rollbackCause.message : String(rollbackCause)}`);
      }
    }
    if (rollbackErrors.length > 0) {
      return { ok: false, errors: [`Load failed: ${reason}`, ...rollbackErrors.map((e) => `Rollback failed for ${e}; runtime state is inconsistent.`)], rolledBack: false };
    }
    return { ok: false, errors: [`Load failed and was rolled back: ${reason}`], rolledBack: true };
  }
  return { ok: true, tick: e.tick as number };
}

export interface JournalEntry<TInput> {
  readonly tick: number;
  readonly input: TInput;
}

/** Ordered record of external inputs (player commands, network messages) keyed by the tick they apply to. */
export class InputJournal<TInput> {
  private readonly entries: JournalEntry<TInput>[] = [];

  public static fromJSON<T>(data: unknown): InputJournal<T> {
    if (!Array.isArray(data)) throw new Error("Journal data must be an array.");
    const journal = new InputJournal<T>();
    for (const item of data as JournalEntry<T>[]) journal.record(item.tick, item.input);
    return journal;
  }

  /** Append an input for a tick. Ticks must not go backwards. */
  public record(tick: number, input: TInput): void {
    if (!Number.isSafeInteger(tick) || tick < 0) throw new RangeError(`Journal tick must be a non-negative integer, got ${tick}.`);
    const last = this.entries[this.entries.length - 1];
    if (last && tick < last.tick) throw new RangeError(`Journal tick ${tick} is earlier than the last recorded tick ${last.tick}.`);
    this.entries.push({ tick, input: jsonRoundTrip(input, "Journal input") as TInput });
  }

  /** Inputs for one tick, in recording order. */
  public inputsAt(tick: number): readonly TInput[] {
    return this.entries.filter((e) => e.tick === tick).map((e) => e.input);
  }

  public get length(): number {
    return this.entries.length;
  }

  public toJSON(): readonly JournalEntry<TInput>[] {
    return this.entries.map((e) => ({ tick: e.tick, input: e.input }));
  }
}
