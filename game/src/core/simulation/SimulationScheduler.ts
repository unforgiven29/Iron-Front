/**
 * Deterministic fixed-tick phase runner with multi-rate tasks and one-shot scheduled work.
 *
 * Owner: game/core/simulation. Browser frame time only requests advancement through
 * SimulationClock; every task sees fixed simulation time derived from the tick count.
 *
 * Ordering within a tick is fully determined by (phase, priority, id) for recurring
 * tasks and (phase, priority, sequence) for one-shot work, never by registration
 * order, wall-clock time or frame cadence.
 */
import { SimulationClock, type SimulationAdvance, type SimulationClockOptions } from "../time/SimulationClock.js";

/** Authoritative update phases, in execution order. */
export const SIMULATION_PHASES = [
  "commands",
  "lifecycle-resources",
  "environment",
  "controllers",
  "forces",
  "integration",
  "commit-events",
  "sensors",
  "decisions",
  "publish"
] as const;
export type SimulationPhase = (typeof SIMULATION_PHASES)[number];

const PHASE_INDEX: ReadonlyMap<string, number> = new Map(SIMULATION_PHASES.map((p, i) => [p, i]));

export interface TickContext {
  /** Tick being executed (first executed tick is 1 after a reset to 0). */
  readonly tick: number;
  readonly phase: SimulationPhase;
  /** Simulation time at the end of this tick: tick * stepSeconds. */
  readonly timeSeconds: number;
  readonly stepSeconds: number;
  /** Simulation time covered by this run of a recurring task (periodTicks * stepSeconds). */
  readonly elapsedSeconds: number;
  /**
   * Schedule one-shot work. It may target this tick only in a later phase than the
   * current one; otherwise any future tick. Returns a sequence id usable with cancel().
   */
  scheduleAt(request: ScheduledWorkRequest): number;
}

export interface ScheduledTask {
  readonly id: string;
  readonly phase: SimulationPhase;
  /** Lower runs first within a phase. Integer. Default 0. */
  readonly priority?: number;
  /** Run every N ticks. Positive integer. Default 1. */
  readonly periodTicks?: number;
  /** Run when tick % periodTicks === offsetTicks. Integer in [0, periodTicks). Default 0. */
  readonly offsetTicks?: number;
  run(context: TickContext): void;
}

export interface ScheduledWorkRequest {
  readonly tick: number;
  readonly phase: SimulationPhase;
  readonly priority?: number;
  /** Diagnostic label. */
  readonly label: string;
  run(context: TickContext): void;
}

export interface TaskFault {
  readonly tick: number;
  readonly phase: SimulationPhase;
  /** Task id, or "scheduled:<label>#<sequence>" for one-shot work. */
  readonly source: string;
  readonly message: string;
}

export interface SchedulerAdvance extends SimulationAdvance {
  readonly paused: boolean;
  /** Faults raised during the ticks executed by this advance. */
  readonly faults: readonly TaskFault[];
}

interface NormalizedTask {
  readonly id: string;
  readonly phase: SimulationPhase;
  readonly phaseIndex: number;
  readonly priority: number;
  readonly periodTicks: number;
  readonly offsetTicks: number;
  readonly run: (context: TickContext) => void;
}

interface PendingWork {
  readonly sequence: number;
  readonly tick: number;
  readonly phaseIndex: number;
  readonly priority: number;
  readonly label: string;
  readonly run: (context: TickContext) => void;
}

function requireInteger(value: number, name: string, min: number, max = Number.MAX_SAFE_INTEGER): void {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be an integer in [${min}, ${max}], got ${value}.`);
  }
}

function phaseIndexOf(phase: string): number {
  const index = PHASE_INDEX.get(phase);
  if (index === undefined) throw new RangeError(`Unknown simulation phase "${phase}".`);
  return index;
}

export class SimulationScheduler {
  private readonly clock: SimulationClock;
  private readonly tasks = new Map<string, NormalizedTask>();
  private orderedTasks: NormalizedTask[] = [];
  private pending: PendingWork[] = [];
  private readonly disabledTasks = new Set<string>();
  private nextSequence = 1;
  private executing: { tick: number; phaseIndex: number } | null = null;
  private paused = false;

  public constructor(clockOptions: SimulationClockOptions = {}) {
    this.clock = new SimulationClock(clockOptions);
  }

  public get currentTick(): number {
    return this.clock.currentTick;
  }

  public get stepSeconds(): number {
    return this.clock.stepSeconds;
  }

  public get isPaused(): boolean {
    return this.paused;
  }

  /** Task ids disabled after a fault, sorted. */
  public get faultedTaskIds(): readonly string[] {
    return [...this.disabledTasks].sort();
  }

  public register(task: ScheduledTask): void {
    this.assertNotExecuting("register a task");
    if (typeof task.id !== "string" || task.id.length === 0) throw new RangeError("Task id must be a non-empty string.");
    if (this.tasks.has(task.id)) throw new Error(`Task "${task.id}" is already registered.`);
    const phaseIndex = phaseIndexOf(task.phase);
    const priority = task.priority ?? 0;
    const periodTicks = task.periodTicks ?? 1;
    const offsetTicks = task.offsetTicks ?? 0;
    requireInteger(priority, "priority", Number.MIN_SAFE_INTEGER);
    requireInteger(periodTicks, "periodTicks", 1);
    requireInteger(offsetTicks, "offsetTicks", 0, periodTicks - 1);
    this.tasks.set(task.id, { id: task.id, phase: task.phase, phaseIndex, priority, periodTicks, offsetTicks, run: task.run.bind(task) });
    this.reorder();
  }

  public unregister(taskId: string): boolean {
    this.assertNotExecuting("unregister a task");
    this.disabledTasks.delete(taskId);
    const removed = this.tasks.delete(taskId);
    if (removed) this.reorder();
    return removed;
  }

  /** Schedule one-shot work from outside a tick (e.g. scenario setup). Must target a future tick. */
  public scheduleAt(request: ScheduledWorkRequest): number {
    return this.enqueue(request);
  }

  public cancel(sequence: number): boolean {
    const before = this.pending.length;
    this.pending = this.pending.filter((w) => w.sequence !== sequence);
    return this.pending.length !== before;
  }

  public pause(): void {
    this.paused = true;
  }

  public resume(): void {
    this.paused = false;
  }

  /** Request advancement by browser frame time. While paused no time accumulates. */
  public advanceFrame(frameDeltaSeconds: number): SchedulerAdvance {
    if (this.paused) {
      if (!Number.isFinite(frameDeltaSeconds) || frameDeltaSeconds < 0) {
        throw new RangeError("frameDeltaSeconds must be finite and non-negative.");
      }
      return {
        stepsExecuted: 0, currentTick: this.clock.currentTick, interpolationAlpha: 0,
        backlogSeconds: 0, droppedFrameSeconds: frameDeltaSeconds, overloaded: false, paused: true, faults: []
      };
    }
    const startTick = this.clock.currentTick;
    const advance = this.clock.advanceFrame(frameDeltaSeconds);
    const faults: TaskFault[] = [];
    for (let tick = startTick + 1; tick <= advance.currentTick; tick++) faults.push(...this.runTick(tick));
    return { ...advance, paused: false, faults };
  }

  /** Execute exactly one tick regardless of frame time (tests, replay, single-step debugging). */
  public step(): readonly TaskFault[] {
    this.assertNotExecuting("step");
    this.clock.reset(this.clock.currentTick + 1);
    return this.runTick(this.clock.currentTick);
  }

  /**
   * Set the tick when restoring a save. One-shot work holds closures that cannot be saved,
   * so a restore with pending one-shot work is refused rather than silently dropping it.
   */
  public restoreTick(tick: number): void {
    this.assertNotExecuting("restore the tick");
    if (this.pending.length > 0) {
      throw new Error(`Cannot restore while ${this.pending.length} one-shot work item(s) are pending; they are not serializable.`);
    }
    this.clock.reset(tick);
  }

  private runTick(tick: number): TaskFault[] {
    const faults: TaskFault[] = [];
    const stepSeconds = this.clock.stepSeconds;
    let taskIndex = 0;
    try {
      for (let phaseIndex = 0; phaseIndex < SIMULATION_PHASES.length; phaseIndex++) {
        const phase = SIMULATION_PHASES[phaseIndex] as SimulationPhase;
        this.executing = { tick, phaseIndex };

        // Merge recurring tasks and one-shot work for this phase by priority.
        // Recurring tasks run before one-shot work of equal priority; one-shot work keeps sequence order.
        const recurring: NormalizedTask[] = [];
        while (taskIndex < this.orderedTasks.length && (this.orderedTasks[taskIndex] as NormalizedTask).phaseIndex === phaseIndex) {
          const task = this.orderedTasks[taskIndex] as NormalizedTask;
          taskIndex++;
          if (!this.disabledTasks.has(task.id) && tick % task.periodTicks === task.offsetTicks) recurring.push(task);
        }
        let r = 0;
        for (;;) {
          const work = this.takeNextWork(tick, phaseIndex);
          const task = recurring[r];
          if (task && (!work || task.priority <= work.priority)) {
            if (work) this.pending.push(work); // put back; re-sorted by takeNextWork
            r++;
            this.invoke(task.id, phase, tick, task.periodTicks * stepSeconds, task.run, faults, () => {
              this.disabledTasks.add(task.id);
            });
          } else if (work) {
            this.invoke(`scheduled:${work.label}#${work.sequence}`, phase, tick, stepSeconds, work.run, faults, () => undefined);
          } else {
            break;
          }
        }
      }
    } finally {
      this.executing = null;
    }
    return faults;
  }

  private invoke(
    source: string, phase: SimulationPhase, tick: number, elapsedSeconds: number,
    run: (context: TickContext) => void, faults: TaskFault[], onFault: () => void
  ): void {
    const context: TickContext = {
      tick, phase, timeSeconds: tick * this.clock.stepSeconds, stepSeconds: this.clock.stepSeconds, elapsedSeconds,
      scheduleAt: (request) => this.enqueue(request)
    };
    try {
      run(context);
    } catch (cause) {
      onFault();
      faults.push({ tick, phase, source, message: cause instanceof Error ? cause.message : String(cause) });
    }
  }

  /** Removes and returns the earliest due one-shot work for this tick/phase, if any. */
  private takeNextWork(tick: number, phaseIndex: number): PendingWork | undefined {
    let best = -1;
    for (let i = 0; i < this.pending.length; i++) {
      const w = this.pending[i] as PendingWork;
      if (w.tick !== tick || w.phaseIndex !== phaseIndex) continue;
      const b = this.pending[best];
      if (!b || w.priority < b.priority || (w.priority === b.priority && w.sequence < b.sequence)) best = i;
    }
    if (best < 0) return undefined;
    return this.pending.splice(best, 1)[0];
  }

  private enqueue(request: ScheduledWorkRequest): number {
    const phaseIndex = phaseIndexOf(request.phase);
    const priority = request.priority ?? 0;
    requireInteger(request.tick, "tick", 0);
    requireInteger(priority, "priority", Number.MIN_SAFE_INTEGER);
    const now = this.executing;
    if (now) {
      const inPast = request.tick < now.tick || (request.tick === now.tick && phaseIndex <= now.phaseIndex);
      if (inPast) {
        throw new RangeError(
          `Cannot schedule "${request.label}" at tick ${request.tick} phase ${request.phase}: ` +
          `it must be after tick ${now.tick} phase ${SIMULATION_PHASES[now.phaseIndex]}.`
        );
      }
    } else if (request.tick <= this.clock.currentTick) {
      throw new RangeError(`Cannot schedule "${request.label}" at tick ${request.tick}: current tick is ${this.clock.currentTick}.`);
    }
    const sequence = this.nextSequence++;
    this.pending.push({ sequence, tick: request.tick, phaseIndex, priority, label: request.label, run: request.run });
    return sequence;
  }

  private reorder(): void {
    this.orderedTasks = [...this.tasks.values()].sort((a, b) =>
      a.phaseIndex - b.phaseIndex || a.priority - b.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    );
  }

  private assertNotExecuting(action: string): void {
    if (this.executing) throw new Error(`Cannot ${action} while a tick is executing.`);
  }
}
