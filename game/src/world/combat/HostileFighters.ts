/**
 * LOW-FIDELITY hostile fighters (owner: game/world/combat).
 *
 * A placeholder adversary so the game has someone to fight while the F-16C slice is reworked. Each
 * fighter is a point mass with a g-limited turn, an energy-ish speed model and a small state machine
 * (patrol → intercept → shoot / crank → defend). It is not a flight model and not a validated AI.
 *
 * Perception is gated, not omniscient: a fighter only knows about an opponent that its notional
 * radar cone (±60°, 75 km) or visual bubble (6 km, all aspect) currently contains, and it reacts to a
 * missile only inside its notional warning bubble (12 km, closing). Those gates are applied to the
 * world state the session passes in; they are a stand-in for real sensors, documented as such.
 * Weapons are the NOTIONAL catalog entries (invented values, not real-world performance).
 */
import type { Vector3 } from "../../core/coordinates/CoordinateFrames.js";
import { createScopedRandom, type SeededRandom } from "../../core/random/SeededRandom.js";
import { cross, unit } from "../../physics/sensing/SweepGeometry.js";
import type { NotionalMissileSpec } from "../../weapons/catalog/NotionalAirToAir.js";
import type { AirTargetBody, AirTargetState, TargetSignature } from "../targets/AirTargets.js";
import type { CombatTarget, LauncherCue, Side } from "../weapons/NotionalMissiles.js";

const G = 9.80665;
const D = Math.PI / 180;

export interface HostileFighterSpec {
  readonly id: string;
  readonly label: string;
  /** Render model id (rendering looks it up; shared code never branches on it). */
  readonly modelId: string;
  readonly signature: TargetSignature;
  readonly side: Side;
  readonly positionEnuM: Vector3;
  readonly headingRad: number;
  readonly speedMps: number;
  /** Stores, fired in order of suitability. */
  readonly loadout: readonly NotionalMissileSpec[];
  /** Notional limits (gameplay values). */
  readonly maxG?: number;
  readonly cruiseMps?: number;
  /** 0..1: reaction time and shot discipline. */
  readonly skill?: number;
}

export interface HostileEnvironment {
  /** Opposing aircraft and missiles in the world; the fighter applies its own perception gates. */
  opponents(): readonly CombatTarget[];
  threats(): readonly { readonly positionEnuM: Vector3; readonly velocityEnuMps: Vector3; readonly side: Side }[];
  groundHeightAt(x: number, y: number): number;
  fire(spec: NotionalMissileSpec, shooter: HostileFighter, targetId: string, cue: LauncherCue): void;
  /** True while a missile this fighter fired is still flying. */
  missileInFlight(shooterId: string, specId: string): boolean;
}

export type HostileMode = "patrol" | "intercept" | "crank" | "defend" | "egress";

const len = (v: Vector3) => Math.hypot(v[0], v[1], v[2]);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Notional perception gate: radar cone or visual bubble. */
export function canSee(observer: { positionEnuM: Vector3; headingRad: number }, target: Vector3): boolean {
  const r: Vector3 = [target[0] - observer.positionEnuM[0], target[1] - observer.positionEnuM[1], target[2] - observer.positionEnuM[2]];
  const d = len(r);
  if (d < 6000) return true;
  if (d > 75000) return false;
  const off = Math.abs(wrap(Math.atan2(r[0], r[1]) - observer.headingRad));
  const el = Math.abs(Math.asin(r[2] / d));
  return off < 60 * D && el < 60 * D;
}

export class HostileFighter implements AirTargetBody {
  public readonly spec: HostileFighterSpec;
  private pos: [number, number, number];
  private heading: number;
  private gamma = 0;
  private speed: number;
  private bank = 0;
  private turnRate = 0;
  private throttle = 0.8;
  private ab = 0;
  private time = 0;
  private stores: NotionalMissileSpec[];
  private lastShotS = -999;
  private modeStartS = 0;
  private crankSign = 1;
  private contact: { id: string; positionEnuM: Vector3; velocityEnuMps: Vector3; seenAtS: number } | null = null;
  public mode: HostileMode = "patrol";
  private readonly rng: SeededRandom;

  public constructor(spec: HostileFighterSpec, private readonly env: HostileEnvironment) {
    this.spec = spec;
    this.pos = [...spec.positionEnuM];
    this.heading = spec.headingRad;
    this.speed = spec.speedMps;
    this.stores = [...spec.loadout];
    this.rng = createScopedRandom(4242, `hostile/${spec.id}`);
  }

  public get remainingStores(): readonly NotionalMissileSpec[] { return this.stores; }
  public get positionEnuM(): Vector3 { return this.pos; }
  public get headingRad(): number { return this.heading; }
  public get velocityEnuMps(): Vector3 {
    const h = this.speed * Math.cos(this.gamma);
    return [Math.sin(this.heading) * h, Math.cos(this.heading) * h, this.speed * Math.sin(this.gamma)];
  }

  private setMode(m: HostileMode): void { if (m !== this.mode) { this.mode = m; this.modeStartS = this.time; } }

  private perceive(): void {
    const me = { positionEnuM: this.pos, headingRad: this.heading };
    const seen = this.env.opponents().filter((o) => o.side !== this.spec.side && canSee(me, o.positionEnuM))
      .sort((a, b) => len([a.positionEnuM[0] - this.pos[0], a.positionEnuM[1] - this.pos[1], a.positionEnuM[2] - this.pos[2]]) - len([b.positionEnuM[0] - this.pos[0], b.positionEnuM[1] - this.pos[1], b.positionEnuM[2] - this.pos[2]]));
    const pick = (this.contact && seen.find((o) => o.id === this.contact?.id)) || seen[0];
    if (pick) this.contact = { id: pick.id, positionEnuM: [...pick.positionEnuM], velocityEnuMps: [...pick.velocityEnuMps], seenAtS: this.time };
    else if (this.contact && this.time - this.contact.seenAtS > 20) this.contact = null;
  }

  /** Missile threat inside the warning bubble and closing; returns its position. */
  private threat(): Vector3 | null {
    for (const m of this.env.threats()) {
      if (m.side === this.spec.side) continue;
      const r: Vector3 = [m.positionEnuM[0] - this.pos[0], m.positionEnuM[1] - this.pos[1], m.positionEnuM[2] - this.pos[2]];
      const d = len(r);
      const vrel: Vector3 = [m.velocityEnuMps[0] - this.velocityEnuMps[0], m.velocityEnuMps[1] - this.velocityEnuMps[1], m.velocityEnuMps[2] - this.velocityEnuMps[2]];
      const closing = -(r[0] * vrel[0] + r[1] * vrel[1] + r[2] * vrel[2]) / (d || 1);
      if (d < 12000 && closing > 100) return m.positionEnuM;
    }
    return null;
  }

  private tryShoot(range: number, offBore: number): void {
    const c = this.contact;
    if (!c || this.time - c.seenAtS > 0.5) return;
    const skill = this.spec.skill ?? 0.6;
    if (this.time - this.lastShotS < 10 - 5 * skill) return;
    const options = this.stores.map((s, i) => ({ s, i })).filter(({ s }) => range < s.maxLaunchRangeM * (0.55 + 0.25 * skill) && range > s.minLaunchRangeM && offBore < s.maxOffBoresightRad * 0.8)
      .filter(({ s }) => !this.env.missileInFlight(this.spec.id, s.id));
    // Prefer the short-range IR missile when close, else the radar missile.
    options.sort((a, b) => (range < 8000 ? (a.s.guidance === "ir" ? -1 : 1) : (a.s.guidance === "radar" ? -1 : 1)) - (range < 8000 ? (b.s.guidance === "ir" ? -1 : 1) : (b.s.guidance === "radar" ? -1 : 1)));
    const shot = options[0];
    if (!shot) return;
    this.stores.splice(shot.i, 1);
    this.lastShotS = this.time;
    const id = c.id;
    // Radar missiles get midcourse updates while this fighter still sees the target.
    const cue: LauncherCue = () => this.contact && this.contact.id === id && this.time - this.contact.seenAtS < 1 && shot.s.guidance === "radar" ? { positionEnuM: this.contact.positionEnuM, velocityEnuMps: this.contact.velocityEnuMps } : null;
    const initial = { positionEnuM: c.positionEnuM, velocityEnuMps: c.velocityEnuMps };
    let first = true;
    this.env.fire(shot.s, this, id, () => { if (first) { first = false; return initial; } return cue(); });
    if (shot.s.guidance === "radar") { this.crankSign = this.rng.nextFloat() < 0.5 ? -1 : 1; this.setMode("crank"); }
  }

  public update(dt: number): void {
    this.time += dt;
    this.perceive();
    const threat = this.threat();
    const skill = this.spec.skill ?? 0.6;
    let desiredHeading = this.heading, desiredAlt = this.pos[2], desiredSpeed = this.spec.cruiseMps ?? 250;
    const c = this.contact;
    if (threat && this.mode !== "defend" && this.rng.nextFloat() < dt * (1 + 3 * skill)) this.setMode("defend");
    if (this.mode === "defend") {
      if (!threat && this.time - this.modeStartS > 6) this.setMode(c ? "intercept" : "patrol");
      else if (threat) {
        // Beam the threat and dive (notching / dragging the missile into denser air).
        const brg = Math.atan2(threat[0] - this.pos[0], threat[1] - this.pos[1]);
        const left = wrap(brg + 90 * D), right = wrap(brg - 90 * D);
        desiredHeading = Math.abs(wrap(left - this.heading)) < Math.abs(wrap(right - this.heading)) ? left : right;
        desiredAlt = this.pos[2] - 1500;
        desiredSpeed = 330;
        this.ab = 1;
      }
    } else if (c) {
      const r: Vector3 = [c.positionEnuM[0] - this.pos[0], c.positionEnuM[1] - this.pos[1], c.positionEnuM[2] - this.pos[2]];
      const range = len(r);
      const brg = Math.atan2(r[0], r[1]);
      // Lead pursuit: aim ahead of the target by a fraction of its travel over the closure time.
      const tgo = Math.min(10, range / Math.max(150, this.speed + 200));
      const lead: Vector3 = [c.positionEnuM[0] + c.velocityEnuMps[0] * tgo * 0.6 - this.pos[0], c.positionEnuM[1] + c.velocityEnuMps[1] * tgo * 0.6 - this.pos[1], 0];
      const fwd = unit(this.velocityEnuMps);
      const offBore = Math.acos(Math.max(-1, Math.min(1, (r[0] * fwd[0] + r[1] * fwd[1] + r[2] * fwd[2]) / (range || 1))));
      if (this.mode === "crank") {
        desiredHeading = wrap(brg + this.crankSign * 50 * D);
        desiredAlt = c.positionEnuM[2] + 500;
        if (this.time - this.modeStartS > 18 || range < 10000) this.setMode("intercept");
      } else {
        this.setMode(this.stores.length === 0 && range > 15000 ? "egress" : "intercept");
        desiredHeading = this.mode === "egress" ? wrap(brg + Math.PI) : Math.atan2(lead[0], lead[1]);
        desiredAlt = range < 10000 ? c.positionEnuM[2] : Math.max(c.positionEnuM[2] + 1000, 3000);
        desiredSpeed = range < 10000 ? 300 : 270;
        this.ab = range < 12000 ? 1 : 0;
        if (this.mode === "intercept") this.tryShoot(range, offBore);
      }
    } else {
      this.setMode("patrol");
      this.ab = 0;
      // Lazy orbit until something enters the sensors.
      desiredHeading = wrap(this.heading + 15 * D);
    }

    // Turn: g-limited coordinated turn toward the desired heading.
    const maxG = (this.spec.maxG ?? 7.5) * (0.85 + 0.15 * skill);
    const err = wrap(desiredHeading - this.heading);
    const maxRate = (G * Math.sqrt(Math.max(0, maxG * maxG - 1))) / Math.max(120, this.speed);
    const wantRate = Math.max(-maxRate, Math.min(maxRate, err * 0.8));
    this.turnRate += (wantRate - this.turnRate) * Math.min(1, dt * 2.5);
    this.heading = wrap(this.heading + this.turnRate * dt);
    // Climb/dive: flight-path angle toward the altitude error, ground avoidance first.
    const ground = this.env.groundHeightAt(this.pos[0], this.pos[1]);
    const floor = (Number.isFinite(ground) ? ground : 0) + 700;
    if (desiredAlt < floor) desiredAlt = floor;
    const wantGamma = Math.max(-30 * D, Math.min(25 * D, (desiredAlt - this.pos[2]) / 3000));
    this.gamma += (wantGamma - this.gamma) * Math.min(1, dt * 0.8);
    if (this.pos[2] < floor && this.gamma < 0.1) this.gamma = 0.1;
    // Speed: throttle toward the desired speed, turn and climb bleed energy.
    const n = Math.sqrt(1 + (this.speed * this.turnRate / G) ** 2);
    this.throttle = Math.max(0.3, Math.min(1, 0.7 + (desiredSpeed - this.speed) / 100));
    const dv = (this.throttle - 0.55) * 18 + this.ab * 10 - (n - 1) * 3.2 - G * Math.sin(this.gamma);
    this.speed = Math.max(130, Math.min(480, this.speed + dv * dt));
    this.bank = Math.atan((this.speed * this.turnRate) / G);
    const v = this.velocityEnuMps;
    this.pos = [this.pos[0] + v[0] * dt, this.pos[1] + v[1] * dt, this.pos[2] + v[2] * dt];
  }

  public state(): AirTargetState {
    const vel = this.velocityEnuMps;
    const fwd = unit(vel);
    const levelRight = unit(cross(fwd, [0, 0, 1]));
    const up0 = cross(levelRight, fwd);
    const b = this.bank;
    const right = unit([levelRight[0] * Math.cos(b) - up0[0] * Math.sin(b), levelRight[1] * Math.cos(b) - up0[1] * Math.sin(b), levelRight[2] * Math.cos(b) - up0[2] * Math.sin(b)]);
    const down = cross(fwd, right);
    return { id: this.spec.id, label: this.spec.label, positionEnuM: [...this.pos], velocityEnuMps: vel, forwardEnu: fwd, rightEnu: right, downEnu: down, throttle: this.throttle, afterburner: this.ab };
  }
}
