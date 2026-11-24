/**
 * First-order, rate- and position-limited control-surface actuator. Shared by all aircraft;
 * each package supplies its own limits, rates and bandwidth. The surface never jumps to the
 * command: it moves at most `rate · dt` per step toward it.
 */
export class SurfaceActuator {
  private position = 0;

  public constructor(private readonly limitDeg: number, private readonly rateDegS: number, private readonly bandwidthRadS: number) {}

  public get positionDeg(): number {
    return this.position;
  }

  public reset(positionDeg = 0): void {
    this.position = Math.max(-this.limitDeg, Math.min(this.limitDeg, positionDeg));
  }

  public step(commandDeg: number, dt: number): number {
    const target = Math.max(-this.limitDeg, Math.min(this.limitDeg, commandDeg));
    const rate = Math.max(-this.rateDegS, Math.min(this.rateDegS, (target - this.position) * this.bandwidthRadS));
    const next = this.position + rate * dt;
    this.position = (target - this.position) * (target - next) <= 0 || Math.abs(target - next) < 1e-6 ? target : next;
    return this.position;
  }
}
