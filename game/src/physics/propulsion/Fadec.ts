/**
 * Full-authority digital engine control (FADEC) for an afterburning turbofan.
 *
 * Owner: physics/propulsion. Platform-neutral: the engine package supplies a FadecSchedule
 * (throttle map, limits, acceleration/deceleration schedules, afterburner sequencing and the
 * backup-mode behaviour) with provenance. Nothing here names an engine or aircraft.
 *
 * Signal flow each step (the pilot never commands fuel directly):
 *   throttle (power-lever angle) → speed demand from the throttle map
 *     → limiters: max physical speed, max corrected speed, compressor-exit temperature (T3),
 *       turbine-inlet temperature, minimum burner pressure (raises idle at altitude)
 *     → acceleration / deceleration schedule (rate limits that protect stall and flameout margin)
 *     → speed demand to the rotor
 *   nozzle throat → opened to whatever the engine's flow needs ("auto"); if it cannot pass the flow
 *     (held closed, or at full open) the turbine runs hotter (cycle back-pressure matching) and
 *     the turbine-temperature limiter slows the engine
 *   afterburner request → light-off permission (core at max, burner pressure, light-off delay)
 *     → zone rate limit → afterburner demand
 *
 * The temperature and pressure limiters are MODEL-BASED: like modern engine controls, the FADEC
 * carries an on-board model of the engine (the shared cycle in MixedFlowTurbofan.ts) and finds
 * the highest speed that keeps each limited quantity inside its limit.
 *
 * Modes: "primary" (digital control, full authority) and "backup" (a degraded mode such as a
 * hydromechanical secondary control: speed cap, slower acceleration, afterburner optionally
 * inhibited). A package maps its cockpit switch onto these.
 *
 * Not modelled: surge/stall itself (only the margin-protecting schedules), the nozzle's effect
 * on the fan operating line other than the area limiter, idle nozzle opening, fault detection and automatic transfer to backup,
 * relight/airstart, fuel-system pressures.
 */
import { lookup1D, type Table1D } from "../aerodynamics/Tables.js";
import type { ThroatCommand } from "./components/Nozzle.js";
import { solveCycle, type Ambient, type CycleResult, type TurbofanDesign } from "./MixedFlowTurbofan.js";

export type FadecMode = "primary" | "backup";

export interface FadecSchedule {
  /** Throttle position (0..1) of the dry-power / afterburner detent. */
  readonly afterburnerDetentThrottle: number;
  /** Physical spool speed (fraction of design) at idle, sea level. */
  readonly idleSpeed: number;
  /**
   * Optional throttle map from engine data: dry throttle fraction (0 = idle, 1 = MIL) → CORRECTED
   * spool speed. Without it the map is linear in physical speed from idle to max.
   */
  readonly dryThrottleCorrectedSpeed?: Table1D;
  /** Physical spool speed at maximum dry power (MIL). */
  readonly maxPhysicalSpeed: number;
  /** Corrected-speed limit (fraction of design); protects the fan on cold, fast days. */
  readonly maxCorrectedSpeed: number;
  /** Acceleration and deceleration schedules: max change of speed demand, fraction per second. */
  readonly accelRatePerS: number;
  readonly decelRatePerS: number;
  /** Compressor-exit total-temperature limit, K (optional). */
  readonly maxCompressorExitTemperatureK?: number;
  /** Turbine-inlet temperature limit, K (optional). */
  readonly maxTurbineInletTemperatureK?: number;
  /** Minimum compressor-exit (burner) pressure for stable combustion, Pa: raises idle at altitude (optional). */
  readonly minBurnerPressurePa?: number;
  /** Afterburner: minimum physical speed (fraction of the max) before light-off is permitted. */
  readonly afterburnerMinSpeedFraction: number;
  /** Afterburner: minimum burner pressure for light-off, Pa (optional light-off envelope). */
  readonly afterburnerMinBurnerPressurePa?: number;
  readonly afterburnerLightDelayS: number;
  /** Afterburner fraction rate, 1/s (zone sequencing, simplified to a rate). */
  readonly afterburnerRatePerS: number;
  /** Degraded/backup mode behaviour. */
  readonly backup: {
    readonly maxPhysicalSpeed: number;
    readonly accelRatePerS: number;
    readonly afterburnerInhibited: boolean;
    /** Backup control holds the nozzle throat closed (minimum area). */
    readonly nozzleClosed: boolean;
  };
}

export interface FadecSensors {
  readonly ambient: Ambient;
  /** Measured physical spool speed, fraction of design. */
  readonly spoolSpeed: number;
  readonly fuelAvailable: boolean;
}

export type FadecLimit = "nozzle-area" | "max-speed" | "corrected-speed" | "compressor-exit-temperature" | "turbine-inlet-temperature" | "min-burner-pressure" | "acceleration" | "deceleration" | "afterburner-inhibited" | "afterburner-envelope";

export interface FadecOutput {
  readonly mode: FadecMode;
  /** Physical spool speed demand to the rotor, fraction of design. */
  readonly speedDemand: number;
  /** Afterburner demand, 0..1. */
  readonly afterburnerDemand: number;
  /** Nozzle throat command. */
  readonly throat: ThroatCommand;
  /** Steady-state speed the throttle asks for, after limiters but before rate limits. */
  readonly scheduledSpeed: number;
  /** Limiters currently holding the demand below what the throttle asks for. */
  readonly activeLimits: readonly FadecLimit[];
}

const T_STD = 288.15;
const thetaOf = (a: Ambient) => (a.temperatureK * (1 + 0.2 * a.mach * a.mach)) / T_STD;

/** Highest physical speed in [lo, hi] for which `ok(cycle)` holds (bisection on the on-board model). */
function highestSpeed(design: TurbofanDesign, ambient: Ambient, ab: number, throat: ThroatCommand, lo: number, hi: number, ok: (c: CycleResult) => boolean): number {
  const theta = thetaOf(ambient);
  const at = (n: number) => solveCycle(design, ambient, n / Math.sqrt(theta), ab, { throat });
  if (ok(at(hi))) return hi;
  if (!ok(at(lo))) return lo;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (ok(at(mid))) lo = mid; else hi = mid;
  }
  return lo;
}

/** Lowest physical speed in [lo, hi] for which `ok(cycle)` holds. */
function lowestSpeed(design: TurbofanDesign, ambient: Ambient, lo: number, hi: number, ok: (c: CycleResult) => boolean): number {
  const theta = thetaOf(ambient);
  const at = (n: number) => solveCycle(design, ambient, n / Math.sqrt(theta), 0);
  if (ok(at(lo))) return lo;
  if (!ok(at(hi))) return hi;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (ok(at(mid))) hi = mid; else lo = mid;
  }
  return hi;
}

/**
 * Steady-state scheduling (no rate limits): the speed and afterburner fraction the FADEC settles
 * at for a throttle position. Pure; used by the controller and by steady performance tools.
 */
export function scheduleSteadyState(design: TurbofanDesign, s: FadecSchedule, mode: FadecMode, throttle: number, ambient: Ambient): { speed: number; afterburner: number; throat: ThroatCommand; limits: FadecLimit[] } {
  const limits: FadecLimit[] = [];
  const t = Math.max(0, Math.min(1, throttle));
  const maxPhys = mode === "backup" ? s.backup.maxPhysicalSpeed : s.maxPhysicalSpeed;
  // Throttle map: linear idle → max over the dry range.
  const dry = Math.min(1, t / s.afterburnerDetentThrottle);
  const theta0 = thetaOf(ambient);
  let speed: number;
  if (s.dryThrottleCorrectedSpeed) {
    const wanted = lookup1D(s.dryThrottleCorrectedSpeed, dry).value * Math.sqrt(theta0);
    speed = Math.min(maxPhys, wanted);
    if (wanted > maxPhys + 1e-9) limits.push("max-speed");
  } else {
    speed = s.idleSpeed + (maxPhys - s.idleSpeed) * dry;
  }
  if (mode === "backup" && speed >= maxPhys - 1e-9 && s.maxPhysicalSpeed > maxPhys) limits.push("max-speed");

  // Corrected-speed limit.
  const theta = thetaOf(ambient);
  const correctedCap = s.maxCorrectedSpeed * Math.sqrt(theta);
  if (speed > correctedCap) { speed = correctedCap; limits.push("corrected-speed"); }

  let abRequest = t > s.afterburnerDetentThrottle ? (t - s.afterburnerDetentThrottle) / (1 - s.afterburnerDetentThrottle) : 0;
  if (abRequest > 0 && mode === "backup" && s.backup.afterburnerInhibited) { abRequest = 0; limits.push("afterburner-inhibited"); }

  const throat: ThroatCommand = mode === "backup" && s.backup.nozzleClosed ? { kind: "position", position: 0 } : { kind: "auto" };
  // Model-based limiters (evaluated with the afterburner and nozzle setting the FADEC will run).
  const lo = Math.min(speed, s.idleSpeed * 0.8);
  // A throat too small for the flow is handled by the cycle (back-pressure raises turbine
  // temperature); the turbine-temperature limiter below then slows the engine. Reported here.
  if (s.maxCompressorExitTemperatureK !== undefined) {
    const lim = s.maxCompressorExitTemperatureK;
    const n = highestSpeed(design, ambient, abRequest, throat, lo, speed, (c) => c.compressorExitTemperatureK <= lim);
    if (n < speed - 1e-9) { speed = n; limits.push("compressor-exit-temperature"); }
  }
  if (s.maxTurbineInletTemperatureK !== undefined) {
    const lim = s.maxTurbineInletTemperatureK;
    const n = highestSpeed(design, ambient, abRequest, throat, lo, speed, (c) => c.turbineInletTemperatureK <= lim);
    if (n < speed - 1e-9) { speed = n; limits.push("turbine-inlet-temperature"); }
  }
  if (solveCycle(design, ambient, speed / Math.sqrt(theta), abRequest, { throat }).backPressureLimited) limits.push("nozzle-area");
  // Minimum burner pressure: raise the idle floor at altitude (never above the current maximum).
  if (s.minBurnerPressurePa !== undefined) {
    const min = s.minBurnerPressurePa;
    const floor = lowestSpeed(design, ambient, s.idleSpeed * 0.5, maxPhys, (c) => c.compressorExitPressurePa >= min);
    if (floor > speed + 1e-9) { speed = Math.min(floor, maxPhys); limits.push("min-burner-pressure"); }
  }
  // Afterburner light-off envelope: core at max and enough burner pressure.
  let afterburner = abRequest;
  if (afterburner > 0 && s.afterburnerMinBurnerPressurePa !== undefined) {
    const c = solveCycle(design, ambient, speed / Math.sqrt(theta), 0);
    if (c.compressorExitPressurePa < s.afterburnerMinBurnerPressurePa) { afterburner = 0; limits.push("afterburner-envelope"); }
  }
  return { speed, afterburner, throat, limits };
}

/** Stateful FADEC: steady scheduling plus acceleration/deceleration and afterburner sequencing. */
export class Fadec {
  private mode: FadecMode = "primary";
  private demand: number;
  private ab = 0;
  private abTimer = 0;
  private last: FadecOutput;
  /** Steady schedule cache: the model-based limiters are only re-solved when inputs move. */
  private cache: { key: readonly number[]; mode: FadecMode; result: ReturnType<typeof scheduleSteadyState>; age: number } | undefined;

  public constructor(private readonly design: TurbofanDesign, private readonly schedule: FadecSchedule, initialThrottle: number, initialAmbient: Ambient) {
    this.demand = scheduleSteadyState(design, schedule, "primary", Math.min(initialThrottle, schedule.afterburnerDetentThrottle), initialAmbient).speed;
    this.last = { mode: this.mode, speedDemand: this.demand, afterburnerDemand: 0, throat: { kind: "auto" }, scheduledSpeed: this.demand, activeLimits: [] };
  }

  public get output(): FadecOutput {
    return this.last;
  }

  public get currentMode(): FadecMode {
    return this.mode;
  }

  /** Select primary or backup control. The speed demand carries over (no step on transfer). */
  public setMode(mode: FadecMode): void {
    this.mode = mode;
  }

  /** Initial rotor speed for a start state (steady, dry). */
  public get initialSpeed(): number {
    return this.demand;
  }

  /**
   * Steady scheduling with a cache. Re-solved when throttle moves by 0.002, ambient temperature
   * by 0.2 K, pressure by 0.2 %, Mach by 0.003, the mode changes, or every 0.2 s. Between solves
   * the result is held (well inside the control's own rate limits).
   */
  private steady(throttle: number, ambient: Ambient, dt: number): ReturnType<typeof scheduleSteadyState> {
    const key = [throttle, ambient.temperatureK, ambient.pressurePa, ambient.mach];
    const c = this.cache;
    if (c && c.mode === this.mode && c.age < 0.2
      && Math.abs(key[0]! - c.key[0]!) < 0.002 && Math.abs(key[1]! - c.key[1]!) < 0.2
      && Math.abs(key[2]! - c.key[2]!) < 0.002 * c.key[2]! && Math.abs(key[3]! - c.key[3]!) < 0.003) {
      c.age += dt;
      return c.result;
    }
    const result = scheduleSteadyState(this.design, this.schedule, this.mode, throttle, ambient);
    this.cache = { key, mode: this.mode, result, age: 0 };
    return result;
  }

  public step(throttle: number, sensors: FadecSensors, dt: number): FadecOutput {
    const s = this.schedule;
    if (!sensors.fuelAvailable) {
      this.demand = sensors.spoolSpeed;
      this.ab = 0;
      this.abTimer = 0;
      this.last = { mode: this.mode, speedDemand: sensors.spoolSpeed, afterburnerDemand: 0, throat: { kind: "auto" }, scheduledSpeed: 0, activeLimits: [] };
      return this.last;
    }
    const target = this.steady(throttle, sensors.ambient, dt);
    const limits = [...target.limits];

    // Acceleration / deceleration schedules: rate limits on the speed demand.
    const accel = this.mode === "backup" ? s.backup.accelRatePerS : s.accelRatePerS;
    const up = accel * dt, down = s.decelRatePerS * dt;
    if (target.speed > this.demand + up) { this.demand += up; limits.push("acceleration"); }
    else if (target.speed < this.demand - down) { this.demand -= down; limits.push("deceleration"); }
    else this.demand = target.speed;

    // Afterburner sequencing: light only with the core near its scheduled maximum, after a delay.
    const coreReady = sensors.spoolSpeed >= s.afterburnerMinSpeedFraction * target.speed && this.demand >= target.speed - 1e-6;
    if (target.afterburner > 0 && coreReady) this.abTimer += dt; else this.abTimer = 0;
    const abTarget = this.abTimer >= s.afterburnerLightDelayS ? target.afterburner : 0;
    const rate = s.afterburnerRatePerS * dt;
    this.ab = abTarget > this.ab ? Math.min(abTarget, this.ab + rate) : Math.max(abTarget, this.ab - rate * 2);

    this.last = { mode: this.mode, speedDemand: this.demand, afterburnerDemand: this.ab, throat: target.throat, scheduledSpeed: target.speed, activeLimits: limits };
    return this.last;
  }
}
