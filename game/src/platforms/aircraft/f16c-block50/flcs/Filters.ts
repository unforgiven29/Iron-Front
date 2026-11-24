/**
 * Discrete linear filters for the F-16 control laws (fixed step, deterministic).
 * First-order sections use exact zero-order-hold discretisation; the second-order roll filter
 * uses the bilinear (Tustin) transform, which stays stable for any step size.
 */

/** a/(s+a). */
export class Lag {
  private y = Number.NaN;
  public constructor(private readonly a: number) {}
  public reset(): void { this.y = Number.NaN; }
  public step(u: number, dt: number): number {
    if (Number.isNaN(this.y)) this.y = u;
    this.y += (u - this.y) * (1 - Math.exp(-this.a * dt));
    return this.y;
  }
}

/** k·s/(s+a) (washout). Starts at zero output. */
export class Washout {
  private readonly lag: Lag;
  public constructor(private readonly k: number, a: number) { this.lag = new Lag(a); }
  public reset(): void { this.lag.reset(); }
  public step(u: number, dt: number): number { return this.k * (u - this.lag.step(u, dt)); }
}

/** (b1·s + b0)/(s + a) (lead–lag). Starts in steady state. */
export class LeadLag {
  private x = Number.NaN;
  public constructor(private readonly b1: number, private readonly b0: number, private readonly a: number) {}
  public reset(): void { this.x = Number.NaN; }
  public step(u: number, dt: number): number {
    const c = this.b0 - this.b1 * this.a;
    if (Number.isNaN(this.x)) this.x = (c / this.a) * u;
    const e = Math.exp(-this.a * dt);
    this.x = this.x * e + (c / this.a) * (1 - e) * u;
    return this.b1 * u + this.x;
  }
}

/** (n2·s² + n1·s + n0)/(s² + d1·s + d0) by the Tustin transform. Starts in steady state. */
export class Biquad {
  private x1 = Number.NaN; private x2 = 0; private y1 = 0; private y2 = 0;
  private cached = Number.NaN; private k: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  public constructor(private readonly n: readonly [number, number, number], private readonly d: readonly [number, number]) {}
  public reset(): void { this.x1 = Number.NaN; }
  public step(u: number, dt: number): number {
    if (dt !== this.cached) {
      const K = 2 / dt, K2 = K * K;
      const [n2, n1, n0] = this.n, [d1, d0] = this.d;
      const a0 = K2 + d1 * K + d0;
      this.k = [(n2 * K2 + n1 * K + n0) / a0, (2 * n0 - 2 * n2 * K2) / a0, (n2 * K2 - n1 * K + n0) / a0, (2 * d0 - 2 * K2) / a0, (K2 - d1 * K + d0) / a0];
      this.cached = dt;
    }
    if (Number.isNaN(this.x1)) { const dc = this.n[2] / this.d[1] /* n0/d0 */; this.x1 = u; this.x2 = u; this.y1 = dc * u; this.y2 = dc * u; }
    const [b0, b1, b2, a1, a2] = this.k;
    const y = b0 * u + b1 * this.x1 + b2 * this.x2 - a1 * this.y1 - a2 * this.y2;
    this.x2 = this.x1; this.x1 = u; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

/** Piecewise-linear schedule, held at the ends. */
export function schedule(points: readonly (readonly [number, number])[], x: number): number {
  const first = points[0] as readonly [number, number], last = points[points.length - 1] as readonly [number, number];
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as readonly [number, number], b = points[i] as readonly [number, number];
    if (x <= b[0]) return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
  }
  return last[1];
}
