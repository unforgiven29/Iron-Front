/**
 * Low-fidelity missile flyout for NOTIONAL weapons (owner: game/world).
 *
 * Point mass with a speed-only motor/drag model, proportional navigation limited by a g cap and a
 * proximity fuze with Pk = exp(−(d / lethal radius)²). This is a deliberately simple placeholder:
 * the terminal "seeker" picks an opposing-side aircraft inside its field of regard from world state
 * instead of running a sensor model. It exists for gameplay until the F-16 weapons are reworked onto
 * the 6-DoF Missile runtime; do not build on it as a seeker or guidance model.
 */
import type { Vector3 } from "../../core/coordinates/CoordinateFrames.js";
import { createScopedRandom } from "../../core/random/SeededRandom.js";
import { standardAtmosphere } from "../../physics/environment/Atmosphere.js";
import type { NotionalMissileSpec } from "../../weapons/catalog/NotionalAirToAir.js";
import type { RfEmitter } from "../../physics/radar/RfEmission.js";
import type { Decoy } from "./Countermeasures.js";

/**
 * Chance that a fresh decoy inside the seeker's track gate pulls the seeker off its target
 * (NOTIONAL gameplay values; one roll per decoy per missile).
 */
export const DECOY_SEDUCTION = Object.freeze({ flare: 0.3, chaff: 0.25, gateRad: 8 * Math.PI / 180, freshS: 2 });

export type Side = "blue" | "red";

export interface CombatTarget {
  readonly id: string;
  readonly side: Side;
  readonly positionEnuM: Vector3;
  readonly velocityEnuMps: Vector3;
}

/** The launcher's estimate of where the target is (radar lock / datalink); null when it has none. */
export type LauncherCue = () => { readonly positionEnuM: Vector3; readonly velocityEnuMps: Vector3 } | null;

export interface NotionalMissileState {
  readonly id: string;
  readonly spec: NotionalMissileSpec;
  readonly side: Side;
  readonly shooterId: string;
  readonly positionEnuM: Vector3;
  readonly velocityEnuMps: Vector3;
  readonly timeS: number;
  readonly burning: boolean;
  /** Id of the aircraft the seeker is homing on, or null (midcourse / lost). */
  readonly seekerTargetId: string | null;
}

export interface NotionalWeaponEvent { readonly timeS: number; readonly missileId: string; readonly kind: "launch" | "kill" | "miss" | "lost" | "decoyed"; readonly targetId?: string; readonly detail: string }

const G = 9.80665;
const len = (v: Vector3) => Math.hypot(v[0], v[1], v[2]);
const sub = (a: Vector3, b: Vector3): Vector3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vector3, b: Vector3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vector3, b: Vector3): Vector3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scale = (a: Vector3, k: number): Vector3 => [a[0] * k, a[1] * k, a[2] * k];

/** Closest approach between two relative positions sampled one step apart (no tunnelling). */
function closest(r0: Vector3, r1: Vector3): number {
  const d = sub(r1, r0), dd = dot(d, d);
  if (dd < 1e-9) return len(r1);
  const t = Math.max(0, Math.min(1, -dot(r0, d) / dd));
  return len([r0[0] + d[0] * t, r0[1] + d[1] * t, r0[2] + d[2] * t]);
}

class NotionalMissile {
  public pos: [number, number, number];
  public vel: [number, number, number];
  public t = 0;
  public alive = true;
  public seekerId: string | null = null;
  /** Decoys this seeker has already been tested against. */
  public readonly rolledDecoys = new Set<string>();
  public prevRel = new Map<string, Vector3>();
  public lastCue: { positionEnuM: Vector3; velocityEnuMps: Vector3 } | null = null;
  /** Active seeker transmitting (terminal phase of a radar missile). */
  public active = false;
  public seekerStart: Vector3 = [0, 1, 0];
  public seekerEnd: Vector3 = [0, 1, 0];

  public constructor(public readonly id: string, public readonly spec: NotionalMissileSpec, public readonly side: Side, public readonly shooterId: string,
    position: Vector3, velocity: Vector3, public readonly cue: LauncherCue, public readonly intendedId: string | null) {
    this.pos = [...position];
    this.vel = [...velocity];
  }
}

export class NotionalMissileWorld {
  private missiles: NotionalMissile[] = [];
  private log: NotionalWeaponEvent[] = [];
  private n = 0;
  private time = 0;
  private rng = createScopedRandom(91, "notional-missiles");

  /**
   * @param targets every aircraft that can be hit (both sides)
   * @param onKill  called when a warhead destroys an aircraft
   */
  public constructor(private readonly targets: () => readonly CombatTarget[], private readonly onKill: (targetId: string, missile: NotionalMissileState) => void,
    private readonly groundHeightAt: (x: number, y: number) => number = () => 0,
    private readonly decoys: () => readonly Decoy[] = () => []) {}

  public reset(): void { this.missiles = []; this.log = []; this.time = 0; this.rng = createScopedRandom(91, "notional-missiles"); }

  public launch(spec: NotionalMissileSpec, side: Side, shooterId: string, positionEnuM: Vector3, velocityEnuMps: Vector3, cue: LauncherCue, intendedTargetId: string | null = null): string {
    const id = `${spec.id}-${side}-${++this.n}`;
    this.missiles.push(new NotionalMissile(id, spec, side, shooterId, positionEnuM, velocityEnuMps, cue, intendedTargetId));
    this.log.push({ timeS: this.time, missileId: id, kind: "launch", ...(intendedTargetId ? { targetId: intendedTargetId } : {}), detail: spec.display });
    return id;
  }

  private seek(m: NotionalMissile, list: readonly CombatTarget[]): CombatTarget | null {
    const spd = len(m.vel) || 1;
    const fwd = scale(m.vel, 1 / spd);
    const inFov = (t: CombatTarget) => {
      const r = sub(t.positionEnuM, m.pos), d = len(r);
      return d < m.spec.seekerRangeM && dot(r, fwd) / (d || 1) > Math.cos(m.spec.seekerHalfAngleRad);
    };
    const wanted = m.spec.guidance === "ir" ? "flare" : "chaff";
    const decoys = this.decoys().filter((d) => d.kind === wanted && d.side !== m.side);
    if (m.seekerId) {
      const dec = decoys.find((d) => d.id === m.seekerId);
      if (dec) {
        const t: CombatTarget = { id: dec.id, side: dec.side, positionEnuM: dec.positionEnuM, velocityEnuMps: dec.velocityEnuMps };
        if (inFov(t)) return t;
      }
      const t = list.find((x) => x.id === m.seekerId);
      if (t && inFov(t)) {
        // A fresh decoy inside the track gate may pull the seeker off (one roll per decoy).
        const r = sub(t.positionEnuM, m.pos), rn = len(r) || 1;
        for (const d of decoys) {
          if (d.ageS > DECOY_SEDUCTION.freshS || m.rolledDecoys.has(d.id)) continue;
          const q = sub(d.positionEnuM, m.pos), qn = len(q) || 1;
          if (Math.acos(Math.max(-1, Math.min(1, dot(r, q) / (rn * qn)))) > DECOY_SEDUCTION.gateRad) continue;
          m.rolledDecoys.add(d.id);
          if (this.rng.nextFloat() < DECOY_SEDUCTION[wanted]) {
            m.seekerId = d.id;
            this.log.push({ timeS: this.time, missileId: m.id, kind: "decoyed", targetId: t.id, detail: `seduced by ${d.id}` });
            return { id: d.id, side: d.side, positionEnuM: d.positionEnuM, velocityEnuMps: d.velocityEnuMps };
          }
        }
        return t;
      }
      m.seekerId = null;
    }
    // Radar missiles go active only near the cued point; IR missiles look from launch.
    const aim = m.lastCue?.positionEnuM ?? null;
    if (m.spec.guidance === "radar" && aim && len(sub(aim, m.pos)) > m.spec.seekerRangeM) return null;
    const ref = aim ?? [m.pos[0] + fwd[0] * 3000, m.pos[1] + fwd[1] * 3000, m.pos[2] + fwd[2] * 3000] as Vector3;
    const pick = list.filter((t) => t.side !== m.side && t.id !== m.shooterId && inFov(t))
      .sort((a, b) => len(sub(a.positionEnuM, ref)) - len(sub(b.positionEnuM, ref)))[0];
    if (pick) m.seekerId = pick.id;
    return pick ?? null;
  }

  public step(dt: number): void {
    this.time += dt;
    const list = this.targets();
    for (const m of this.missiles) {
      if (!m.alive) continue;
      m.t += dt;
      const c = m.cue();
      if (c) m.lastCue = { positionEnuM: [...c.positionEnuM], velocityEnuMps: [...c.velocityEnuMps] };
      else if (m.lastCue) m.lastCue = { positionEnuM: [m.lastCue.positionEnuM[0] + m.lastCue.velocityEnuMps[0] * dt, m.lastCue.positionEnuM[1] + m.lastCue.velocityEnuMps[1] * dt, m.lastCue.positionEnuM[2] + m.lastCue.velocityEnuMps[2] * dt], velocityEnuMps: m.lastCue.velocityEnuMps };
      const target = this.seek(m, list);
      const aimP = target?.positionEnuM ?? m.lastCue?.positionEnuM ?? null;
      const aimV = target?.velocityEnuMps ?? m.lastCue?.velocityEnuMps ?? [0, 0, 0];
      const spd = Math.max(1, len(m.vel));
      // The active seeker radiates once inside its acquisition range of the cued point (or while homing).
      m.active = !!m.spec.activeSeeker && (!!target || (!!aimP && len(sub(aimP, m.pos)) <= m.spec.seekerRangeM));
      m.seekerStart = m.seekerEnd;
      if (aimP) { const d = sub(aimP, m.pos), n = len(d) || 1; m.seekerEnd = [d[0] / n, d[1] / n, d[2] / n]; }
      else m.seekerEnd = scale(m.vel, 1 / spd);
      // Speed: motor then drag (ρ from ISA).
      const rho = standardAtmosphere(Math.max(0, Math.min(30000, m.pos[2]))).densityKgM3 / 1.225;
      const thrustA = m.t <= m.spec.burnS ? m.spec.boostDeltaVMps / m.spec.burnS : 0;
      let acc: Vector3 = scale(m.vel, (thrustA - m.spec.dragK * rho * spd * spd) / spd);
      // Proportional navigation toward the seeker target (or the cued point), with gravity compensation.
      if (aimP) {
        const r = sub(aimP, m.pos), vr = sub(aimV, m.vel), rr = Math.max(1, dot(r, r));
        const omega = scale(cross(r, vr), 1 / rr);
        const closing = Math.max(spd * 0.5, -dot(r, vr) / Math.sqrt(rr));
        let a = scale(cross(omega, scale(m.vel, 1 / spd)), m.spec.navConstant * closing);
        a = [a[0], a[1], a[2] + G];
        // Keep only the component normal to the velocity (steering, not thrust).
        const along = dot(a, m.vel) / spd;
        a = sub(a, scale(m.vel, along / spd));
        const aMax = m.spec.maxG * G * Math.min(1, rho * 1.5 + 0.15);
        const an = len(a);
        if (an > aMax) a = scale(a, aMax / an);
        acc = [acc[0] + a[0], acc[1] + a[1], acc[2] + a[2]];
      }
      acc = [acc[0], acc[1], acc[2] - G];
      m.vel = [m.vel[0] + acc[0] * dt, m.vel[1] + acc[1] * dt, m.vel[2] + acc[2] * dt];
      m.pos = [m.pos[0] + m.vel[0] * dt, m.pos[1] + m.vel[1] * dt, m.pos[2] + m.vel[2] * dt];
      // Fuze against every opposing aircraft (closest approach within the step).
      // The fuze fires at the closest approach: inside the radius and no closer next step.
      let nearest: { t: CombatTarget; d: number; opening: boolean } | null = null;
      for (const t of list) {
        if (t.side === m.side || t.id === m.shooterId) continue;
        const rel = sub(m.pos, t.positionEnuM);
        const prev = m.prevRel.get(t.id) ?? rel;
        const d = closest(prev, rel);
        const next: Vector3 = [2 * rel[0] - prev[0], 2 * rel[1] - prev[1], 2 * rel[2] - prev[2]];
        const opening = d < len(rel) - 1e-6 || closest(rel, next) >= len(rel) - 1e-6;
        m.prevRel.set(t.id, rel);
        if (!nearest || d < nearest.d) nearest = { t, d, opening };
      }
      if (nearest && nearest.d < m.spec.fuzeRadiusM && nearest.opening && m.t > 0.6) {
        m.alive = false;
        const kill = this.rng.nextFloat() < Math.exp(-((nearest.d / m.spec.lethalRadiusM) ** 2));
        this.log.push({ timeS: this.time, missileId: m.id, kind: kill ? "kill" : "miss", targetId: nearest.t.id, detail: `${nearest.d.toFixed(1)} m` });
        if (kill) this.onKill(nearest.t.id, this.stateOf(m));
        continue;
      }
      const ground = this.groundHeightAt(m.pos[0], m.pos[1]);
      const reason = m.t > m.spec.lifetimeS ? "motor and battery exhausted" : Number.isFinite(ground) && m.pos[2] < ground ? "hit the ground" : len(m.vel) < 150 && m.t > m.spec.burnS ? "too slow" : null;
      if (reason) { m.alive = false; this.log.push({ timeS: this.time, missileId: m.id, kind: "lost", detail: reason }); }
    }
    this.missiles = this.missiles.filter((m) => m.alive);
  }

  private stateOf(m: NotionalMissile): NotionalMissileState {
    return { id: m.id, spec: m.spec, side: m.side, shooterId: m.shooterId, positionEnuM: [...m.pos], velocityEnuMps: [...m.vel], timeS: m.t, burning: m.t <= m.spec.burnS, seekerTargetId: m.seekerId };
  }

  /** Active seekers as RF emitters (only what is transmitting now). */
  public emitters(): readonly RfEmitter[] {
    return this.missiles.filter((m) => m.alive && m.active && m.spec.activeSeeker).map((m) => {
      const a = m.spec.activeSeeker!;
      return { positionEnuM: [...m.pos], boresightStartEnu: m.seekerStart, boresightEndEnu: m.seekerEnd, pattern: { peakGainDbi: a.peakGainDbi, beamwidthRad: a.beamwidthRad, sidelobeDb: a.sidelobeDb },
        carrierHz: a.carrierHz, peakPowerW: a.peakPowerW, cw: false, prfHz: a.prfHz, pulseWidthS: a.pulseWidthS, radiating: true };
    });
  }

  public states(): readonly NotionalMissileState[] { return this.missiles.map((m) => this.stateOf(m)); }
  public events(sinceS = 0): readonly NotionalWeaponEvent[] { return this.log.filter((e) => e.timeS >= sinceS); }
  public get timeS(): number { return this.time; }
}
