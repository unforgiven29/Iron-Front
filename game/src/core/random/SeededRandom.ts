/** Deterministic PRNG for simulation-owned randomness; not cryptographically secure. */
export class SeededRandom {
  private state: number;

  public constructor(seed: number) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
      throw new RangeError("seed must be an unsigned 32-bit integer.");
    }
    this.state = seed >>> 0;
    if (this.state === 0) this.state = 0x6d2b79f5;
  }

  public nextUint32(): number {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    return this.state;
  }

  /** Returns a deterministic value in [0, 1). */
  public nextFloat(): number {
    return this.nextUint32() / 0x1_0000_0000;
  }

  public nextRange(minimum: number, maximum: number): number {
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || maximum < minimum) {
      throw new RangeError("Range bounds must be finite and maximum must be >= minimum.");
    }
    return minimum + (maximum - minimum) * this.nextFloat();
  }

  public snapshot(): number {
    return this.state;
  }

  public restore(state: number): void {
    if (!Number.isInteger(state) || state <= 0 || state > 0xffffffff) {
      throw new RangeError("state must be a non-zero unsigned 32-bit integer.");
    }
    this.state = state >>> 0;
  }
}
