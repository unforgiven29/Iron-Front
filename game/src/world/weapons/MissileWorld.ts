/**
 * Missiles in flight and their end-game (owner: game/world). Steps every missile through the shared
 * flyout, feeds each proximity fuze the distance to the nearest target (closest approach within the
 * step, so high closure speeds cannot tunnel through), and resolves warhead effects against the
 * world's targets. Kill probability vs miss distance: Pk = exp(−(d / lethal radius)²) (ESTIMATED
 * smooth fall-off around the catalog lethal radius).
 */
import type { Vector3 } from "../../core/coordinates/CoordinateFrames.js";
import { createScopedRandom } from "../../core/random/SeededRandom.js";
import { sub } from "../../physics/sensing/SweepGeometry.js";
import { closestApproach, Missile, type LauncherLink, type MissileSpec, type MissileState } from "../../weapons/missiles/Missile.js";
import type { AirTargetWorld } from "../targets/AirTargets.js";

export interface WeaponEvent { readonly timeS: number; readonly missileId: string; readonly kind: "launch" | "kill" | "miss" | "lost"; readonly detail: string }

export class MissileWorld {
  private missiles: Missile[] = [];
  private prevRel = new Map<string, Map<string, Vector3>>();
  private log: WeaponEvent[] = [];
  private n = 0;
  private time = 0;
  private rng = createScopedRandom(77, "missile-world");

  public constructor(private readonly targets: AirTargetWorld, private readonly groundHeightAt: (x: number, y: number) => number) {}

  public reset(): void { this.missiles = []; this.prevRel.clear(); this.log = []; this.time = 0; }

  public launch(spec: MissileSpec, positionEnuM: Vector3, velocityEnuMps: Vector3, link: () => LauncherLink, irCue: Vector3 | null): string {
    const id = `${spec.id}-${++this.n}`;
    this.missiles.push(new Missile(id, spec, positionEnuM, velocityEnuMps, link, irCue));
    this.log.push({ timeS: this.time, missileId: id, kind: "launch", detail: spec.display });
    return id;
  }

  public step(dt: number): void {
    this.time += dt;
    for (const m of this.missiles) {
      if (!m.alive) continue;
      m.step(this.targets, dt, this.groundHeightAt);
      const prev = this.prevRel.get(m.id) ?? new Map<string, Vector3>();
      let nearest: { id: string; d: number } | null = null;
      for (const t of this.targets.states()) {
        const rel = sub(m.state.positionEnuM, t.positionEnuM);
        const d = closestApproach(prev.get(t.id) ?? rel, rel);
        prev.set(t.id, rel);
        if (!nearest || d < nearest.d) nearest = { id: t.id, d };
      }
      this.prevRel.set(m.id, prev);
      if (nearest && m.fuze(nearest.d)) {
        const lethal = m.spec.warhead.value.lethalRadiusM;
        const pk = Math.exp(-((nearest.d / lethal) ** 2));
        const kill = this.rng.nextFloat() < pk;
        if (kill) this.targets.destroy(nearest.id);
        m.kill("detonated");
        this.log.push({ timeS: this.time, missileId: m.id, kind: kill ? "kill" : "miss", detail: `${nearest.d.toFixed(1)} m` });
      } else if (!m.alive) this.log.push({ timeS: this.time, missileId: m.id, kind: "lost", detail: m.state.reason ?? "" });
    }
    this.missiles = this.missiles.filter((m) => m.alive || this.time - m.state.timeS < 0);
  }

  public states(): readonly MissileState[] { return this.missiles.filter((m) => m.alive).map((m) => m.state); }
  public events(sinceS = 0): readonly WeaponEvent[] { return this.log.filter((e) => e.timeS >= sinceS); }
}
