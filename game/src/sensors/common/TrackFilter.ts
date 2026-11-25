/**
 * Shared target-state filter (owner: sensors/common): an alpha–beta filter on position and
 * velocity in world ENU, fed by noisy measurements. Radar TWS/STT and IRST tracking use it; it
 * knows nothing about targets beyond the measurements it is given.
 */
import type { Vector3 } from "../../core/coordinates/CoordinateFrames.js";

export class AlphaBetaTrack {
  private p: [number, number, number];
  private v: [number, number, number] = [0, 0, 0];
  private updates = 0;

  public constructor(position: Vector3, public lastUpdateS: number, velocity?: Vector3) {
    this.p = [...position];
    if (velocity) { this.v = [...velocity]; this.updates = 2; }
  }

  public get position(): Vector3 { return this.p; }
  public get velocity(): Vector3 { return this.v; }
  public get updateCount(): number { return this.updates; }

  /** Predicted position at time t (constant velocity). */
  public predict(t: number): Vector3 {
    const dt = t - this.lastUpdateS;
    return [this.p[0] + this.v[0] * dt, this.p[1] + this.v[1] * dt, this.p[2] + this.v[2] * dt];
  }

  /**
   * Fold in a measured position at time t. Gains start high (fast initiation) and settle to the
   * steady values; `alpha`/`beta` are the steady gains.
   */
  public update(t: number, measured: Vector3, alpha: number, beta: number, startup = true): void {
    const dt = Math.max(1e-3, t - this.lastUpdateS);
    const pred = this.predict(t);
    const n = this.updates;
    // Least-squares start-up gains for the k-th measurement (k = n + 1): α_k = 2(2k−1)/(k(k+1)), β_k = 6/(k(k+1)),
    // i.e. the 1st sets the position, the 2nd the velocity from two points (α = β = 1).
    const k = n + 1;
    if (!startup && n > 0) { this.blend(t, measured, alpha, beta); return; }
    const a = n === 0 ? 1 : Math.max(alpha, (2 * (2 * k - 1)) / (k * (k + 1)));
    const b = n === 0 ? 0 : Math.max(beta, 6 / (k * (k + 1)));
    for (let i = 0; i < 3; i++) {
      const r = (measured[i] as number) - (pred[i] as number);
      this.p[i] = (pred[i] as number) + a * r;
      this.v[i] = (this.v[i] as number) + (b * r) / dt;
    }
    this.lastUpdateS = t;
    this.updates += 1;
  }

  /** Fixed-gain update (no start-up gains): for fast-rate trackers whose velocity comes from elsewhere. */
  private blend(t: number, measured: Vector3, alpha: number, beta: number): void {
    const dt = Math.max(1e-3, t - this.lastUpdateS);
    const pred = this.predict(t);
    for (let i = 0; i < 3; i++) {
      const r = (measured[i] as number) - (pred[i] as number);
      this.p[i] = (pred[i] as number) + alpha * r;
      this.v[i] = (this.v[i] as number) + (beta * r) / dt;
    }
    this.lastUpdateS = t;
    this.updates += 1;
  }

  /**
   * Replace the velocity component along a unit line of sight with a directly measured value
   * (e.g. from a Doppler speed channel), keeping the cross-line components.
   */
  public setLineOfSightVelocity(losUnit: Vector3, speedAlongLos: number): void {
    const along = this.v[0] * losUnit[0] + this.v[1] * losUnit[1] + this.v[2] * losUnit[2];
    for (let i = 0; i < 3; i++) this.v[i] = (this.v[i] as number) + (speedAlongLos - along) * (losUnit[i] as number);
  }

  /** Coast: move the estimate forward without a measurement. */
  public coast(t: number): void {
    this.p = [...this.predict(t)] as [number, number, number];
    this.lastUpdateS = t;
  }
}
