/**
 * First-order, rate- and position-limited control-surface actuator. Shared by all aircraft;
 * each package supplies its own limits, rates and bandwidth. The surface never jumps to the
 * command: it moves at most `rate · rateFraction · dt` per step toward it, where the hydraulic
 * network supplies `rateFraction` (1 = full power; 0 = no power, the surface holds).
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

  public step(commandDeg: number, dt: number, rateFraction = 1): number {
    const target = Math.max(-this.limitDeg, Math.min(this.limitDeg, commandDeg));
    const maxRate = this.rateDegS * Math.max(0, Math.min(1, rateFraction));
    const rate = Math.max(-maxRate, Math.min(maxRate, (target - this.position) * this.bandwidthRadS));
    const next = this.position + rate * dt;
    this.position = (target - this.position) * (target - next) <= 0 || Math.abs(target - next) < 1e-6 ? target : next;
    return this.position;
  }
}
