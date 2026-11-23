/**
 * Developer diagnostics: bounded, structured fault and trace records.
 *
 * Owner: game/core/diagnostics. This is an inspection tool, not a truth source or gameplay API:
 * it is never connected to the message bus, so sensors, AI and cockpit code cannot subscribe to it.
 * Recording never feeds back into simulation state.
 */

export type DiagnosticSeverity = "info" | "warning" | "error" | "critical";
export type RecoveryStatus = "active" | "recovered" | "unrecoverable" | "unknown";

export interface DiagnosticRecord {
  /** Monotonic within this log; survives buffer eviction so gaps are visible. */
  readonly sequence: number;
  /** Stable machine-readable code, e.g. "RESOURCE_DENIED", "TASK_FAULT". */
  readonly code: string;
  readonly severity: DiagnosticSeverity;
  readonly ownerModuleId: string;
  readonly tick: number;
  readonly message: string;
  /** Established cause, or "unknown". Never a guess. */
  readonly cause: string;
  readonly recovery: RecoveryStatus;
  readonly entityId?: string;
  readonly capabilityId?: string;
  readonly correlationId?: string;
}

export type DiagnosticInput = Omit<DiagnosticRecord, "sequence" | "cause" | "recovery"> & {
  readonly cause?: string;
  readonly recovery?: RecoveryStatus;
};

export interface DiagnosticQuery {
  readonly code?: string;
  readonly entityId?: string;
  readonly correlationId?: string;
  readonly minimumSeverity?: DiagnosticSeverity;
  readonly sinceTick?: number;
}

const SEVERITY_RANK: Readonly<Record<DiagnosticSeverity, number>> = { info: 0, warning: 1, error: 2, critical: 3 };

export class DiagnosticsLog {
  private readonly buffer: DiagnosticRecord[] = [];
  private nextSequence = 1;
  private evictedCount = 0;

  public constructor(public readonly capacity = 1000) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw new RangeError("capacity must be a positive integer.");
  }

  /** Number of records dropped because the buffer was full. */
  public get evicted(): number {
    return this.evictedCount;
  }

  public record(input: DiagnosticInput): DiagnosticRecord {
    if (!/^[A-Z][A-Z0-9_]*$/.test(input.code)) throw new RangeError(`Diagnostic code "${input.code}" must be UPPER_SNAKE_CASE.`);
    if (!Number.isSafeInteger(input.tick) || input.tick < 0) throw new RangeError(`Diagnostic tick must be a non-negative integer.`);
    const record: DiagnosticRecord = Object.freeze({
      ...input,
      sequence: this.nextSequence++,
      cause: input.cause?.trim() ? input.cause : "unknown",
      recovery: input.recovery ?? "unknown"
    });
    this.buffer.push(record);
    if (this.buffer.length > this.capacity) {
      this.buffer.shift();
      this.evictedCount++;
    }
    return record;
  }

  /** Records matching every given filter, oldest first. */
  public query(filter: DiagnosticQuery = {}): readonly DiagnosticRecord[] {
    const min = filter.minimumSeverity ? SEVERITY_RANK[filter.minimumSeverity] : 0;
    return this.buffer.filter((r) =>
      (filter.code === undefined || r.code === filter.code) &&
      (filter.entityId === undefined || r.entityId === filter.entityId) &&
      (filter.correlationId === undefined || r.correlationId === filter.correlationId) &&
      (filter.sinceTick === undefined || r.tick >= filter.sinceTick) &&
      SEVERITY_RANK[r.severity] >= min);
  }

  public clear(): void {
    this.buffer.length = 0;
  }
}
