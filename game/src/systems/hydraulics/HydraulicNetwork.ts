/**
 * Lumped hydraulic power network (owner: game/systems/hydraulics; spec in
 * game/systems/hydraulics/README.md). Platform-neutral: an aircraft package supplies the
 * installation — circuits, branches, pumps and what drives them, accumulators, consumers, an
 * optional emergency power unit and which circuit or branch feeds each actuator chamber — with
 * provenance.
 *
 * Fidelity tier: "lumped nodes". Each circuit and each branch is one pressure node:
 *   C(P)·dP/dt = Σ inflow − consumer flow − leakage,
 *   C(P) = V/B (fluid compliance) + Σ accumulator gas compliance V_g·P_pre/P² (isothermal).
 * Pumps are pressure-compensated variable-displacement units: full displacement × drive speed
 * below the compensator band, falling linearly to zero flow at the compensator setpoint; they
 * deliver nothing once their reservoir is empty (cavitation).
 * Branches hang off a circuit through a CHECK VALVE (flow only into the branch, limited by a
 * conductance and never past pressure equality) and optionally an ISOLATION VALVE the package
 * opens and closes. Accumulators on a branch therefore keep its users pressurised when the
 * circuit fails (e.g. flight-control accumulators, brake accumulators) and bleed down only by the
 * branch's own leakage and use.
 * Consumers (utility loads: gear, brakes, steering, motors…) draw flow from a circuit or branch
 * in proportion to the activity the package reports (0..1) and to the node's pressure fraction.
 * Reservoir: each circuit's reservoir holds the fluid not stored in its accumulators; external
 * leaks drain it. Fluid temperature: pump losses, leakage, relief and valve throttling heat the
 * fluid; a package-supplied cooler (e.g. a fuel/oil heat exchanger) removes heat above a thermal-
 * bypass temperature; a small conductance to ambient.
 *
 * Actuator authority (servo-valve physics): a valve meters flow ∝ √(supply − load pressure).
 * With force capacity F (mean of its chambers' pressure fractions, 1 = all chambers at nominal)
 * and the aerodynamic hinge load L as a fraction of full-pressure force, the achievable speed
 * relative to the no-load rating is √(max(0, 1 − L/F)), capped at 1. L comes from the actuator's
 * hinge-load spec: L = k·(q̄/q̄_ref)·(|δ|/δ_max), positive (opposing) when the surface moves away
 * from neutral and negative (aiding) when it moves back. With no pressure the surface holds.
 *
 * Not modelled (declared envelope): line resistance and transients between components, valve
 * spool dynamics, pump-inlet (reservoir) pressure other than empty/not empty, fluid viscosity
 * changes with temperature, contamination and filter bypass, electrically operated valves other
 * than isolation valves the package drives, surface blow-back, and hinge moments from the aero
 * model (the hinge load uses the linear estimate above).
 */

export interface CircuitSpec {
  readonly id: string;
  readonly nominalPressurePa: number;
  /** Pressurised fluid volume (lines, actuators), m³, and fluid bulk modulus, Pa. */
  readonly fluidVolumeM3: number;
  readonly bulkModulusPa: number;
  /** Internal leakage (returns to the reservoir), m³/s per Pa. */
  readonly leakageM3sPerPa: number;
  readonly reliefPressurePa: number;
  /** Usable reservoir fluid with the accumulators charged, m³ (absent: reservoir not modelled). */
  readonly reservoirM3?: number;
  /** Fluid thermal model (absent: temperature not modelled). */
  readonly thermal?: {
    /** Fluid + reservoir heat capacity, J/K. */
    readonly heatCapacityJPerK: number;
    /** Pump overall efficiency (the rest of the hydraulic power heats the fluid). */
    readonly pumpEfficiency: number;
    /** Cooler thermal bypass: no cooling below this fluid temperature, K. */
    readonly coolerBypassBelowK: number;
    /** Conductance to the surroundings, W/K. */
    readonly ambientConductanceWPerK: number;
  };
}

/** A node behind a check valve (and optionally an isolation valve) fed from a circuit. */
export interface BranchSpec {
  readonly id: string;
  readonly circuitId: string;
  /** Check-valve flow conductance into the branch, m³/s per Pa of pressure difference. */
  readonly chargeConductanceM3sPerPa: number;
  readonly fluidVolumeM3: number;
  /** Leakage of the branch's users (servo valves, seals) to return, m³/s per Pa. */
  readonly leakageM3sPerPa: number;
  /** True: an isolation valve the package opens/closes (closed at reset). */
  readonly isolationValve?: boolean;
}

export interface PumpSpec {
  readonly id: string;
  readonly circuitId: string;
  /** Flow at full displacement and rated drive speed, m³/s. */
  readonly ratedFlowM3s: number;
  /** Compensator setpoint (zero flow) and band below it over which displacement reduces, Pa. */
  readonly compensatorPressurePa: number;
  readonly compensatorBandPa: number;
  /** Drive: an engine's core speed fraction (relative to the rated speed), or the emergency unit. */
  readonly drive: { readonly kind: "engine"; readonly engineId: string; readonly ratedSpeedFraction: number } | { readonly kind: "emergency" };
}

export interface AccumulatorSpec {
  readonly id: string;
  /** Circuit or branch the accumulator sits on. */
  readonly circuitId: string;
  /** Gas volume at precharge, m³, and precharge pressure, Pa. */
  readonly gasVolumeM3: number;
  readonly prechargePa: number;
}

/** A utility load: draws `flowM3sAtFull` × activity (0..1) × pressure fraction from its node. */
export interface ConsumerSpec {
  readonly id: string;
  /** Circuit or branch. */
  readonly nodeId: string;
  readonly flowM3sAtFull: number;
  /** Fraction of the hydraulic power dissipated as heat in the fluid (valve throttling, motor losses). */
  readonly heatFraction?: number;
}

/** Emergency power unit (e.g. the F-16 EPU): one machine; starts on a trigger, finite endurance. */
export interface EmergencyUnitSpec {
  readonly id: string;
  /** Starts automatically when every listed circuit is below this pressure. */
  readonly autoStartWhenAllBelowPa: number;
  readonly autoStartCircuits: readonly string[];
  readonly startDelayS: number;
  readonly enduranceS: number;
}

export interface ActuatorHydraulics {
  /** Chambers and the circuit or branch that feeds each; displacement = fluid volume per degree of surface travel, m³/deg. */
  readonly chambers: readonly { readonly circuitId: string; readonly displacementM3PerDeg: number }[];
  /** Aerodynamic hinge load: fraction k of full-pressure force capacity at q̄_ref and full deflection (see header). */
  readonly hingeLoad: { readonly loadFractionAtReference: number; readonly referenceDynamicPressurePa: number };
}

export interface HydraulicInstallation {
  readonly circuits: readonly CircuitSpec[];
  readonly branches?: readonly BranchSpec[];
  readonly pumps: readonly PumpSpec[];
  readonly accumulators: readonly AccumulatorSpec[];
  readonly consumers?: readonly ConsumerSpec[];
  readonly emergencyUnit?: EmergencyUnitSpec;
  /** Actuators powered by this network, by control-surface id. */
  readonly actuators: Readonly<Record<string, ActuatorHydraulics>>;
}

/** `circuit-leak`: internal leakage (returns to the reservoir). `external-leak`: fluid lost overboard (drains the reservoir). */
export type HydraulicFault =
  | { readonly kind: "pump-failed"; readonly pumpId: string }
  | { readonly kind: "circuit-leak"; readonly circuitId: string; readonly leakM3sPerPa: number }
  | { readonly kind: "external-leak"; readonly circuitId: string; readonly leakM3sPerPa: number };

export interface CircuitState {
  readonly id: string;
  readonly pressurePa: number;
  readonly pumpFlowM3s: number;
  readonly demandFlowM3s: number;
  /** Fluid stored in accumulators on the circuit itself (not its branches), m³. */
  readonly accumulatorFluidM3: number;
  readonly reservoirM3?: number;
  readonly reservoirFraction?: number;
  readonly temperatureK?: number;
  readonly coolerHeatW?: number;
  readonly coolerBypassed?: boolean;
  /** Thermal-bypass valve: fraction of return flow sent through the cooler (0 = full bypass). */
  readonly coolerValveFraction?: number;
  /** Flow through the relief (dump and relief) valve, m³/s (> 0 = valve cracked open). */
  readonly reliefFlowM3s: number;
  /** Total return flow to the reservoir (users, leakage, relief), m³/s. */
  readonly returnFlowM3s: number;
}

export interface BranchState {
  readonly id: string;
  readonly circuitId: string;
  readonly pressurePa: number;
  readonly open: boolean;
  /** Flow entering through the check valve, m³/s. */
  readonly chargeFlowM3s: number;
  readonly accumulatorFluidM3: number;
}

export interface HydraulicSnapshot {
  readonly circuits: readonly CircuitState[];
  readonly branches?: readonly BranchState[];
  readonly consumers?: readonly { readonly id: string; readonly nodeId: string; readonly flowM3s: number }[];
  readonly emergencyUnit?: { readonly state: "off" | "starting" | "running" | "depleted"; readonly remainingS: number };
  readonly faults: readonly HydraulicFault[];
}

export interface HydraulicStepOptions {
  /** Consumer activity 0..1 by consumer id (absent = 0). */
  readonly consumerDemand?: Readonly<Record<string, number>>;
  /** Cooler per circuit: heat-sink temperature and conductance (e.g. fuel flow × cp). */
  readonly cooling?: (circuitId: string) => { readonly sinkK: number; readonly conductanceWPerK: number } | undefined;
  readonly ambientK?: number;
}

const SUBSTEPS = 8;

/** Achievable actuator speed fraction from chamber pressure fractions and a signed hinge-load fraction (see header). */
export function actuatorRateFraction(pressureFractions: readonly number[], loadFraction: number): number {
  if (pressureFractions.length === 0) return 1;
  const F = pressureFractions.reduce((a, p) => a + Math.max(0, Math.min(1, p)), 0) / pressureFractions.length;
  if (F <= 1e-6) return 0;
  return Math.min(1, Math.sqrt(Math.max(0, 1 - loadFraction / F)));
}

/** Flight condition the hinge load depends on. */
export interface HingeContext {
  readonly dynamicPressurePa: number;
  readonly deflectionDeg: number;
  readonly limitDeg: number;
  /** True when the commanded motion increases |deflection| (load opposes); false when returning (load aids). */
  readonly movingAwayFromNeutral: boolean;
}

/** Signed hinge-load fraction for an actuator in a flight condition. */
export function hingeLoadFraction(a: ActuatorHydraulics, c: HingeContext | undefined): number {
  if (!c) return 0;
  const magnitude = a.hingeLoad.loadFractionAtReference * (Math.max(0, c.dynamicPressurePa) / a.hingeLoad.referenceDynamicPressurePa) * Math.min(1, Math.abs(c.deflectionDeg) / Math.max(1e-6, c.limitDeg));
  return c.movingAwayFromNeutral ? magnitude : -magnitude;
}

const accFluid = (a: AccumulatorSpec, P: number) => (P > a.prechargePa ? a.gasVolumeM3 * (1 - a.prechargePa / P) : 0);
const accCompliance = (a: AccumulatorSpec, P: number) => (P > a.prechargePa ? (a.gasVolumeM3 * a.prechargePa) / (P * P) : 0);

export class HydraulicNetwork {
  private pressure = new Map<string, number>();
  private pumpFlow = new Map<string, number>();
  private demand = new Map<string, number>();
  private chargeFlow = new Map<string, number>();
  private consumerFlow = new Map<string, number>();
  private reservoir = new Map<string, number>();
  private temperature = new Map<string, number>();
  private coolerW = new Map<string, number>();
  private bypassed = new Map<string, boolean>();
  private coolerFraction = new Map<string, number>();
  private reliefFlow = new Map<string, number>();
  private returnFlow = new Map<string, number>();
  private valveOpen = new Map<string, boolean>();
  private faults: HydraulicFault[] = [];
  private eu: { state: "off" | "starting" | "running" | "depleted"; t: number; remaining: number } = { state: "off", t: 0, remaining: 0 };
  private readonly branches: readonly BranchSpec[];
  private readonly nominal = new Map<string, number>();
  private readonly circuitOf = new Map<string, string>();

  public constructor(public readonly installation: HydraulicInstallation) {
    this.branches = installation.branches ?? [];
    for (const c of installation.circuits) { this.nominal.set(c.id, c.nominalPressurePa); this.circuitOf.set(c.id, c.id); }
    for (const b of this.branches) {
      const parent = installation.circuits.find((c) => c.id === b.circuitId);
      if (!parent) throw new Error(`Branch ${b.id}: unknown circuit ${b.circuitId}`);
      this.nominal.set(b.id, parent.nominalPressurePa); this.circuitOf.set(b.id, parent.id);
    }
    const nodes = new Set(this.nominal.keys());
    for (const a of installation.accumulators) if (!nodes.has(a.circuitId)) throw new Error(`Accumulator ${a.id}: unknown node ${a.circuitId}`);
    for (const c of installation.consumers ?? []) if (!nodes.has(c.nodeId)) throw new Error(`Consumer ${c.id}: unknown node ${c.nodeId}`);
    for (const [id, a] of Object.entries(installation.actuators)) for (const ch of a.chambers) if (!nodes.has(ch.circuitId)) throw new Error(`Actuator ${id}: unknown node ${ch.circuitId}`);
    this.reset(true);
  }

  /** Start pressurised (engines running) or depressurised. */
  public reset(pressurised: boolean, ambientK = 288.15): void {
    for (const id of this.nominal.keys()) { this.pressure.set(id, pressurised ? this.nominal.get(id)! : 0); this.pumpFlow.set(id, 0); this.demand.set(id, 0); this.chargeFlow.set(id, 0); }
    for (const c of this.installation.circuits) {
      if (c.reservoirM3 !== undefined) this.reservoir.set(c.id, c.reservoirM3 + (pressurised ? 0 : this.storedFluid(c.id, () => c.nominalPressurePa)));
      this.temperature.set(c.id, ambientK); this.coolerW.set(c.id, 0); this.bypassed.set(c.id, true);
    }
    for (const b of this.branches) this.valveOpen.set(b.id, !b.isolationValve);
    this.consumerFlow.clear();
    this.faults = [];
    this.externalStart = false;
    this.eu = { state: "off", t: 0, remaining: this.installation.emergencyUnit?.enduranceS ?? 0 };
  }

  public setFaults(faults: readonly HydraulicFault[]): void {
    this.faults = [...faults];
  }

  /** Open or close a branch's isolation valve (package logic). */
  public setValve(branchId: string, open: boolean): void {
    if (this.branches.some((b) => b.id === branchId && b.isolationValve)) this.valveOpen.set(branchId, open);
  }

  /** Pressure of a circuit or branch, Pa. */
  public pressurePa(nodeId: string): number {
    return this.pressure.get(nodeId) ?? 0;
  }

  /** Pressure of a circuit or branch as a fraction of its nominal pressure (0 for unknown ids). */
  public supplyFraction(nodeId: string): number {
    const n = this.nominal.get(nodeId);
    return n ? Math.min(1, this.pressurePa(nodeId) / n) : 0;
  }

  /** Speed fraction available to an actuator from its chambers' nodes right now, under its hinge load. */
  public rateFraction(surfaceId: string, hinge?: HingeContext): number {
    const a = this.installation.actuators[surfaceId];
    if (!a) return 1;
    return actuatorRateFraction(a.chambers.map((ch) => this.pressurePa(ch.circuitId) / (this.nominal.get(ch.circuitId) ?? 1)), hingeLoadFraction(a, hinge));
  }

  private storedFluid(circuitId: string, P: (nodeId: string) => number): number {
    let v = 0;
    for (const a of this.installation.accumulators) if (this.circuitOf.get(a.circuitId) === circuitId) v += accFluid(a, P(a.circuitId));
    return v;
  }

  /**
   * Advance the network. `driveSpeed(engineId)` is the engine core-speed fraction; `surfaceRates`
   * are the actual surface speeds (deg/s) from the last actuator step, used as flow demand.
   */
  public step(dt: number, driveSpeed: (engineId: string) => number, surfaceRates: Readonly<Record<string, number>>, opts: HydraulicStepOptions = {}): HydraulicSnapshot {
    const inst = this.installation;
    const nodes = [...this.nominal.keys()];
    // Actuator demand per node (m³/s at full pressure).
    const actDemand = new Map(nodes.map((id) => [id, 0]));
    for (const [id, a] of Object.entries(inst.actuators)) {
      const rate = Math.abs(surfaceRates[id] ?? 0);
      for (const ch of a.chambers) actDemand.set(ch.circuitId, (actDemand.get(ch.circuitId) ?? 0) + rate * ch.displacementM3PerDeg);
    }
    const consumers = inst.consumers ?? [];
    const activity = (c: ConsumerSpec) => Math.max(0, Math.min(1, opts.consumerDemand?.[c.id] ?? 0));
    this.stepEmergencyUnit(dt);
    const failedPumps = new Set(this.faults.flatMap((f) => (f.kind === "pump-failed" ? [f.pumpId] : [])));
    const leakOf = (id: string, kind: "circuit-leak" | "external-leak") => this.faults.reduce((s, f) => s + (f.kind === kind && f.circuitId === id ? f.leakM3sPerPa : 0), 0);
    const h = dt / SUBSTEPS;
    const P = new Map(nodes.map((id) => [id, this.pressure.get(id) ?? 0]));
    const heat = new Map(inst.circuits.map((c) => [c.id, 0]));
    const lastRelief = new Map<string, number>(), lastReturn = new Map<string, number>();
    const lastPump = new Map<string, number>(), lastCharge = new Map<string, number>(), lastDemand = new Map<string, number>(), lastConsumer = new Map<string, number>();
    const externalLost = new Map(inst.circuits.map((c) => [c.id, 0]));

    for (let i = 0; i < SUBSTEPS; i++) {
      const net = new Map(nodes.map((id) => [id, 0]));
      lastReturn.clear();
      // Pumps.
      for (const c of inst.circuits) {
        const p = P.get(c.id)!;
        const dry = c.reservoirM3 !== undefined && (this.reservoir.get(c.id) ?? 0) <= 0;
        let q = 0, power = 0;
        if (!dry) for (const pu of inst.pumps) {
          if (pu.circuitId !== c.id || failedPumps.has(pu.id)) continue;
          const speed = pu.drive.kind === "engine" ? Math.max(0, driveSpeed(pu.drive.engineId)) / pu.drive.ratedSpeedFraction : this.eu.state === "running" ? 1 : 0;
          const disp = Math.max(0, Math.min(1, (pu.compensatorPressurePa - p) / pu.compensatorBandPa));
          const qp = pu.ratedFlowM3s * speed * disp;
          q += qp;
          // Compensated pumps still churn at zero stroke: losses scale with speed and pressure (ESTIMATED 5 % of rated power).
          power += qp * p + 0.05 * pu.ratedFlowM3s * speed * p;
        }
        net.set(c.id, net.get(c.id)! + q);
        lastPump.set(c.id, q);
        const eff = c.thermal?.pumpEfficiency ?? 1;
        heat.set(c.id, heat.get(c.id)! + h * power * (1 - eff));
      }
      // Branch charging through check (and isolation) valves, limited so it never overshoots equality.
      for (const b of this.branches) {
        const pp = P.get(b.circuitId)!, pb = P.get(b.id)!;
        let q = 0;
        if (this.valveOpen.get(b.id) && pp > pb) {
          const cp = this.compliance(b.circuitId, pp), cb = this.compliance(b.id, pb);
          const vEq = (pp - pb) / (1 / cp + 1 / cb);
          q = Math.min(b.chargeConductanceM3sPerPa * (pp - pb), vEq / h);
        }
        net.set(b.circuitId, net.get(b.circuitId)! - q);
        net.set(b.id, net.get(b.id)! + q);
        lastCharge.set(b.id, q);
      }
      // Users, leakage, relief.
      for (const id of nodes) {
        const p = P.get(id)!, frac = Math.min(1, p / this.nominal.get(id)!);
        const circuit = this.circuitOf.get(id)!;
        const cs = inst.circuits.find((c) => c.id === id);
        const branch = this.branches.find((b) => b.id === id);
        let qOut = (actDemand.get(id) ?? 0) * frac;
        let throttle = qOut * p * 0.3;
        for (const c of consumers) if (c.nodeId === id) {
          const q = c.flowM3sAtFull * activity(c) * frac;
          qOut += q; throttle += q * p * (c.heatFraction ?? 0.5);
          lastConsumer.set(c.id, q);
        }
        lastDemand.set(id, qOut);
        const internal = ((cs?.leakageM3sPerPa ?? branch?.leakageM3sPerPa ?? 0) + (cs ? leakOf(id, "circuit-leak") : 0)) * p;
        const external = cs ? leakOf(id, "external-leak") * p : 0;
        const relief = cs && p > cs.reliefPressurePa ? (p - cs.reliefPressurePa) * 1e-6 : 0;
        qOut += internal + external + relief;
        if (cs) lastRelief.set(id, relief);
        lastReturn.set(circuit, (lastReturn.get(circuit) ?? 0) + qOut - external);
        externalLost.set(circuit, externalLost.get(circuit)! + external * h);
        heat.set(circuit, heat.get(circuit)! + h * (throttle + (internal + relief) * p));
        net.set(id, net.get(id)! - qOut);
      }
      for (const id of nodes) P.set(id, Math.max(0, P.get(id)! + (h * net.get(id)!) / this.compliance(id, P.get(id)!)));
    }

    // Reservoirs: fluid not stored in accumulators, minus external losses.
    for (const c of inst.circuits) {
      if (c.reservoirM3 === undefined) continue;
      const before = this.storedFluid(c.id, (id) => this.pressure.get(id) ?? 0);
      const after = this.storedFluid(c.id, (id) => P.get(id) ?? 0);
      this.reservoir.set(c.id, Math.max(0, (this.reservoir.get(c.id) ?? 0) - (after - before) - externalLost.get(c.id)!));
    }
    // Fluid temperature.
    const ambient = opts.ambientK ?? 288.15;
    for (const c of inst.circuits) {
      if (!c.thermal) continue;
      let T = this.temperature.get(c.id) ?? ambient;
      const cool = opts.cooling?.(c.id);
      // Thermal bypass valve modulates open over 15 K above its setting (ESTIMATED band).
      const frac = cool ? Math.max(0, Math.min(1, (T - c.thermal.coolerBypassBelowK) / 15)) : 0;
      const bypass = frac <= 0;
      const qCool = cool ? frac * cool.conductanceWPerK * (T - cool.sinkK) : 0;
      const qAmb = c.thermal.ambientConductanceWPerK * (T - ambient);
      T += (heat.get(c.id)! - (qCool + qAmb) * dt) / c.thermal.heatCapacityJPerK;
      this.temperature.set(c.id, T); this.coolerW.set(c.id, qCool); this.bypassed.set(c.id, bypass); this.coolerFraction.set(c.id, frac);
    }
    for (const id of nodes) {
      this.pressure.set(id, P.get(id)!);
      this.pumpFlow.set(id, lastPump.get(id) ?? 0);
      this.demand.set(id, lastDemand.get(id) ?? 0);
      this.chargeFlow.set(id, lastCharge.get(id) ?? 0);
    }
    this.consumerFlow = lastConsumer;
    for (const c of inst.circuits) { this.reliefFlow.set(c.id, lastRelief.get(c.id) ?? 0); this.returnFlow.set(c.id, lastReturn.get(c.id) ?? 0); }
    return this.snapshot();
  }

  private compliance(nodeId: string, p: number): number {
    const c = this.installation.circuits.find((x) => x.id === nodeId);
    const b = c ? undefined : this.branches.find((x) => x.id === nodeId);
    const bulk = c?.bulkModulusPa ?? this.installation.circuits.find((x) => x.id === b?.circuitId)?.bulkModulusPa ?? 1.5e9;
    const v = c?.fluidVolumeM3 ?? b?.fluidVolumeM3 ?? 1e-4;
    let k = v / bulk;
    for (const a of this.installation.accumulators) if (a.circuitId === nodeId) k += accCompliance(a, p);
    return k;
  }

  private externalStart = false;

  /** A package's own logic may start the emergency unit (e.g. on loss of electrical generators). */
  public commandEmergencyStart(): void { this.externalStart = true; }

  private stepEmergencyUnit(dt: number): void {
    const u = this.installation.emergencyUnit;
    if (!u) return;
    const allLow = this.externalStart || u.autoStartCircuits.every((id) => this.pressurePa(id) < u.autoStartWhenAllBelowPa);
    if (this.eu.state === "off" && allLow) this.eu = { ...this.eu, state: "starting", t: 0 };
    if (this.eu.state === "starting") { this.eu.t += dt; if (this.eu.t >= u.startDelayS) this.eu.state = "running"; }
    if (this.eu.state === "running") { this.eu.remaining -= dt; if (this.eu.remaining <= 0) { this.eu.remaining = 0; this.eu.state = "depleted"; } }
  }

  public snapshot(): HydraulicSnapshot {
    const inst = this.installation;
    const accOn = (nodeId: string) => inst.accumulators.filter((a) => a.circuitId === nodeId).reduce((s, a) => s + accFluid(a, this.pressurePa(nodeId)), 0);
    return {
      circuits: inst.circuits.map((c) => ({
        id: c.id, pressurePa: this.pressurePa(c.id), pumpFlowM3s: this.pumpFlow.get(c.id) ?? 0, demandFlowM3s: this.demand.get(c.id) ?? 0, accumulatorFluidM3: accOn(c.id),
        reliefFlowM3s: this.reliefFlow.get(c.id) ?? 0, returnFlowM3s: this.returnFlow.get(c.id) ?? 0,
        ...(c.reservoirM3 !== undefined ? { reservoirM3: this.reservoir.get(c.id) ?? 0, reservoirFraction: (this.reservoir.get(c.id) ?? 0) / c.reservoirM3 } : {}),
        ...(c.thermal ? { temperatureK: this.temperature.get(c.id) ?? 288.15, coolerHeatW: this.coolerW.get(c.id) ?? 0, coolerBypassed: this.bypassed.get(c.id) ?? true, coolerValveFraction: this.coolerFraction.get(c.id) ?? 0 } : {})
      })),
      ...(this.branches.length ? { branches: this.branches.map((b) => ({ id: b.id, circuitId: b.circuitId, pressurePa: this.pressurePa(b.id), open: this.valveOpen.get(b.id) ?? true, chargeFlowM3s: this.chargeFlow.get(b.id) ?? 0, accumulatorFluidM3: accOn(b.id) })) } : {}),
      ...(inst.consumers?.length ? { consumers: inst.consumers.map((c) => ({ id: c.id, nodeId: c.nodeId, flowM3s: this.consumerFlow.get(c.id) ?? 0 })) } : {}),
      ...(inst.emergencyUnit ? { emergencyUnit: { state: this.eu.state, remainingS: this.eu.remaining } } : {}),
      faults: [...this.faults]
    };
  }
}
