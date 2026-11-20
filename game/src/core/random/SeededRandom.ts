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

/**
 * Derives a stable 32-bit seed from a scenario seed and stable scope identifiers.
 * Scope strings should identify an entity and subsystem, not creation order.
 * This is deterministic hashing, not cryptographic key derivation; collisions are possible.
 */
export function deriveSeed(rootSeed: number, ...scope: readonly string[]): number {
  if (!Number.isInteger(rootSeed) || rootSeed < 0 || rootSeed > 0xffffffff) {
    throw new RangeError("rootSeed must be an unsigned 32-bit integer.");
  }
  if (scope.length === 0 || scope.some((part) => part.length === 0)) {
    throw new RangeError("At least one non-empty stable scope identifier is required.");
  }
  let hash = 0x811c9dc5;
  const prime = 0x01000193;
  for (let shift = 0; shift < 32; shift += 8) {
    hash = Math.imul(hash ^ ((rootSeed >>> shift) & 0xff), prime);
  }
  for (const part of scope) {
    hash = Math.imul(hash ^ 0xff, prime);
    for (let index = 0; index < part.length; index += 1) {
      const code = part.charCodeAt(index);
      hash = Math.imul(hash ^ (code & 0xff), prime);
      hash = Math.imul(hash ^ (code >>> 8), prime);
    }
    hash = Math.imul(hash, prime);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  const result = hash >>> 0;
  return result === 0 ? 0x6d2b79f5 : result;
}

/** Creates an independent deterministic stream for a stable entity/subsystem scope. */
export function createScopedRandom(rootSeed: number, ...scope: readonly string[]): SeededRandom {
  return new SeededRandom(deriveSeed(rootSeed, ...scope));
}
