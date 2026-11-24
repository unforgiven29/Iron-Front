/**
 * Lumped stored-gas (pneumatic) network (owner: game/systems/pneumatics; spec in
 * game/systems/pneumatics/README.md). Platform-neutral: an aircraft package supplies the
 * installation — gas systems and their bottles, pressure regulators, consumers and which
 * regulator or system feeds each — with provenance.
 *
 * Fidelity tier: "lumped nodes". Each SYSTEM is one gas node: its bottles share a manifold and
 * hold an amount of gas n (mol). Pressure follows the ideal-gas law P = n·R·T / V, with V the sum
 * of the system's bottle volumes and T a lumped gas temperature that relaxes towards ambient with
 * the system's thermal time constant (absent: isothermal at the charge temperature).
 * Systems are independent: there is no crossfeed (check-valve isolation) unless a
 * `check-valve-failed` fault connects two systems, which then exchange gas through the failed
 * valve's conductance towards pressure equality.
 * There is NO in-flight recharge: gas leaves a system only (consumers, leaks) and comes back only
 * through `service()` (ground servicing to the charge pressure) or `reset()`.
 *
 * REGULATORS reduce a system's pressure to a setpoint: outlet = min(setpoint, system pressure).
 * Faults: failed closed → 0; failed open → full system pressure (no regulation).
 * CONSUMERS draw gas from a regulator outlet (or directly from a system) in two ways the package
 * reports each step:
 *  - continuous demand 0..1 × `flowM3sAtFull` (gas volume per second at the supply pressure), e.g.
 *    reservoir headspace make-up, equipment pressurisation, an actuator moving;
 *  - discrete actuations (fractions of a full stroke) × `strokeVolumeM3` at the supply pressure,
 *    e.g. a brake application, a valve or a jack stroke.
 * Gas used = P_supply·V/(R·T). A consumer's supply fraction = min(1, P_supply / requiredPressurePa):
 * owners use it to scale what the consumer can do (brake force, actuator speed, inlet pressure).
 *
 * Not modelled (declared envelope): line volumes and transients, regulator droop and dynamics,
 * adiabatic cooling during fast discharge, relief valves on regulated lines, moisture, gas other
 * than an ideal gas, and charging-valve faults during servicing.
 */

const R = 8.314462618; // J/(mol·K)

export interface BottleSpec {
  readonly id: string;
  readonly volumeM3: number;
}

export interface GasSystemSpec {
  readonly id: string;
  readonly bottles: readonly BottleSpec[];
  /** Servicing charge pressure, Pa, at the charge temperature. */
  readonly chargePressurePa: number;
  /** Temperature at which the charge pressure is specified, K (default 288.15). */
  readonly chargeTemperatureK?: number;
  /** Gas temperature relaxation towards ambient, s (absent: isothermal at the charge temperature). */
  readonly thermalTimeConstantS?: number;
  /** Normal seal leakage, mol/s per Pa (absent: none). */
  readonly leakageMolSPerPa?: number;
}

export interface RegulatorSpec {
  readonly id: string;
  readonly systemId: string;
  readonly setpointPa: number;
}

export interface PneumaticConsumerSpec {
  readonly id: string;
  /** Regulator or system that supplies it. */
  readonly supplyId: string;
  /** Pressure at which the consumer has full function, Pa. */
  readonly requiredPressurePa: number;
  /** Gas volume per second at the supply pressure with demand 1, m³/s (absent: no continuous use). */
  readonly flowM3sAtFull?: number;
  /** Gas volume per full stroke at the supply pressure, m³ (absent: no discrete actuations). */
  readonly strokeVolumeM3?: number;
}

export interface PneumaticInstallation {
  readonly systems: readonly GasSystemSpec[];
  readonly regulators?: readonly RegulatorSpec[];
  readonly consumers?: readonly PneumaticConsumerSpec[];
}

export type PneumaticFault =
  | { readonly kind: "system-leak"; readonly systemId: string; readonly leakMolSPerPa: number }
  | { readonly kind: "regulator-failed"; readonly regulatorId: string; readonly mode: "closed" | "open" }
  | { readonly kind: "check-valve-failed"; readonly systemA: string; readonly systemB: string; readonly conductanceMolSPerPa: number };

export interface GasSystemState {
  readonly id: string;
  readonly pressurePa: number;
  readonly gasMol: number;
  readonly temperatureK: number;
  /** Fraction of the serviced gas inventory remaining. */
  readonly inventoryFraction: number;
}

export interface PneumaticSnapshot {
  readonly systems: readonly GasSystemState[];
  readonly regulators: readonly { readonly id: string; readonly systemId: string; readonly outletPa: number }[];
  readonly consumers: readonly { readonly id: string; readonly supplyPa: number; readonly supplyFraction: number; readonly usedMolS: number }[];
  readonly faults: readonly PneumaticFault[];
}

export interface PneumaticStepOptions {
  /** Continuous demand 0..1 by consumer id (absent = 0). */
  readonly demand?: Readonly<Record<string, number>>;
  /** Discrete actuations this step, in full strokes, by consumer id (absent = 0). */
  readonly actuations?: Readonly<Record<string, number>>;
  readonly ambientK?: number;
}

export class PneumaticNetwork {
  private readonly volume = new Map<string, number>();
  private readonly gas = new Map<string, number>();
  private readonly temperature = new Map<string, number>();
  private readonly servicedMol = new Map<string, number>();
  private readonly regulators = new Map<string, RegulatorSpec>();
  private readonly consumers = new Map<string, PneumaticConsumerSpec>();
  private faults: readonly PneumaticFault[] = [];
  private used = new Map<string, number>();

  public constructor(public readonly installation: PneumaticInstallation) {
    const ids = new Set<string>();
    const unique = (id: string) => { if (ids.has(id)) throw new Error(`pneumatics: duplicate id "${id}"`); ids.add(id); };
    for (const s of installation.systems) {
      unique(s.id);
      const v = s.bottles.reduce((a, b) => a + b.volumeM3, 0);
      if (!(v > 0)) throw new Error(`pneumatics: system "${s.id}" needs bottle volume`);
      if (!(s.chargePressurePa > 0)) throw new Error(`pneumatics: system "${s.id}" needs a charge pressure`);
      this.volume.set(s.id, v);
    }
    for (const r of installation.regulators ?? []) {
      unique(r.id);
      if (!this.volume.has(r.systemId)) throw new Error(`pneumatics: regulator "${r.id}" on unknown system "${r.systemId}"`);
      this.regulators.set(r.id, r);
    }
    for (const c of installation.consumers ?? []) {
      unique(c.id);
      if (!this.volume.has(c.supplyId) && !this.regulators.has(c.supplyId)) throw new Error(`pneumatics: consumer "${c.id}" on unknown supply "${c.supplyId}"`);
      this.consumers.set(c.id, c);
    }
    this.reset();
  }

  /** Bottles serviced to their charge pressure; faults cleared. */
  public reset(): void {
    this.faults = [];
    for (const s of this.installation.systems) this.service(s.id);
    this.used = new Map();
  }

  /** Ground servicing: recharge a system to its charge pressure at the charge temperature. */
  public service(systemId: string): void {
    const s = this.spec(systemId), tc = s.chargeTemperatureK ?? 288.15;
    const n = (s.chargePressurePa * this.volume.get(systemId)!) / (R * tc);
    this.gas.set(systemId, n);
    this.temperature.set(systemId, tc);
    this.servicedMol.set(systemId, n);
  }

  public setFaults(faults: readonly PneumaticFault[]): void { this.faults = [...faults]; }

  public has(id: string): boolean { return this.volume.has(id) || this.regulators.has(id) || this.consumers.has(id); }

  /** Pressure of a system, regulator outlet or consumer supply, Pa. */
  public pressurePa(id: string): number {
    if (this.volume.has(id)) return this.systemPressure(id);
    const r = this.regulators.get(id);
    if (r) {
      const up = this.systemPressure(r.systemId);
      const f = this.faults.find((x) => x.kind === "regulator-failed" && x.regulatorId === id);
      if (f?.kind === "regulator-failed") return f.mode === "closed" ? 0 : up;
      return Math.min(r.setpointPa, up);
    }
    const c = this.consumers.get(id);
    return c ? this.pressurePa(c.supplyId) : 0;
  }

  /** A consumer's supply as a fraction of its required pressure (0..1). */
  public supplyFraction(consumerId: string): number {
    const c = this.consumers.get(consumerId);
    if (!c) throw new Error(`pneumatics: unknown consumer "${consumerId}"`);
    return Math.max(0, Math.min(1, this.pressurePa(c.supplyId) / c.requiredPressurePa));
  }

  public step(dt: number, opts: PneumaticStepOptions = {}): PneumaticSnapshot {
    const used = new Map<string, number>();
    const draw = new Map(this.installation.systems.map((s) => [s.id, 0])); // mol removed this step
    const systemOf = (supplyId: string) => this.regulators.get(supplyId)?.systemId ?? supplyId;
    for (const c of this.consumers.values()) {
      const p = this.pressurePa(c.supplyId);
      const T = this.temperature.get(systemOf(c.supplyId))!;
      const demand = Math.max(0, Math.min(1, opts.demand?.[c.id] ?? 0));
      const strokes = Math.max(0, opts.actuations?.[c.id] ?? 0);
      const vol = demand * (c.flowM3sAtFull ?? 0) * dt + strokes * (c.strokeVolumeM3 ?? 0);
      const mol = (p * vol) / (R * T);
      used.set(c.id, dt > 0 ? mol / dt : 0);
      draw.set(systemOf(c.supplyId), draw.get(systemOf(c.supplyId))! + mol);
    }
    for (const s of this.installation.systems) {
      const p = this.systemPressure(s.id);
      const leak = (s.leakageMolSPerPa ?? 0) + this.faults.reduce((a, f) => a + (f.kind === "system-leak" && f.systemId === s.id ? f.leakMolSPerPa : 0), 0);
      draw.set(s.id, draw.get(s.id)! + leak * p * dt);
    }
    // Failed check valves: gas flows towards pressure equality, never past it.
    for (const f of this.faults) {
      if (f.kind !== "check-valve-failed") continue;
      const pa = this.systemPressure(f.systemA), pb = this.systemPressure(f.systemB);
      const ta = this.temperature.get(f.systemA)!, tb = this.temperature.get(f.systemB)!;
      const va = this.volume.get(f.systemA)!, vb = this.volume.get(f.systemB)!;
      // Amount that would equalise the pressures (each node's dP/dn = R·T/V).
      const equalise = (pa - pb) / ((R * ta) / va + (R * tb) / vb);
      const flow = Math.sign(equalise) * Math.min(Math.abs(equalise), f.conductanceMolSPerPa * Math.abs(pa - pb) * dt);
      draw.set(f.systemA, draw.get(f.systemA)! + flow);
      draw.set(f.systemB, draw.get(f.systemB)! - flow);
    }
    const ambient = opts.ambientK;
    for (const s of this.installation.systems) {
      this.gas.set(s.id, Math.max(0, this.gas.get(s.id)! - draw.get(s.id)!));
      if (ambient !== undefined && s.thermalTimeConstantS) {
        const T = this.temperature.get(s.id)!;
        this.temperature.set(s.id, T + (ambient - T) * (1 - Math.exp(-dt / s.thermalTimeConstantS)));
      }
    }
    this.used = used;
    return this.snapshot();
  }

  public snapshot(): PneumaticSnapshot {
    return {
      systems: this.installation.systems.map((s) => ({ id: s.id, pressurePa: this.systemPressure(s.id), gasMol: this.gas.get(s.id)!, temperatureK: this.temperature.get(s.id)!, inventoryFraction: this.gas.get(s.id)! / this.servicedMol.get(s.id)! })),
      regulators: [...this.regulators.values()].map((r) => ({ id: r.id, systemId: r.systemId, outletPa: this.pressurePa(r.id) })),
      consumers: [...this.consumers.values()].map((c) => ({ id: c.id, supplyPa: this.pressurePa(c.supplyId), supplyFraction: this.supplyFraction(c.id), usedMolS: this.used.get(c.id) ?? 0 })),
      faults: this.faults
    };
  }

  private spec(systemId: string): GasSystemSpec {
    const s = this.installation.systems.find((x) => x.id === systemId);
    if (!s) throw new Error(`pneumatics: unknown system "${systemId}"`);
    return s;
  }

  private systemPressure(id: string): number {
    return (this.gas.get(id)! * R * this.temperature.get(id)!) / this.volume.get(id)!;
  }
}
