/**
 * Semi-active radar homing seeker (owner: sensors/weapon-seeker). One implementation for any SARH
 * seeker; behaviour comes from the profile. The chain each tick:
 *
 *   illumination  the launcher's radar lights the target only while it illuminates (duty cycle of its
 *                 illumination/track alternation) and only while it holds its own lock
 *   reference     a rear antenna receives the illuminator directly; without it there is no coherent
 *                 Doppler reference and nothing can be detected (rear-cone limit)
 *   antenna       front antenna pattern/gain from its aperture (shared aperture model), on a gimbal
 *                 with angle and rate limits; pointed by radio-correction data until it tracks
 *   receiver      bistatic radar equation from the physics layer; noise k·T·F over the Doppler filter
 *   velocity gate the receiver looks only inside a Doppler gate preset from launcher data, searching
 *                 around it; echoes outside the gate are not seen
 *   clutter       bistatic ground clutter (ground lit by the illuminator, received through the seeker
 *                 pattern) inside the gate competes with the target
 *   detection     Swerling fluctuation, threshold from Pfa; track needs consecutive hits
 *   angle track   monopulse error σ ∝ beamwidth/√(2·SNR); α–β line-of-sight filter; gimbal-rate loss
 *
 * It reads only SensorScene returns for its own beam. Output: line of sight and its rate for guidance.
 */
import type { Vector3 } from "../../core/coordinates/CoordinateFrames.js";
import { createScopedRandom, type SeededRandom } from "../../core/random/SeededRandom.js";
import { antennaPattern, type AntennaPattern, type ApertureSpec } from "../../physics/radar/Aperture.js";
import { bistaticDoppler, type ClutterPatch } from "../../physics/radar/RadarPhysics.js";
import type { SensorScene } from "../../physics/sensing/SensorScene.js";
import { add, angleBetween, cross, dot, norm, scale, sub, unit } from "../../physics/sensing/SweepGeometry.js";

export interface Sourced<T> { readonly value: T; readonly source: string; readonly status: "published" | "derived" | "estimated" }

export interface SarhSeekerProfile {
  readonly id: string;
  readonly designation: string;
  readonly aperture: Sourced<ApertureSpec>;
  readonly gimbal: Sourced<{ readonly maxRad: number; readonly rateRadS: number }>;
  readonly noiseFigureDb: Sourced<number>;
  readonly lossesDb: Sourced<number>;
  /** Coherent integration of one Doppler filter, s (filter bandwidth = 1/T). */
  readonly coherentS: Sourced<number>;
  readonly velocityGate: Sourced<{ readonly widthMps: number; readonly searchSpanMps: number; readonly searchRateMpsPerS: number }>;
  readonly falseAlarmProbability: Sourced<number>;
  /** Hits needed in a row to go from search to track. */
  readonly confirmHits: Sourced<number>;
  readonly memoryS: Sourced<number>;
  /** Half-angle of the rear reference antenna's cone, rad. */
  readonly rearConeRad: Sourced<number>;
  /** Monopulse slope factor k in σθ = θ3dB / (k·√(2·SNR)). */
  readonly monopulseK: Sourced<number>;
}

/** What the launcher's radar provides this tick. */
export interface Illumination {
  readonly positionEnuM: Vector3;
  readonly velocityEnuMps: Vector3;
  /** Average illumination power × transmit gain on the antenna boresight, W. */
  readonly erpW: number;
  /** Fraction of time spent illuminating (illumination/track alternation). */
  readonly duty: number;
  readonly boresight: Vector3;
  readonly pattern: AntennaPattern;
  readonly wavelengthM: number;
}

export type SeekerStatus = "off" | "search" | "track" | "memory";

export interface SeekerOutput {
  readonly status: SeekerStatus;
  readonly losEnu: Vector3 | null;
  readonly losRate: Vector3 | null;
  readonly snrDb: number;
  readonly reason: string;
}

export class SemiActiveSeeker {
  private rng: SeededRandom;
  private status: SeekerStatus = "off";
  private pointing: Vector3 | null = null;
  private los: Vector3 | null = null;
  private rate: Vector3 = [0, 0, 0];
  private gateHz = 0;
  private presetHz = 0;
  private searchPhase = 0;
  private hits = 0;
  private lastHitS = -Infinity;
  private t = 0;
  private snrDb = -99;
  private reason = "not illuminated";
  private clutter: { t: number; patches: readonly ClutterPatch[] } | null = null;
  private antenna: AntennaPattern | null = null;

  public constructor(public readonly profile: SarhSeekerProfile, seed: number) {
    this.rng = createScopedRandom(seed, "sarh", profile.id);
  }

  /** Before launch: the launcher sets the expected line of sight and Doppler (BP-29 / RLPK: data "put into its memory"). */
  public preset(losEnu: Vector3, dopplerHz: number): void {
    this.pointing = losEnu;
    this.presetHz = dopplerHz;
    this.gateHz = dopplerHz;
    this.status = "search";
  }

  public step(ctx: {
    readonly positionEnuM: Vector3; readonly velocityEnuMps: Vector3; readonly bodyAxis: Vector3; readonly scene: SensorScene;
    readonly illumination: Illumination | null;
    readonly cue: { readonly positionEnuM: Vector3; readonly velocityEnuMps: Vector3 } | null;
  }, dt: number): SeekerOutput {
    this.t += dt;
    const P = this.profile;
    const ill = ctx.illumination;
    if (!this.antenna && ill) this.antenna = antennaPattern(P.aperture.value, ill.wavelengthM);
    const out = (r: string): SeekerOutput => { this.reason = r; return { status: this.status, losEnu: this.status === "off" ? null : this.los, losRate: this.status === "track" || this.status === "memory" ? this.rate : null, snrDb: this.snrDb, reason: r }; };

    // Aim: tracked LOS, else radio-correction cue, else preset. Gimbal angle and rate limits.
    const cueDir = ctx.cue ? unit(sub(ctx.cue.positionEnuM, ctx.positionEnuM)) : this.pointing;
    const want = this.status === "track" || this.status === "memory" ? this.predictedLos(dt) : cueDir;
    if (want) {
      const cur = this.pointing ?? want;
      const ang = angleBetween(cur, want);
      const maxStep = P.gimbal.value.rateRadS * dt;
      this.pointing = ang <= maxStep ? want : unit(add(scale(cur, 1 - maxStep / ang), scale(want, maxStep / ang)));
      if (angleBetween(this.pointing, ctx.bodyAxis) > P.gimbal.value.maxRad) return this.lose(out, "gimbal limit");
    }
    if (ctx.cue && this.status === "search") {
      // Radio correction also re-centres the velocity gate on the latest predicted Doppler.
      this.presetHz = ill ? bistaticDoppler(ill.positionEnuM, ill.velocityEnuMps, ctx.positionEnuM, ctx.velocityEnuMps, ctx.cue.positionEnuM, ctx.cue.velocityEnuMps, ill.wavelengthM) : this.presetHz;
    }
    if (this.status === "off" && ill) this.status = "search";
    if (!ill || ill.erpW <= 0 || !this.pointing || !this.antenna) return this.coast(out, dt, "not illuminated");
    // Rear reference channel: the illuminator must be inside the rear antenna's cone.
    const toIll = unit(sub(ill.positionEnuM, ctx.positionEnuM));
    if (angleBetween(toIll, scale(ctx.bodyAxis, -1)) > P.rearConeRad.value) return this.coast(out, dt, "no reference");

    // Velocity gate: tracking keeps it on the target; searching sweeps it across the span around the preset.
    const lambda = ill.wavelengthM;
    const gateHalfHz = P.velocityGate.value.widthMps / lambda;
    // A hit stops the sweep: the gate dwells on the return while hits are confirmed.
    if (this.status === "search" && this.hits === 0) {
      const spanHz = (2 * P.velocityGate.value.searchSpanMps) / lambda;
      this.searchPhase = (this.searchPhase + (2 * P.velocityGate.value.searchRateMpsPerS * dt) / lambda) % (2 * spanHz);
      const tri = this.searchPhase < spanHz ? this.searchPhase : 2 * spanHz - this.searchPhase;
      this.gateHz = this.presetHz - spanHz / 2 + tri;
    }

    // Received echoes (bistatic physics), integrated over the illuminated part of the coherent interval.
    const Ts = 290 * 10 ** (P.noiseFigureDb.value / 10);
    const echoes = ctx.scene.radar({
      originEnuM: ctx.positionEnuM, ownVelocityEnuMps: ctx.velocityEnuMps, beamFrom: this.pointing, beamTo: this.pointing,
      look: { antenna: this.antenna, averagePowerW: 0, systemNoiseTempK: Ts, lossesDb: P.lossesDb.value },
      integrationTimeS: P.coherentS.value * ill.duty, reportFloorSnr: 0.1, maxRangeM: 100000,
      illuminator: { positionEnuM: ill.positionEnuM, erpW: ill.erpW, velocityEnuMps: ill.velocityEnuMps }
    });
    // Bistatic clutter in the gate (refreshed every 0.2 s).
    if (ctx.scene.bistaticClutter && (!this.clutter || this.t - this.clutter.t > 0.2)) {
      this.clutter = {
        t: this.t,
        patches: ctx.scene.bistaticClutter({
          receiverEnuM: ctx.positionEnuM, receiverVelocityEnuMps: ctx.velocityEnuMps, receiverBeam: this.pointing, receiverAntenna: this.antenna,
          receiverNoiseTempK: Ts, receiverLossesDb: P.lossesDb.value, illuminatorEnuM: ill.positionEnuM, illuminatorVelocityEnuMps: ill.velocityEnuMps,
          illuminatorErpW: ill.erpW, illuminatorBoresight: ill.boresight, illuminatorPattern: ill.pattern, integrationTimeS: P.coherentS.value * ill.duty, maxRangeM: 80000
        })
      };
    }
    const filterHz = 1 / P.coherentS.value;
    let cnrGate = 0;
    for (const c of this.clutter?.patches ?? []) if (Math.abs(c.relDopplerHz - this.gateHz) < Math.max(gateHalfHz, filterHz / 2)) cnrGate += c.cnr;
    // Clutter spreads over the gate's filters: each filter sees its share.
    cnrGate *= filterHz / Math.max(filterHz, 2 * gateHalfHz);

    const inGate = echoes.filter((e) => e.bistaticDopplerHz !== undefined && Math.abs(e.bistaticDopplerHz - this.gateHz) < gateHalfHz);
    const best = inGate.sort((a, b) => b.meanSnr - a.meanSnr)[0];
    const T = -Math.log(P.falseAlarmProbability.value);
    let detected = false;
    if (best) {
      const snr = best.meanSnr / (1 + cnrGate);
      this.snrDb = 10 * Math.log10(Math.max(1e-6, snr));
      const pd = Math.exp(-T / (1 + snr)); // Swerling 1
      if (this.rng.nextFloat() < pd) {
        detected = true;
        // Monopulse angle measurement.
        const bw = this.antenna.halfPowerBeamwidthRad;
        const sig = bw / (P.monopulseK.value * Math.sqrt(2 * Math.max(1, snr)));
        const g = () => Math.sqrt(-2 * Math.log(1 - this.rng.nextFloat() + 1e-12)) * Math.cos(2 * Math.PI * this.rng.nextFloat());
        const right = unit(cross(best.losEnu, [0, 0, 1]));
        const up = cross(right, best.losEnu);
        const meas = unit(add(best.losEnu, add(scale(right, g() * sig), scale(up, g() * sig))));
        this.update(meas, dt);
        if (this.status === "track") this.gateHz += 0.3 * ((best.bistaticDopplerHz as number) - this.gateHz);
        else this.gateHz = best.bistaticDopplerHz as number;
      }
    } else this.snrDb = -99;
    if (detected) {
      this.hits += 1;
      this.lastHitS = this.t;
      if (this.status === "search" && this.hits >= this.profile.confirmHits.value) this.status = "track";
      if (this.status === "memory") this.status = "track";
      if (norm(this.rate) > P.gimbal.value.rateRadS) return this.lose(out, "LOS rate beyond gimbal rate");
      return out("ok");
    }
    if (this.status === "search") this.hits = 0;
    return this.coast(out, dt, best ? (cnrGate > (best?.meanSnr ?? 0) ? "clutter" : "fade") : "no echo in gate");
  }

  private predictedLos(dt: number): Vector3 | null {
    return this.los ? unit(add(this.los, scale(this.rate, dt))) : null;
  }

  private update(meas: Vector3, dt: number): void {
    if (!this.los) { this.los = meas; this.rate = [0, 0, 0]; return; }
    const pred = unit(add(this.los, scale(this.rate, dt)));
    const r = sub(meas, pred);
    this.los = unit(add(pred, scale(r, 0.4)));
    this.rate = add(this.rate, scale(r, 0.08 / dt));
    this.rate = sub(this.rate, scale(this.los, dot(this.rate, this.los)));
  }

  private coast(out: (r: string) => SeekerOutput, dt: number, reason: string): SeekerOutput {
    if (this.status === "track" || this.status === "memory") {
      this.status = this.t - this.lastHitS > this.profile.memoryS.value ? "search" : "memory";
      if (this.status === "search") { this.hits = 0; this.gateHz = this.presetHz; }
      else if (this.los) this.los = unit(add(this.los, scale(this.rate, dt)));
    }
    return out(reason);
  }

  private lose(out: (r: string) => SeekerOutput, reason: string): SeekerOutput {
    this.status = "search";
    this.hits = 0;
    this.los = null;
    return out(reason);
  }
}
