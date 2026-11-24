/**
 * Electrical power network (owner: systems/electrical). Platform-neutral power-flow physics ONLY;
 * every aircraft package supplies its OWN installation (sources, buses, switching priorities, load
 * shedding, warnings) and decides what loses power means for its systems.
 *
 * Fidelity tier: "bus power availability". Each step:
 *  - Generators produce rated power when their drive (engine or accessory gearbox) is at or above
 *    its minimum speed and they are not failed/switched off.
 *  - Converters (transformer-rectifiers, static inverters) take power from an input bus.
 *  - Each bus connects to the FIRST available source in its priority list (automatic bus transfer).
 *    A bus may shed its sheddable loads when fed from a listed backup source.
 *  - Batteries supply their buses while discharging (capacity in ampere-hours at nominal voltage);
 *    they are not recharged by generators unless the package says so.
 *  - A source whose connected load exceeds its rating trips off (overload protection).
 * Not modelled: voltages/frequencies as continuous quantities, transients, wiring faults, bus ties
 * beyond the priority list, battery temperature.
 */

export type ElectricalSourceSpec =
  | { readonly id: string; readonly kind: "generator"; readonly driveId: string; readonly minDriveFraction: number; readonly ratedPowerW: number }
  | { readonly id: string; readonly kind: "converter"; readonly inputBusId: string; readonly ratedPowerW: number; readonly efficiency: number }
  | { readonly id: string; readonly kind: "battery"; readonly capacityAh: number; readonly nominalVoltage: number; readonly rechargeFromBusId?: string; readonly rechargeCurrentA?: number };

export interface BusSpec {
  readonly id: string;
  /** Sources in priority order (automatic transfer to the next on loss). */
  readonly sources: readonly string[];
  /** Loads, W, that are always connected while the bus is powered. */
  readonly essentialLoadW: number;
  /** Additional loads, W, shed when the bus is fed from any source in `shedOn`. */
  readonly sheddableLoadW: number;
  readonly shedOn?: readonly string[];
}

export interface ElectricalInstallation {
  readonly sources: readonly ElectricalSourceSpec[];
  /** Buses in solve order: a converter's input bus must come before the buses it feeds. */
  readonly buses: readonly BusSpec[];
}

export interface BusState {
  readonly id: string;
  readonly powered: boolean;
  readonly sourceId: string | null;
  readonly loadW: number;
  readonly shed: boolean;
}

export interface ElectricalSnapshot {
  readonly buses: readonly BusState[];
  readonly sources: readonly { readonly id: string; readonly online: boolean; /** Able to supply (drive up to speed, not failed/tripped/off, battery not flat), whether or not a bus uses it. */ readonly available: boolean; readonly loadW: number; readonly tripped: boolean; readonly chargeAh?: number }[];
}

export class ElectricalNetwork {
  private charge = new Map<string, number>();
  private off = new Set<string>();
  private tripped = new Set<string>();
  private last: ElectricalSnapshot = { buses: [], sources: [] };

  public constructor(public readonly installation: ElectricalInstallation) {
    const ids = new Set(installation.sources.map((s) => s.id));
    for (const b of installation.buses) for (const s of b.sources) if (!ids.has(s)) throw new Error(`Bus ${b.id}: unknown source ${s}`);
    this.reset();
  }

  public reset(): void {
    for (const s of this.installation.sources) if (s.kind === "battery") this.charge.set(s.id, s.capacityAh);
    this.off.clear();
    this.tripped.clear();
  }

  /** Sources failed or switched off by the package (cockpit switches, failures). */
  public setSourcesOff(ids: readonly string[]): void {
    this.off = new Set(ids);
  }

  /** Reset an overload trip (e.g. a generator reset switch). */
  public resetTrip(id: string): void { this.tripped.delete(id); }

  public busPowered(id: string): boolean {
    return this.last.buses.find((b) => b.id === id)?.powered ?? false;
  }

  public get snapshot(): ElectricalSnapshot { return this.last; }

  public step(dt: number, driveSpeed: (driveId: string) => number): ElectricalSnapshot {
    const specs = new Map(this.installation.sources.map((s) => [s.id, s]));
    const load = new Map<string, number>();
    const busOut = new Map<string, BusState>();
    const available = (id: string): boolean => {
      const s = specs.get(id)!;
      if (this.off.has(id) || this.tripped.has(id)) return false;
      if (s.kind === "generator") return driveSpeed(s.driveId) >= s.minDriveFraction;
      if (s.kind === "battery") return (this.charge.get(id) ?? 0) > 0;
      return busOut.get(s.inputBusId)?.powered ?? false;
    };
    for (const b of this.installation.buses) {
      const src = b.sources.find(available) ?? null;
      const shed = src !== null && (b.shedOn ?? []).includes(src);
      const w = src === null ? 0 : b.essentialLoadW + (shed ? 0 : b.sheddableLoadW);
      if (src) load.set(src, (load.get(src) ?? 0) + w);
      busOut.set(b.id, { id: b.id, powered: src !== null, sourceId: src, loadW: w, shed });
    }
    // Converters draw their output (÷ efficiency) from their input bus's source.
    for (const s of this.installation.sources) {
      if (s.kind !== "converter") continue;
      const out = load.get(s.id) ?? 0;
      const inSrc = busOut.get(s.inputBusId)?.sourceId;
      if (out > 0 && inSrc) load.set(inSrc, (load.get(inSrc) ?? 0) + out / s.efficiency);
    }
    // Overload protection and battery discharge / recharge.
    for (const s of this.installation.sources) {
      const w = load.get(s.id) ?? 0;
      if (s.kind !== "battery" && w > s.ratedPowerW * 1.0001) this.tripped.add(s.id);
      if (s.kind === "battery") {
        let c = (this.charge.get(s.id) ?? 0) - (w / s.nominalVoltage) * (dt / 3600);
        if (w === 0 && s.rechargeFromBusId && busOut.get(s.rechargeFromBusId)?.powered) c += (s.rechargeCurrentA ?? 0) * (dt / 3600);
        this.charge.set(s.id, Math.max(0, Math.min(s.capacityAh, c)));
      }
    }
    this.last = {
      buses: [...busOut.values()],
      sources: this.installation.sources.map((s) => ({ id: s.id, available: available(s.id), online: [...busOut.values()].some((b) => b.sourceId === s.id), loadW: load.get(s.id) ?? 0, tripped: this.tripped.has(s.id), ...(s.kind === "battery" ? { chargeAh: this.charge.get(s.id) ?? 0 } : {}) }))
    };
    return this.last;
  }
}
