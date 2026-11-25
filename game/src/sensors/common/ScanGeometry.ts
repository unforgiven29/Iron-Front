/**
 * Shared scanning-sensor geometry (owner: sensors/common): reference frames for antennas and
 * optical heads, gimbal limits, and a raster scan engine that moves a beam or detector field
 * bar by bar. Used by the radar and IRST equipment; platform-neutral, all limits come from the
 * equipment profile.
 */
import type { Quaternion, Vector3 } from "../../core/coordinates/CoordinateFrames.js";
import { rotateVector } from "../../physics/rigidbody/RigidBody.js";

export const DEG = Math.PI / 180;

/** Look direction as azimuth (right +) and elevation (up +), rad. */
export interface LookAngles { readonly az: number; readonly el: number }

/**
 * Frames a scan can be defined in:
 *  - "stabilized": azimuth from the aircraft's heading in the horizontal plane, elevation from the horizon
 *    (roll and pitch removed, within the stabilisation limits);
 *  - "body": azimuth/elevation relative to the aircraft's longitudinal axis.
 */
export type ScanFrame = "stabilized" | "body";

export interface OwnAttitude {
  readonly bodyToWorld: Quaternion;
  readonly headingRad: number;
  readonly pitchRad: number;
  readonly rollRad: number;
}

const conj = (q: Quaternion): Quaternion => [-q[0], -q[1], -q[2], q[3]];

export function toBody(att: OwnAttitude, v: Vector3): Vector3 { return rotateVector(conj(att.bodyToWorld), v); }

export function bodyAngles(att: OwnAttitude, worldDir: Vector3): LookAngles {
  const b = toBody(att, worldDir);
  return { az: Math.atan2(b[1], b[0]), el: Math.atan2(-b[2], Math.hypot(b[0], b[1])) };
}

export function stabilizedAngles(att: OwnAttitude, worldDir: Vector3): LookAngles {
  const az = Math.atan2(worldDir[0], worldDir[1]) - att.headingRad;
  return { az: Math.atan2(Math.sin(az), Math.cos(az)), el: Math.atan2(worldDir[2], Math.hypot(worldDir[0], worldDir[1])) };
}

export function anglesIn(frame: ScanFrame, att: OwnAttitude, worldDir: Vector3): LookAngles {
  return frame === "body" ? bodyAngles(att, worldDir) : stabilizedAngles(att, worldDir);
}

export function worldDirection(frame: ScanFrame, att: OwnAttitude, a: LookAngles): Vector3 {
  const ce = Math.cos(a.el), se = Math.sin(a.el);
  if (frame === "body") {
    const b: Vector3 = [ce * Math.cos(a.az), ce * Math.sin(a.az), -se];
    return rotateVector(att.bodyToWorld, b);
  }
  const h = att.headingRad + a.az;
  return [ce * Math.sin(h), ce * Math.cos(h), se];
}

export interface GimbalLimits {
  readonly azMaxRad: number;
  readonly elMinRad: number;
  readonly elMaxRad: number;
}

export function withinGimbal(g: GimbalLimits, a: LookAngles): boolean {
  return Math.abs(a.az) <= g.azMaxRad && a.el >= g.elMinRad && a.el <= g.elMaxRad;
}

/** Clip a body-frame look to the gimbal limits. */
export function clipToGimbal(g: GimbalLimits, a: LookAngles): LookAngles {
  return { az: Math.max(-g.azMaxRad, Math.min(g.azMaxRad, a.az)), el: Math.max(g.elMinRad, Math.min(g.elMaxRad, a.el)) };
}

/** A raster pattern: bars across `widthRad`, `bars` of them spaced `barSpacingRad`, centred on `center`. */
export interface RasterPattern {
  readonly frame: ScanFrame;
  readonly center: LookAngles;
  /** Extent along the scan direction, rad. */
  readonly widthRad: number;
  readonly bars: number;
  readonly barSpacingRad: number;
  /** "horizontal": bars sweep in azimuth, stepped in elevation; "vertical": sweep in elevation, stepped in azimuth. */
  readonly orientation: "horizontal" | "vertical";
}

/** Raster scan state machine: sweeps at a constant rate, reverses at the edges and steps bars. */
export class RasterScan {
  private along = 0;
  private dir = 1;
  private bar = 0;
  private turnaround = 0;
  private frames = 0;

  public constructor(private readonly rateRadS: number, private readonly turnaroundS: number) {}

  public reset(): void { this.along = 0; this.dir = 1; this.bar = 0; this.turnaround = 0; this.frames = 0; }

  /** Completed frames since reset (a frame = all bars once). */
  public get frameCount(): number { return this.frames; }
  public get barIndex(): number { return this.bar; }

  /** Current look in the pattern's frame. */
  public look(p: RasterPattern): LookAngles {
    const bars = Math.max(1, p.bars);
    const half = p.widthRad / 2;
    const a = Math.max(-half, Math.min(half, this.along));
    const cross = (this.bar - (bars - 1) / 2) * p.barSpacingRad;
    // Top bar first for horizontal rasters.
    return p.orientation === "horizontal" ? { az: p.center.az + a, el: p.center.el - cross } : { az: p.center.az + cross, el: p.center.el + a };
  }

  /** Advance the beam by dt along the pattern. */
  public advance(p: RasterPattern, dt: number): void {
    const half = p.widthRad / 2;
    const bars = Math.max(1, p.bars);
    if (this.bar >= bars) this.bar = 0;
    let t = dt;
    while (t > 1e-9) {
      if (this.turnaround > 0) {
        const used = Math.min(t, this.turnaround);
        this.turnaround -= used;
        t -= used;
        continue;
      }
      const edge = this.dir > 0 ? half : -half;
      const remaining = Math.abs(edge - this.along);
      const move = this.rateRadS * t;
      if (move < remaining) { this.along += this.dir * move; t = 0; break; }
      this.along = edge;
      t -= remaining / this.rateRadS;
      this.dir = -this.dir;
      this.bar += 1;
      if (this.bar >= bars) { this.bar = 0; this.frames += 1; }
      this.turnaround = this.turnaroundS;
    }
  }

  /** True while the beam is reversing (it does not sweep then). */
  public get turning(): boolean { return this.turnaround > 0; }
}

/** Move a look toward a target look at a maximum angular rate. */
export function slew(from: LookAngles, to: LookAngles, rateRadS: number, dt: number): LookAngles {
  const da = to.az - from.az, de = to.el - from.el;
  const d = Math.hypot(da, de);
  const m = rateRadS * dt;
  if (d <= m || d === 0) return to;
  return { az: from.az + (da / d) * m, el: from.el + (de / d) * m };
}

/** What an onboard sensor knows about its own platform each tick (from the navigation system). */
export interface SensorOwnship extends OwnAttitude {
  readonly timeS: number;
  readonly positionEnuM: Vector3;
  readonly velocityEnuMps: Vector3;
}
