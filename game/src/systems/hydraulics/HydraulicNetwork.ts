/**
 * Lumped hydraulic power network (owner: game/systems/hydraulics; spec in
 * game/systems/hydraulics/README.md). Platform-neutral: an aircraft package supplies the
 * installation — circuits, pumps and what drives them, accumulators, an optional emergency
 * power unit and which circuit feeds each actuator chamber — with provenance.
 *
 * Fidelity tier: "lumped circuit". Each circuit is one pressure node:
 *   C(P)·dP/dt = Σ pump flow(P, drive speed) + accumulator discharge − consumer flow − leakage,
 *   C(P) = V/B (fluid compliance) + accumulator gas compliance V_g·P_pre/P² (isothermal).
 * Pumps are pressure-compensated variable-displacement units: full displacement × drive speed
 * below the compensator band, falling linearly to zero flow at the compensator setpoint.
 * Actuator chambers draw flow = displacement × surface speed from their own circuit.
 *
 * Actuator authority (servo-valve physics): a valve meters flow ∝ √(supply − load pressure).
 * With force capacity F (mean of its chambers' pressure fractions, 1 = all chambers at nominal)
 * and the aerodynamic hinge load L as a fraction of full-pressure force, the achievable speed
 * relative to the no-load rating is √(max(0, 1 − L/F)), capped at 1. L comes from the actuator's
 * hinge-load spec: L = k·(q̄/q̄_ref)·(|δ|/δ_max), positive (opposing) when the surface moves away
 * from neutral and negative (aiding) when it moves back. So rates fall at high dynamic pressure
 * and large deflection, a lost chamber (F = ½) costs most where loads are high, and with no
 * pressure the surface holds (hydraulic lock; blow-back is not modelled).
 *
 * Not modelled (declared envelope): line resistance and transients between components, valve
 * spool dynamics, reservoir level/cavitation, fluid temperature and cooling, contamination,
 * hinge-moment loads from the aero model (a constant design load fraction is used instead),
 * electrically operated valves, the EPU's electrical half, surface blow-back under load, and
 * hinge moments from the aero model (the hinge load uses the linear estimate above).
 */

export interface CircuitSpec {
  readonly id: string;
  readonly nominalPressurePa: number;
  /** Pressurised fluid volume (lines, actuators), m³, and fluid bulk modulus, Pa. */
  readonly fluidVolumeM3: number;
  readonly bulkModulusPa: number;
  /** Internal leakage, m³/s per Pa. */
  readonly leakageM3sPerPa: number;
  readonly reliefPressurePa: number;
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
  readonly circuitId: string;
  /** Gas volume at precharge, m³, and precharge pressure, Pa. */
  readonly gasVolumeM3: number;
  readonly prechargePa: number;
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
  /** Chambers and the circuit that feeds each; displacement = fluid volume per degree of surface travel, m³/deg. */
  readonly chambers: readonly { readonly circuitId: string; readonly displacementM3PerDeg: number }[];
  /** Aerodynamic hinge load: fraction k of full-pressure force capacity at q̄_ref and full deflection (see header). */
  readonly hingeLoad: { readonly loadFractionAtReference: number; readonly referenceDynamicPressurePa: number };
}

export interface HydraulicInstallation {
  readonly circuits: readonly CircuitSpec[];
  readonly pumps: readonly PumpSpec[];
  readonly accumulators: readonly AccumulatorSpec[];
  readonly emergencyUnit?: EmergencyUnitSpec;
  /** Actuators powered by this network, by control-surface id. */
  readonly actuators: Readonly<Record<string, ActuatorHydraulics>>;
}

export type HydraulicFault = { readonly kind: "pump-failed"; readonly pumpId: string } | { readonly kind: "circuit-leak"; readonly circuitId: string; readonly leakM3sPerPa: number };

export interface CircuitState {
  readonly id: string;
  readonly pressurePa: number;
  readonly pumpFlowM3s: number;
  readonly demandFlowM3s: number;
  readonly accumulatorFluidM3: number;
}

export interface HydraulicSnapshot {
  readonly circuits: readonly CircuitState[];
  readonly emergencyUnit?: { readonly state: "off" | "starting" | "running" | "depleted"; readonly remainingS: number };
  readonly faults: readonly HydraulicFault[];
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

export class HydraulicNetwork {
  private pressure = new Map<string, number>();
  private pumpFlow = new Map<string, number>();
  private demand = new Map<string, number>();
  private faults: HydraulicFault[] = [];
  private eu: { state: "off" | "starting" | "running" | "depleted"; t: number; remaining: number } = { state: "off", t: 0, remaining: 0 };

  public constructor(public readonly installation: HydraulicInstallation) {
    this.reset(true);
  }

  /** Start pressurised (engines running) or depressurised. */
  public reset(pressurised: boolean): void {
    for (const c of this.installation.circuits) { this.pressure.set(c.id, pressurised ? c.nominalPressurePa : 0); this.pumpFlow.set(c.id, 0); this.demand.set(c.id, 0); }
    this.faults = [];
    this.eu = { state: "off", t: 0, remaining: this.installation.emergencyUnit?.enduranceS ?? 0 };
  }

  public setFaults(faults: readonly HydraulicFault[]): void {
    this.faults = [...faults];
  }

  public pressurePa(circuitId: string): number {
    return this.pressure.get(circuitId) ?? 0;
  }

  /** Speed fraction available to an actuator from its chambers' circuits right now, under its hinge load. */
  public rateFraction(surfaceId: string, hinge?: HingeContext): number {
    const a = this.installation.actuators[surfaceId];
    if (!a) return 1;
    const circuits = new Map(this.installation.circuits.map((c) => [c.id, c]));
    return actuatorRateFraction(a.chambers.map((ch) => this.pressurePa(ch.circuitId) / (circuits.get(ch.circuitId)?.nominalPressurePa ?? 1)), hingeLoadFraction(a, hinge));
  }

  /**
   * Advance the network. `driveSpeed(engineId)` is the engine core-speed fraction; `surfaceRates`
   * are the actual surface speeds (deg/s) from the last actuator step, used as flow demand.
   */
  public step(dt: number, driveSpeed: (engineId: string) => number, surfaceRates: Readonly<Record<string, number>>): HydraulicSnapshot {
    const inst = this.installation;
    // Consumer demand per circuit.
    const demand = new Map(inst.circuits.map((c) => [c.id, 0]));
    for (const [id, a] of Object.entries(inst.actuators)) {
      const rate = Math.abs(surfaceRates[id] ?? 0);
      for (const ch of a.chambers) demand.set(ch.circuitId, (demand.get(ch.circuitId) ?? 0) + rate * ch.displacementM3PerDeg);
    }
    this.stepEmergencyUnit(dt);
    const failedPumps = new Set(this.faults.flatMap((f) => (f.kind === "pump-failed" ? [f.pumpId] : [])));
    const h = dt / SUBSTEPS;
    for (const c of inst.circuits) {
      const pumps = inst.pumps.filter((p) => p.circuitId === c.id && !failedPumps.has(p.id));
      const accs = inst.accumulators.filter((a) => a.circuitId === c.id);
      const extraLeak = this.faults.reduce((s, f) => s + (f.kind === "circuit-leak" && f.circuitId === c.id ? f.leakM3sPerPa : 0), 0);
      let P = this.pressure.get(c.id) ?? 0, qPumpLast = 0;
      for (let i = 0; i < SUBSTEPS; i++) {
        let qPump = 0;
        for (const p of pumps) {
          const speed = p.drive.kind === "engine" ? Math.max(0, driveSpeed(p.drive.engineId)) / p.drive.ratedSpeedFraction : this.eu.state === "running" ? 1 : 0;
          const displacement = Math.max(0, Math.min(1, (p.compensatorPressurePa - P) / p.compensatorBandPa));
          qPump += p.ratedFlowM3s * speed * displacement;
        }
        // Consumers draw less as pressure (and hence actuator speed) falls.
        const qDemand = (demand.get(c.id) ?? 0) * Math.min(1, P / c.nominalPressurePa);
        const qLeak = (c.leakageM3sPerPa + extraLeak) * P;
        const qRelief = P > c.reliefPressurePa ? (P - c.reliefPressurePa) * 1e-6 : 0;
        const compliance = c.fluidVolumeM3 / c.bulkModulusPa + accs.reduce((s, a) => s + (P > a.prechargePa ? (a.gasVolumeM3 * a.prechargePa) / (P * P) : 0), 0);
        P = Math.max(0, P + (h * (qPump - qDemand - qLeak - qRelief)) / compliance);
        qPumpLast = qPump;
      }
      this.pressure.set(c.id, P);
      this.pumpFlow.set(c.id, qPumpLast);
      this.demand.set(c.id, demand.get(c.id) ?? 0);
    }
    return this.snapshot();
  }

  private stepEmergencyUnit(dt: number): void {
    const u = this.installation.emergencyUnit;
    if (!u) return;
    const allLow = u.autoStartCircuits.every((id) => this.pressurePa(id) < u.autoStartWhenAllBelowPa);
    if (this.eu.state === "off" && allLow) this.eu = { ...this.eu, state: "starting", t: 0 };
    if (this.eu.state === "starting") { this.eu.t += dt; if (this.eu.t >= u.startDelayS) this.eu.state = "running"; }
    if (this.eu.state === "running") { this.eu.remaining -= dt; if (this.eu.remaining <= 0) { this.eu.remaining = 0; this.eu.state = "depleted"; } }
  }

  public snapshot(): HydraulicSnapshot {
    const inst = this.installation;
    return {
      circuits: inst.circuits.map((c) => {
        const P = this.pressurePa(c.id);
        const acc = inst.accumulators.filter((a) => a.circuitId === c.id).reduce((s, a) => s + (P > a.prechargePa ? a.gasVolumeM3 * (1 - a.prechargePa / P) : 0), 0);
        return { id: c.id, pressurePa: P, pumpFlowM3s: this.pumpFlow.get(c.id) ?? 0, demandFlowM3s: this.demand.get(c.id) ?? 0, accumulatorFluidM3: acc };
      }),
      ...(inst.emergencyUnit ? { emergencyUnit: { state: this.eu.state, remainingS: this.eu.remaining } } : {}),
      faults: [...this.faults]
    };
  }
}
