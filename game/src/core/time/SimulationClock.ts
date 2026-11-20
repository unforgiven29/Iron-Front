export interface SimulationClockOptions {
  readonly stepSeconds?: number;
  readonly maxFrameDeltaSeconds?: number;
  readonly maxStepsPerFrame?: number;
}

export interface SimulationAdvance {
  readonly stepsExecuted: number;
  readonly currentTick: number;
  readonly interpolationAlpha: number;
  readonly backlogSeconds: number;
  readonly droppedFrameSeconds: number;
  readonly overloaded: boolean;
}

/** Fixed-step accumulator. A catch-up cap preserves backlog for later frames. */
export class SimulationClock {
  public readonly stepSeconds: number;
  public readonly maxFrameDeltaSeconds: number;
  public readonly maxStepsPerFrame: number;

  private accumulatorSeconds = 0;
  private tick = 0;

  public constructor(options: SimulationClockOptions = {}) {
    this.stepSeconds = options.stepSeconds ?? 1 / 120;
    this.maxFrameDeltaSeconds = options.maxFrameDeltaSeconds ?? 0.25;
    this.maxStepsPerFrame = options.maxStepsPerFrame ?? 8;

    if (!Number.isFinite(this.stepSeconds) || this.stepSeconds <= 0) {
      throw new RangeError("stepSeconds must be finite and greater than zero.");
    }
    if (!Number.isFinite(this.maxFrameDeltaSeconds) || this.maxFrameDeltaSeconds <= 0) {
      throw new RangeError("maxFrameDeltaSeconds must be finite and greater than zero.");
    }
    if (!Number.isInteger(this.maxStepsPerFrame) || this.maxStepsPerFrame < 1) {
      throw new RangeError("maxStepsPerFrame must be a positive integer.");
    }
  }

  public get currentTick(): number {
    return this.tick;
  }

  public get simulationTimeSeconds(): number {
    return this.tick * this.stepSeconds;
  }

  public advanceFrame(frameDeltaSeconds: number): SimulationAdvance {
    if (!Number.isFinite(frameDeltaSeconds) || frameDeltaSeconds < 0) {
      throw new RangeError("frameDeltaSeconds must be finite and non-negative.");
    }

    const acceptedDelta = Math.min(frameDeltaSeconds, this.maxFrameDeltaSeconds);
    const droppedFrameSeconds = frameDeltaSeconds - acceptedDelta;
    this.accumulatorSeconds += acceptedDelta;

    let stepsExecuted = 0;
    while (
      this.accumulatorSeconds + Number.EPSILON >= this.stepSeconds &&
      stepsExecuted < this.maxStepsPerFrame
    ) {
      this.accumulatorSeconds -= this.stepSeconds;
      if (this.accumulatorSeconds < 0 && this.accumulatorSeconds > -1e-12) {
        this.accumulatorSeconds = 0;
      }
      this.tick += 1;
      stepsExecuted += 1;
    }

    const overloaded = this.accumulatorSeconds + Number.EPSILON >= this.stepSeconds;
    const interpolationAlpha = overloaded
      ? 0
      : Math.max(0, Math.min(1, this.accumulatorSeconds / this.stepSeconds));

    return {
      stepsExecuted,
      currentTick: this.tick,
      interpolationAlpha,
      backlogSeconds: this.accumulatorSeconds,
      droppedFrameSeconds,
      overloaded
    };
  }

  public reset(tick = 0): void {
    if (!Number.isSafeInteger(tick) || tick < 0) {
      throw new RangeError("tick must be a non-negative safe integer.");
    }
    this.tick = tick;
    this.accumulatorSeconds = 0;
  }
}
