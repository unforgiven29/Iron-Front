/**
 * F-16C fuel system — this package's own logic on the shared tank physics (systems/fuel).
 *
 * PRIMARY (T.O. GR1F-16CJ-1, Block 50/52+, Section I "Fuel System", figs 1-19, 1-20, 1-22, 1-23;
 * Section III "Fuel Low", "Hot Fuel/Oil or Gravity Feed"; Section V "Fuel System Limitations"),
 * C model (single seat), JP-8:
 *  - Seven internal tanks: L/R internal wing 550 lb each; F-1 + F-2 + forward reservoir 3,250 lb;
 *    A-1 + aft reservoir 2,810 lb; each reservoir 480 lb (total 7,160 lb).
 *  - Two transfer systems: FORWARD = right wing, F-1, F-2, forward reservoir; AFT = left wing, A-1,
 *    aft reservoir. Fuel flows wings → fuselage tanks → reservoirs; the engine is fed from the
 *    reservoirs only.
 *  - Transfer by two independent methods operating simultaneously: siphoning through standpipes
 *    (needs the reservoir air ejectors, which run on ECS air whenever a reservoir is not full) and
 *    powered transfer pumps (electrical, and fuel-pressure driven by engine motive flow).
 *  - Engine feed: reservoir boost pumps → fuel flow proportioner (FFP), whose twin constant-
 *    displacement pumps are driven by HYDRAULIC SYSTEM A and take equal amounts from each reservoir
 *    to hold the CG; check-valve lines bypass a failed FFP. Then the fuel/oil heat exchanger (cools
 *    hydraulics A and B, the main-generator CSD and the ADG; GE 129 engine oil), the main fuel
 *    shutoff valve (FUEL MASTER; full travel 24 s), the fuel flow transmitter and the engine.
 *  - ENG FEED knob: OFF (electric pumps off, engine fed by the FFP), NORM, AFT (aft pumps on,
 *    crossfeed open: aft fuel to the engine and forward tanks), FWD (the reverse).
 *  - Automatic forward fuel transfer (C): only with FUEL QTY SEL in NORM, total forward fuselage
 *    fuel below 2,800 lb and power on emergency DC bus 2; the trim valve opens when the forward-heavy
 *    differential falls below 300 lb and closes at 450 lb; it never moves fuel aft. Off in gravity feed.
 *  - Gravity feed after loss of the main and standby generators AND failure of hydraulic system A
 *    or the FFP; with gravity feed the engine may flame out when either reservoir empties. With the
 *    standby generator on, one boost pump keeps feeding from the (C) forward reservoir.
 *  - FWD FUEL LOW below 400 lb in the forward reservoir, AFT FUEL LOW below 250 lb in the aft
 *    reservoir (C); lights on emergency DC bus 1. Max fuel flow with one reservoir empty 25,000 pph.
 *  - Negative-g flight with both reservoirs full: AB 10 s, MIL or below 30 s.
 *  - Fuel pumps 1, 2 and 4 on the non-essential DC bus; pumps 3 and 5 on the essential DC bus.
 * ESTIMATED: the split between F-1 and F-2 (the manual gives only F-1 + F-2 + FWD RSVR), tank
 * centroids, which tank each numbered pump sits in, transfer and pump rates, the negative-g usable
 * reservoir fuel (40 kg each: derived so both reservoirs feed ≈10 s at AB and ≈30 s at MIL, the
 * Section V limits), the trim-valve and crossfeed rates, the heat-exchanger loads, tank heating
 * from the airframe skin, and the FUEL HOT threshold (the manual gives none).
 * Not modelled: external tanks/CFTs (no stores model yet), refuelling, tank pressurisation and
 * inerting effects on fuel (switch states are reported only), fuel quantity gauge errors.
 */
import type { Vector3 } from "../../../core/coordinates/CoordinateFrames.js";
import { TankSet, type FuelComponents, type FuelStepInput, type FuelSystemModel, type TankSpec } from "../../../systems/fuel/FuelTanks.js";
import { F16_SWITCHES } from "./F16Switches.js";

const LB = 0.45359237;
const PSI = 6894.757;
const POS: Record<string, Vector3> = {
  f1: [2.55, 0, -0.3], f2: [1.45, 0, -0.3], fwdReservoir: [0.4, 0, -0.2], aftReservoir: [-0.4, 0, -0.2], a1: [-1.6, 0, -0.3],
  wingL: [-0.3, -1.6, 0], wingR: [-0.3, 1.6, 0]
};
/** Capacities, lb JP-8 (fig 1-22, C). F-1/F-2 split ESTIMATED (sum 2,770 lb is primary). */
export const F16_TANK_LB = Object.freeze({ f1: 1385, f2: 1385, fwdReservoir: 480, aftReservoir: 480, a1: 2330, wingL: 550, wingR: 550 } as Record<string, number>);

export const F16_FUEL = Object.freeze({
  fwdLowLb: 400, aftLowLb: 250, oneReservoirMaxPph: 25_000, autoTransferBelowLb: 2800, trimOpenBelowLb: 300, trimCloseAtLb: 450,
  mainValveTravelS: 24, ffpMinPressurePa: 1000 * PSI,
  // ESTIMATED
  siphonKgS: 4, electricTransferKgS: 1.5, motiveTransferKgS: 1.5, crossfeedKgS: 1.5, trimValveKgS: 1.0,
  negativeGUsableKg: 40, fuelHotK: 383, tankThermalTimeS: 900, fuelCpJKgK: 2010
});
const F = F16_FUEL;

export function f16TankSpecs(): TankSpec[] {
  return Object.keys(F16_TANK_LB).map((id) => ({ id, capacityKg: F16_TANK_LB[id]! * LB, unusableKg: 0, positionBodyM: POS[id]! }));
}

/** Electric pumps: power bus and which ENG FEED positions energise them (tank assignment ESTIMATED). */
const ELECTRIC_PUMPS = [
  { id: "boost.fwd", bus: "dc.essential", side: "fwd" as const },
  { id: "boost.aft", bus: "dc.nonessential", side: "aft" as const },
  { id: "xfer.f1", bus: "dc.nonessential", side: "fwd" as const },
  { id: "xfer.wingR", bus: "dc.nonessential", side: "fwd" as const },
  { id: "xfer.a1", bus: "dc.essential", side: "aft" as const }
];

export function f16FuelSystem(): FuelSystemModel {
  const tanks = new TankSet(f16TankSpecs());
  let feedOk = true, mainValve = 1, trimOpen = false, tankK = 288.15, feedK = 288.15;
  const pocketUsed = { fwd: 0, aft: 0 };
  let comps: FuelComponents = { pumps: [], valves: [], flows: [] };
  const fwdLb = () => (tanks.kg("f1") + tanks.kg("f2") + tanks.kg("fwdReservoir")) / LB;
  const aftLb = () => (tanks.kg("a1") + tanks.kg("aftReservoir")) / LB;

  const reset = () => {
    for (const s of f16TankSpecs()) tanks.set(s.id, s.capacityKg);
    feedOk = true; mainValve = 1; trimOpen = false; tankK = feedK = 288.15; pocketUsed.fwd = pocketUsed.aft = 0;
    comps = { pumps: [], valves: [], flows: [] };
  };

  return {
    tanks,
    reset,
    engineFuelAvailable: () => feedOk,
    // Lights are owned by the package monitor (F16Monitor.ts), which reads the indications below.
    annunciations: () => [],
    components: () => comps,
    step: (input: FuelStepInput, dt: number) => {
      const sw = input.switches ?? {};
      const feedKnob = sw[F16_SWITCHES.engFeed] ?? "NORM";
      const master = (sw[F16_SWITCHES.fuelMaster] ?? "MASTER") === "MASTER";
      const qtyNorm = (sw[F16_SWITCHES.fuelQtySel] ?? "NORM") === "NORM";
      const bus = (id: string) => input.busPowered?.(id) ?? true;
      const n = Math.max(0, ...Object.values(input.engineSpeed));
      const engineRunning = n > 0.5;
      const negG = input.nzG < 0;
      const flows: { from: string; to: string; kgS: number }[] = [];
      const move = (from: string, to: string, rate: number) => { const m = tanks.transfer(from, to, rate, dt); if (m > 0) flows.push({ from, to, kgS: m / dt }); return m; };

      // Electric pumps (ENG FEED knob + their DC bus).
      const sideOn = (side: "fwd" | "aft") => feedKnob === "NORM" || (feedKnob === "AFT" && side === "aft") || (feedKnob === "FWD" && side === "fwd");
      const pumpOn: Record<string, boolean> = {};
      for (const p of ELECTRIC_PUMPS) pumpOn[p.id] = sideOn(p.side) && bus(p.bus);
      // Fuel-pressure-driven transfer pumps run on engine motive flow; ejectors on ECS (engine) air.
      const motive = engineRunning && mainValve > 0.5;
      const ejectors = engineRunning;

      // TRANSFER (stops in negative g: standpipe inlets uncover). Wings first, then fuselage tanks.
      if (!negG) {
        const siphon = ejectors ? F.siphonKgS : 0;
        const path = (from: string, to: string, pumped: number) => move(from, to, siphon + pumped);
        // Forward system.
        path("f2", "fwdReservoir", (pumpOn["xfer.f1"] ? F.electricTransferKgS : 0) + (motive ? F.motiveTransferKgS : 0));
        path("wingR", "f2", pumpOn["xfer.wingR"] ? F.electricTransferKgS : 0);
        path("f1", "f2", pumpOn["xfer.f1"] ? F.electricTransferKgS : 0);
        // Aft system.
        path("a1", "aftReservoir", (pumpOn["xfer.a1"] ? F.electricTransferKgS : 0) + (motive ? F.motiveTransferKgS : 0));
        path("wingL", "a1", pumpOn["xfer.a1"] ? F.electricTransferKgS : 0);
      }

      // FFP (hydraulic system A) and gravity feed.
      const ffp = (input.hydraulicPressurePa?.("A") ?? 21e6) >= F.ffpMinPressurePa;
      const boostFwd = !!pumpOn["boost.fwd"], boostAft = !!pumpOn["boost.aft"];
      const gravity = !ffp && !boostFwd && !boostAft;

      // Crossfeed (ENG FEED AFT/FWD): selected side feeds the engine and the other side's tanks.
      const crossfeed = feedKnob === "AFT" || feedKnob === "FWD";
      if (crossfeed && !negG) {
        if (feedKnob === "AFT" && boostAft) move("aftReservoir", "f2", F.crossfeedKgS);
        if (feedKnob === "FWD" && boostFwd) move("fwdReservoir", "a1", F.crossfeedKgS);
      }

      // Automatic forward transfer through the trim valve (never moves fuel aft).
      const autoAvail = qtyNorm && bus("dc.emergency2") && !gravity && fwdLb() < F.autoTransferBelowLb;
      const diff = fwdLb() - aftLb();
      if (!autoAvail) trimOpen = false;
      else if (diff < F.trimOpenBelowLb) trimOpen = true;
      else if (diff >= F.trimCloseAtLb) trimOpen = false;
      if (trimOpen && !negG) move("a1", "f2", F.trimValveKgS);

      // Main fuel shutoff valve (24 s full travel).
      mainValve = Math.max(0, Math.min(1, mainValve + (master ? 1 : -1) * dt / F.mainValveTravelS));

      // ENGINE FEED.
      let demand = 0;
      for (const v of Object.values(input.engineFlowKgS)) demand += v;
      const empty = (id: string) => tanks.isEmpty(id);
      let ok = mainValve > 0.05;
      let fromFwd = 0, fromAft = 0;
      if (crossfeed && (feedKnob === "AFT" ? boostAft : boostFwd)) {
        if (feedKnob === "AFT") fromAft = demand; else fromFwd = demand;
      } else if (ffp) {
        // Equal draw from each reservoir; with one empty the other feeds through the bypass up to 25,000 pph.
        if (!empty("fwdReservoir") && !empty("aftReservoir")) { fromFwd = demand / 2; fromAft = demand / 2; }
        else if (demand > F.oneReservoirMaxPph * LB / 3600) ok = false;
        else if (!empty("fwdReservoir")) fromFwd = demand; else fromAft = demand;
      } else if (!gravity) {
        // FFP failed: boost pumps push through the bypass check valves.
        const wf = boostFwd && !empty("fwdReservoir") ? 1 : 0, wa = boostAft && !empty("aftReservoir") ? 1 : 0;
        if (wf + wa === 0) ok = false; else { fromFwd = demand * wf / (wf + wa); fromAft = demand * wa / (wf + wa); }
      } else {
        // Gravity feed: both reservoirs, flame-out when either empties (air ingestion); no negative g.
        if (empty("fwdReservoir") || empty("aftReservoir") || input.nzG < 0.2) ok = false;
        fromFwd = demand / 2; fromAft = demand / 2;
      }
      // Negative g: only the fuel kept at the boost-pump inlet is usable (ESTIMATED pocket).
      if (negG) {
        pocketUsed.fwd += fromFwd * dt; pocketUsed.aft += fromAft * dt;
        if ((fromFwd > 0 && pocketUsed.fwd > F.negativeGUsableKg) || (fromAft > 0 && pocketUsed.aft > F.negativeGUsableKg)) ok = false;
      } else if (input.nzG > 0.5) { pocketUsed.fwd = 0; pocketUsed.aft = 0; }
      if (ok) {
        const gf = tanks.draw("fwdReservoir", fromFwd * dt), ga = tanks.draw("aftReservoir", fromAft * dt);
        if (gf + ga < demand * dt - 1e-9) ok = false;
        if (gf > 0) flows.push({ from: "fwdReservoir", to: "f110", kgS: gf / dt });
        if (ga > 0) flows.push({ from: "aftReservoir", to: "f110", kgS: ga / dt });
      }
      feedOk = ok;

      // Fuel temperature: tanks follow the skin (≈ recovery temperature); the heat exchanger adds the
      // hydraulic, CSD/ADG and engine-oil heat to the feed flow (loads ESTIMATED).
      const skinK = input.totalTemperatureK ?? 288.15;
      tankK += (skinK - tankK) * (1 - Math.exp(-dt / F.tankThermalTimeS));
      const hydW = ["A", "B"].reduce((a, c) => a + 3000 * Math.min(1, (input.hydraulicPressurePa?.(c) ?? 0) / 20.7e6), 0);
      const heatW = hydW + 3000 * n + 14000 * n ** 3;
      const target = tankK + heatW / (Math.max(0.03, demand) * F.fuelCpJKgK);
      feedK += (target - feedK) * (1 - Math.exp(-dt / 20));

      const pumps = [
        ...ELECTRIC_PUMPS.map((p) => ({ id: p.id, running: !!pumpOn[p.id], flowKgS: flows.filter((f) => (p.id.startsWith("boost") && f.to === "f110" && f.from === (p.side === "fwd" ? "fwdReservoir" : "aftReservoir"))).reduce((a, f) => a + f.kgS, 0) })),
        { id: "motive.fwd", running: motive, flowKgS: 0 }, { id: "motive.aft", running: motive, flowKgS: 0 },
        { id: "ffp", running: ffp && demand > 0, flowKgS: ffp ? demand : 0 },
        { id: "ejector.fwd", running: ejectors && tanks.spaceKg("fwdReservoir") > 0.1, flowKgS: 0 },
        { id: "ejector.aft", running: ejectors && tanks.spaceKg("aftReservoir") > 0.1, flowKgS: 0 }
      ];
      comps = {
        pumps,
        valves: [{ id: "mainShutoff", open: mainValve > 0.05 }, { id: "crossfeed", open: crossfeed }, { id: "trim", open: trimOpen }, { id: "ffpBypass", open: !ffp }],
        flows,
        indications: {
          mainValvePosition: mainValve, feedFuelTemperatureK: feedK, tankFuelTemperatureK: tankK, gravityFeed: gravity ? 1 : 0, ffpRunning: ffp ? 1 : 0,
          forwardFuselageKg: fwdLb() * LB, aftFuselageKg: aftLb() * LB, autoTransferArmed: autoAvail ? 1 : 0,
          fuelHot: feedK > F.fuelHotK ? 1 : 0, negativeGPocketFwdKg: Math.max(0, F.negativeGUsableKg - pocketUsed.fwd), negativeGPocketAftKg: Math.max(0, F.negativeGUsableKg - pocketUsed.aft)
        }
      };
    }
  };
}
