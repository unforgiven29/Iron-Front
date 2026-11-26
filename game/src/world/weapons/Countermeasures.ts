/**
 * Expendable countermeasures: flares and chaff (owner: game/world). BASIC, NOTIONAL model.
 *
 * Decoys are ejected from the dispensing aircraft, slow down in the air and fall, and burn out
 * (flares) or disperse (chaff). They only interact with the NOTIONAL missile seekers
 * (NotionalMissiles.ts), which pick targets from world state: an IR seeker can be seduced by a fresh
 * flare, a radar seeker by a fresh chaff cloud, inside its track gate. No IR signature, spectral,
 * RCS or Doppler model exists here; every number below is a gameplay estimate, not measured data,
 * and the 6-DoF Missile seekers are not affected.
 */
import type { Vector3 } from "../../core/coordinates/CoordinateFrames.js";
import type { Side } from "./NotionalMissiles.js";

export type DecoyKind = "flare" | "chaff";

export interface Decoy {
  readonly id: string;
  readonly kind: DecoyKind;
  readonly side: Side;
  readonly ownerId: string;
  readonly positionEnuM: Vector3;
  readonly velocityEnuMps: Vector3;
  readonly ageS: number;
  readonly lifeS: number;
}

/** Ejection, slowdown and life (ESTIMATED gameplay values). */
const BEHAVIOUR: Readonly<Record<DecoyKind, { ejectMps: number; slowTauS: number; fallMps: number; lifeS: number }>> = {
  flare: { ejectMps: 30, slowTauS: 1.2, fallMps: 25, lifeS: 4.5 },
  chaff: { ejectMps: 15, slowTauS: 0.25, fallMps: 2, lifeS: 8 }
};

/** Cartridges carried (ESTIMATED typical load; not a specific aircraft's fit). */
export const DEFAULT_EXPENDABLES: Readonly<Record<DecoyKind, number>> = { flare: 30, chaff: 30 };

interface Live { id: string; kind: DecoyKind; side: Side; ownerId: string; pos: [number, number, number]; vel: [number, number, number]; age: number; life: number }

export class CountermeasureWorld {
  private live: Live[] = [];
  private n = 0;

  public reset(): void { this.live = []; this.n = 0; }

  /**
   * Eject one decoy from an aircraft at `positionEnuM` moving at `velocityEnuMps`. `side` (−1 left,
   * +1 right) picks the dispenser; the cartridge leaves downward and outward relative to the airflow.
   */
  public dispense(kind: DecoyKind, side: Side, ownerId: string, positionEnuM: Vector3, velocityEnuMps: Vector3, dispenserSide: -1 | 1): string {
    const b = BEHAVIOUR[kind];
    const sp = Math.hypot(velocityEnuMps[0], velocityEnuMps[1]) || 1;
    const right: Vector3 = [velocityEnuMps[1] / sp, -velocityEnuMps[0] / sp, 0];
    const v: [number, number, number] = [
      velocityEnuMps[0] + right[0] * dispenserSide * b.ejectMps * 0.5,
      velocityEnuMps[1] + right[1] * dispenserSide * b.ejectMps * 0.5,
      velocityEnuMps[2] - b.ejectMps
    ];
    const id = `${kind}-${++this.n}`;
    this.live.push({ id, kind, side, ownerId, pos: [positionEnuM[0], positionEnuM[1], positionEnuM[2] - 1], vel: v, age: 0, life: b.lifeS });
    return id;
  }

  public step(dt: number): void {
    for (const d of this.live) {
      const b = BEHAVIOUR[d.kind];
      const k = Math.exp(-dt / b.slowTauS);
      // Horizontal speed decays toward still air; vertical speed relaxes to the fall rate.
      d.vel = [d.vel[0] * k, d.vel[1] * k, -b.fallMps + (d.vel[2] + b.fallMps) * k];
      d.pos = [d.pos[0] + d.vel[0] * dt, d.pos[1] + d.vel[1] * dt, d.pos[2] + d.vel[2] * dt];
      d.age += dt;
    }
    this.live = this.live.filter((d) => d.age < d.life);
  }

  public decoys(): readonly Decoy[] {
    return this.live.map((d) => ({ id: d.id, kind: d.kind, side: d.side, ownerId: d.ownerId, positionEnuM: d.pos, velocityEnuMps: d.vel, ageS: d.age, lifeS: d.life }));
  }
}
