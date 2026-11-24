/**
 * MiG-29 variable intakes — this package's own dynamic model (GAF T.O. 1F-MIG29-1, "Engine air
 * intake system", "Air intake louvers", "Variable ramps system operation").
 *
 * PRIMARY behaviour:
 *  - Forward ramp hydraulically positioned (MAIN system). No hydraulic pressure → ramps move to
 *    maximum duct opening. Engine start / ground below ≈108 KIAS → forward ramp fully extended,
 *    closing the duct (FOD protection); it retracts to fully open at ≈108 KIAS on take-off; it
 *    is completely retracted with the gear extended in the landing.
 *  - In flight (gear up) three travel schedules limit the wedge to 0–35 %, 0–60 %, 0–100 %.
 *  - Spring-loaded upper louvers open by engine suction while the forward ramp closes the duct; in
 *    flight they may open intermittently below M 0.3 at IDLE and below M 0.6 at MIL.
 * ESTIMATED: the Mach breakpoints of the three schedules (chart FO-6 not available), ramp rate,
 * the distortion index (AoA / sideslip / off-schedule ramp) and the louver-mode recovery.
 */
import type { InletModel, InletState } from "../../../physics/propulsion/components/Inlet.js";
import { milE5008bRecovery, normalShockRecovery } from "../../../physics/propulsion/components/Inlet.js";
import type { IntakeContext } from "../common/AircraftDefinition.js";
import { MIG29_ENGINE as E, MIG29_HYDRAULICS as H } from "./MiG29Data.js";

const KT = 0.514444, DEG = 180 / Math.PI;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** Ramp actuator rate, fraction of travel per second (ESTIMATED). */
const RAMP_RATE = 0.5;

/** Estimated schedule: which travel schedule is active and the wedge extension it asks for. */
export function rampSchedule(mach: number): { schedule: number; extension: number } {
  if (mach < 1.0) return { schedule: 3, extension: 0 };
  if (mach < 1.5) return { schedule: 3, extension: 0.35 * clamp01((mach - 1.0) / 0.5) };
  if (mach < 1.9) return { schedule: 2, extension: 0.35 + 0.25 * clamp01((mach - 1.5) / 0.4) };
  return { schedule: 1, extension: 0.6 + 0.4 * clamp01((mach - 1.9) / 0.45) };
}

export function mig29IntakeSystem(engineIds: readonly string[]) {
  const ramp = new Map<string, number>();
  const reset = () => { for (const id of engineIds) ramp.set(id, 0); };
  reset();
  return {
    reset,
    step: (ctx: IntakeContext, dt: number): Readonly<Record<string, InletState>> => {
      const s = ctx.sensors, kias = Math.sqrt((2 * s.dynamicPressurePa) / 1.225) / KT;
      const hydOk = ctx.hydraulicPressurePa("main") > H.lowPressurePa.value;
      const out: Record<string, InletState> = {};
      for (const id of engineIds) {
        const n = ctx.engineSpeed(id), running = n > 0.35;
        let target: number, mode: string;
        if (!hydOk) { target = 0; mode = "NO HYD"; }
        else if (s.weightOnWheels && kias < E.intakeRampOpenKias.value && running) { target = 1; mode = "FOD"; }
        else if (ctx.gearDown) { target = 0; mode = s.weightOnWheels ? "T/O" : "LDG"; }
        else { const sch = rampSchedule(s.mach); target = sch.extension; mode = `SCHED ${sch.schedule}`; }
        const r0 = ramp.get(id) ?? 0, r = r0 + Math.max(-RAMP_RATE * dt, Math.min(RAMP_RATE * dt, target - r0));
        ramp.set(id, r);
        // Louvers: sucked open while the duct is (nearly) closed; in flight intermittently at low Mach and power.
        const power = clamp01(ctx.throttle / 0.77);
        const auxOpen = running && (r > 0.8 || (!s.weightOnWheels && s.mach < 0.3 + 0.3 * power && kias < 250));
        // Distortion: high AoA / sideslip and a ramp off its schedule (ESTIMATED index).
        const offSchedule = !s.weightOnWheels && !ctx.gearDown ? Math.abs(r - rampSchedule(s.mach).extension) : 0;
        const distortion = clamp01(Math.max(0, Math.abs(s.alphaRad * DEG) - 20) / 25 + Math.max(0, Math.abs(s.betaRad * DEG) - 6) / 15 + (s.mach > 1 ? 2 * offSchedule : 0));
        out[id] = { rampExtension: r, rampScheduled: target, auxOpen, mode, distortion };
      }
      return out;
    }
  };
}

/** Pressure recovery from the live intake state. */
export function mig29Intake(): InletModel {
  return {
    kind: "mig29-variable-ramp",
    recovery: (mach, c) => {
      const st = c?.state;
      if (!st) return c?.weightOnWheels && c.equivalentAirspeedMps < E.intakeRampOpenKias.value * KT ? E.louverModeRecovery.value : milE5008bRecovery(mach);
      // Duct closed by the forward ramp: the engine breathes through the louvers.
      if (st.rampExtension > 0.8) return E.louverModeRecovery.value;
      if (mach <= 1) return 1;
      // Supersonic: oblique-shock recovery when the ramp is on schedule, falling to a single normal
      // shock (pitot intake) as it falls short of the schedule.
      const scheduled = Math.max(1e-3, rampSchedule(mach).extension);
      const onSchedule = clamp01(st.rampExtension / scheduled);
      return normalShockRecovery(mach) + (milE5008bRecovery(mach) - normalShockRecovery(mach)) * onSchedule;
    }
  };
}
