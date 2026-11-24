/**
 * F110-GE-129 engine control logic — this package's own DEC / MEC mode logic above the shared FADEC
 * (physics/propulsion/Fadec.ts), per T.O. GR1F-16CJ-1 Section I "Engine GE 129" and Section III
 * "Pilot Fault List - Engine".
 *
 * PRIMARY (manual):
 *  - Modes: PRI (DEC controls main fuel, nozzle, IGVs, VSVs, AB, turbine blade temperature limiting,
 *    min/max compressor discharge pressure, supersonic idle lock-up); HYB VSV (MEC schedules the
 *    compressor VSVs on certain PRI failures); HYB (MEC schedules main fuel flow and VSVs, DEC keeps
 *    AB, nozzle and IGVs): no turbine blade temperature limiting, no VSV reset, fan speed limited,
 *    MIL thrust 90–100 % of PRI, no supersonic lock-up; SEC (MEC only): nozzle closed, AB inhibited,
 *    no temperature limiting, high-energy ignition on, IGVs fully closed, no VSV reset, fan speed
 *    limited, MIL 70–95 % of PRI, no lock-up, SEC caution.
 *  - The DEC selects HYB or HYB VSV, or transfers to SEC, for certain PRI failures, and transfers
 *    to SEC if HYB fails. ENG CONT switch SEC selects SEC manually.
 *  - Supersonic idle lock-up (PRI): throttle retarded below MIL in transonic/supersonic flight →
 *    above M 1.4 rpm falls at most ≈15 % below MIL rpm, then follows Mach down to normal flight
 *    idle at ≈M 1.1 (CADC Mach). Lost with the CADC Mach signal (ENG MACH FAIL PFL).
 *  - PFLs: ENG HYB MODE (PRI fuel-flow scheduling problem), ENG A/B FAIL (AB inhibited), ENG MACH
 *    FAIL (supersonic stall protection inoperative), ENG EMS FAIL, ENG BUS FAIL, ENG LUBE LOW (oil
 *    quantity below ≈40 % for 15 s). A PFL lights ENGINE FAULT, which goes off when acknowledged
 *    (F-ACK); the PFL stays in the fault list.
 *  - Engine alternator failure: it powers the DEC and supplies the RPM signal → DEC lost (SEC),
 *    RPM indication zero.
 * ESTIMATED: the speed limits standing for "MIL 90–100 %" (HYB, 0.98 of MIL speed) and "70–95 %"
 * (SEC, 0.95), the time the DEC takes to detect a failure and transfer (0.3 s), the HYB-failure
 * transfer time (1 s), the oil-leak rate of the test fault. Which hardware fault leads to which mode
 * is modelled through simulation test faults; real DEC fault detection logic is not public.
 */
import type { EngineControlOutput, MonitorContext } from "../common/AircraftDefinition.js";
import { F110_CONTROL } from "./F110Engine.js";
import { F16_SWITCHES } from "./F16Switches.js";

export type F110Mode = "PRI" | "HYB VSV" | "HYB" | "SEC";

/** Simulation test faults (not a real cockpit control). */
export const F110_TEST_FAULTS = Object.freeze({
  NONE: [], "PRI FUEL SCHED": ["priFuel"], "VSV SCHED": ["vsv"], "PRI + HYB": ["priFuel", "hyb"], "DEC FAIL": ["dec"],
  "AB FAIL": ["ab"], "MACH SIGNAL": ["mach"], "OIL LEAK": ["oilLeak"], "ALTERNATOR": ["alternator"], "MUX BUS": ["bus"]
} as const);
export type F110Fault = (typeof F110_TEST_FAULTS)[keyof typeof F110_TEST_FAULTS][number];

export const F110_LOGIC = Object.freeze({
  lockupFullMach: 1.4, lockupEndMach: 1.1, lockupRpmBelowMil: 0.15, lubeLowFraction: 0.4, lubeLowDelayS: 15,
  // ESTIMATED
  hybMaxSpeedScale: 0.98, secMaxSpeedScale: 0.95, detectS: 0.3, hybFailTransferS: 1, oilLeakPerS: 1 / 300
});
const L = F110_LOGIC;

export function f110Control(): { step(ctx: MonitorContext, dt: number): EngineControlOutput; reset(): void } {
  let mode: F110Mode = "PRI", faultTimer = 0, hybFailTimer = 0, oil = 1, lubeLowS = 0;
  let pfls = new Set<string>(), unacked = false, lastAck = "OFF", lastFaultKey = "";
  const reset = () => { mode = "PRI"; faultTimer = 0; hybFailTimer = 0; oil = 1; lubeLowS = 0; pfls = new Set(); unacked = false; lastAck = "OFF"; lastFaultKey = ""; };
  return {
    reset,
    step: (ctx, dt) => {
      const sw = ctx.switches;
      const faults = new Set<string>(F110_TEST_FAULTS[(sw[F16_SWITCHES.engineFault] ?? "NONE") as keyof typeof F110_TEST_FAULTS] ?? []);
      const key = [...faults].sort().join(",");
      if (key !== lastFaultKey) { faultTimer = 0; hybFailTimer = 0; lastFaultKey = key; }
      faultTimer += dt;
      const detected = faultTimer >= L.detectS;
      const e = ctx.engines[0];
      const running = !!e && !e.flameout && e.spoolSpeed > 0.3;

      // Mode logic: manual SEC, or the DEC's automatic selection on detected failures.
      const decLost = faults.has("dec") || faults.has("alternator");
      let auto: F110Mode = "PRI";
      if (detected) {
        if (decLost) auto = "SEC";
        else if (faults.has("priFuel")) {
          auto = "HYB";
          if (faults.has("hyb")) { hybFailTimer += dt; if (hybFailTimer >= L.hybFailTransferS) auto = "SEC"; }
        } else if (faults.has("vsv")) auto = "HYB VSV";
      }
      // Once in SEC automatically, the engine stays there until the fault clears (no automatic return).
      mode = sw[F16_SWITCHES.engineControl] === "SEC" ? "SEC" : auto;

      // Oil quantity (test leak) → ENG LUBE LOW after 15 s below ≈40 %.
      if (faults.has("oilLeak") && running) oil = Math.max(0, oil - L.oilLeakPerS * dt);
      lubeLowS = oil < L.lubeLowFraction ? lubeLowS + dt : 0;

      // Pilot fault list (DEC/EMSC detected).
      const now = new Set<string>();
      if (detected && mode === "HYB") now.add("ENG HYB MODE");
      if (detected && faults.has("ab")) now.add("ENG A/B FAIL");
      if (detected && faults.has("mach")) now.add("ENG MACH FAIL");
      if (detected && faults.has("bus")) now.add("ENG BUS FAIL");
      if (detected && decLost) now.add("ENG EMS FAIL");
      if (lubeLowS >= L.lubeLowDelayS) now.add("ENG LUBE LOW");
      for (const p of now) if (!pfls.has(p)) unacked = true;
      pfls = now;
      // ENG BUS FAIL hides the other engine PFLs (manual).
      const shown = pfls.has("ENG BUS FAIL") ? ["ENG BUS FAIL"] : [...pfls];
      // F-ACK: any press acknowledges the ENGINE FAULT caution.
      const ack = sw[F16_SWITCHES.faultAck] ?? "OFF";
      if (ack !== lastAck) unacked = false;
      lastAck = ack;
      if (pfls.size === 0) unacked = false;

      // Supersonic idle lock-up (PRI/HYB VSV with Mach available).
      const mach = ctx.sensors.mach;
      const lockupActive = (mode === "PRI" || mode === "HYB VSV") && !faults.has("mach") && mach > L.lockupEndMach;
      const mil = F110_CONTROL.maxPhysicalSpeed, idle = F110_CONTROL.idleSpeed;
      const lockFloor = lockupActive ? idle + ((mil * (1 - L.lockupRpmBelowMil)) - idle) * Math.min(1, (mach - L.lockupEndMach) / (L.lockupFullMach - L.lockupEndMach)) : undefined;

      const overrides = mode === "SEC" ? { maxSpeedScale: L.secMaxSpeedScale, temperatureLimiting: false }
        : mode === "HYB" ? { maxSpeedScale: L.hybMaxSpeedScale, temperatureLimiting: false, ...(faults.has("ab") ? { afterburnerInhibited: true } : {}) }
        : { ...(lockFloor !== undefined ? { minSpeed: lockFloor } : {}), ...(faults.has("ab") ? { afterburnerInhibited: true } : {}) };
      const modeCode = { PRI: 0, "HYB VSV": 1, HYB: 2, SEC: 3 }[mode];
      return {
        commands: e ? { [e.id]: { mode: mode === "SEC" ? "backup" : "primary", overrides } } : {},
        lights: unacked ? [{ text: "ENGINE FAULT", level: "caution" }] : [],
        faultList: shown,
        indications: {
          engineControlMode: modeCode, supersonicLockup: lockFloor !== undefined ? 1 : 0, lockupFloor: lockFloor ?? 0, oilQuantityFraction: oil,
          vsvResetAvailable: mode === "PRI" ? 1 : 0, temperatureLimiting: mode === "PRI" || mode === "HYB VSV" ? 1 : 0,
          alternatorFailed: faults.has("alternator") ? 1 : 0, engineFaultUnacked: unacked ? 1 : 0
        }
      };
    }
  };
}
