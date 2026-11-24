/**
 * MiG-29 fuel system — this package's own logic on the shared tank physics (systems/fuel).
 *
 * PRIMARY (GAF T.O. 1F-MIG29-1, MiG-29G; product 9.13 applicability not verified; 9.13 adds a
 * spine tank that is NOT modelled):
 *  - Tanks (fig. 1-19C, fully serviced, F-34 at 0.803): tank 1 650 L, tank 2 (engine feed) 900 L,
 *    tank 3 1,800 L, tanks 3A 300 L (two), internal wing tanks 650 L (two), CL tank 1,500 L.
 *    Trapped (unusable) fuel: internal 100 L, CL tank 25 L.
 *  - Sequence (pp. 1-41/1-42): tank 1 turbo pump keeps tank 2 full; CL tank → tank 1 above 80 %
 *    RPM; after ≈250 L from tank 1, tank 3 pumps feed tanks 1 and 2; after ≈200 L from tank 3,
 *    tanks 3A and the wing tanks feed tank 3; when they are empty and ≈600 L have gone from tank 3,
 *    tank 3 stops while another ≈280 L go from tank 1; tank 3 then resumes until empty; then tank 1,
 *    then tank 2. "550 KG REMAIN" when tank 2 falls below 550 kg. CL transfer pauses at negative g
 *    (inertia switch) and above 30,000 ft "may or may not transfer" (modelled as not).
 *  - Fuel is burned only from tank 2 (both engines).
 * ESTIMATED: tank centroids (scaled from the perspective drawing fig. 1-18 on a 17.32 m airframe),
 * pump capacities, distribution of trapped fuel (pro rata to capacity). The fuel accumulator for
 * near-zero-g flight is not modelled.
 */
import type { Vector3 } from "../../../core/coordinates/CoordinateFrames.js";
import { TankSet, type FuelStepInput, type FuelSystemModel, type TankSpec } from "../../../systems/fuel/FuelTanks.js";

export const F34_KG_PER_L = 0.803;
const L = (litres: number) => litres * F34_KG_PER_L;
const INTERNAL_L = 650 + 900 + 1800 + 300 + 650;
const trapped = (litres: number) => L(100 * (litres / INTERNAL_L));

/** Tank centroids relative to the reference CG (x fwd, y right, z down), m — ESTIMATED from fig. 1-18. */
const POS: Record<string, Vector3> = {
  tank1: [3.0, 0, -0.2], tank2: [1.6, 0, -0.3], tank3: [0.2, 0, -0.3],
  tank3A1: [-3.4, -1.2, -0.1], tank3A2: [-3.4, 1.2, -0.1],
  wingL: [-0.6, -2.2, 0.1], wingR: [-0.6, 2.2, 0.1], centerline: [-0.3, 0, 1.0]
};

export function mig29TankSpecs(withCenterline: boolean): TankSpec[] {
  const t = (id: string, litres: number, trappedKg = trapped(litres)): TankSpec => ({ id, capacityKg: L(litres), unusableKg: trappedKg, positionBodyM: POS[id]! });
  return [t("tank1", 650), t("tank2", 900), t("tank3", 1800), t("tank3A1", 150), t("tank3A2", 150), t("wingL", 325), t("wingR", 325),
    ...(withCenterline ? [t("centerline", 1500, L(25))] : [])];
}

/**
 * Pump capacities, kg/s (ESTIMATED). GAF T.O.: transfer to the feed tank exceeds consumption (the
 * excess is dumped back to tank 1 through a relief valve), so the turbo pumps are sized above the
 * two-engine maximum-afterburner fuel flow (≈ 9 kg/s).
 */
const PUMP = { tank1Turbo: 12, tank3Turbo: 12, jet: 2.5, centerline: 5, gravity: 0.4 };
/** Fuel accumulator in tank 3 for near-zero / negative g (ESTIMATED size), kg. */
const ACCUMULATOR_KG = 12;

export function mig29FuelSystem(options: { readonly centerlineTank?: boolean } = {}): FuelSystemModel {
  const withCl = options.centerlineTank ?? false;
  const tanks = new TankSet(mig29TankSpecs(withCl));
  let fromTank1 = 0, fromTank3 = 0, pausePhaseKg = 0, accumulator = ACCUMULATOR_KG;
  let phase: "tank1" | "tank3" | "pause" | "tank3-final" = "tank1";
  let feedOk = true;
  let flows: { from: string; to: string; kgS: number }[] = [];
  let pumps: { id: string; running: boolean; flowKgS: number }[] = [];
  let valves: { id: string; open: boolean }[] = [];
  const cap = (id: string) => tanks.spec(id).capacityKg;
  const outerEmpty = () => ["tank3A1", "tank3A2", "wingL", "wingR"].every((id) => tanks.isEmpty(id));
  return {
    tanks,
    reset: () => {
      for (const s of mig29TankSpecs(withCl)) tanks.set(s.id, s.capacityKg);
      fromTank1 = 0; fromTank3 = 0; pausePhaseKg = 0; phase = "tank1"; feedOk = true; accumulator = ACCUMULATOR_KG; flows = []; pumps = []; valves = [];
    },
    engineFuelAvailable: () => feedOk,
    components: () => ({ pumps, valves, flows }),
    annunciations: () => [
      ...(tanks.kg("tank2") < 550 ? ["550 KG REMAIN"] : []),
      ...(withCl && tanks.isEmpty("centerline") ? ["CL TANK EMPTY"] : []),
      ...(outerEmpty() ? ["WING TANKS EMPTY"] : []),
      ...(!feedOk ? ["NO BOOST"] : [])
    ],
    step: (input: FuelStepInput, dt: number) => {
      flows = [];
      const move = (from: string, to: string, rate: number) => { const kg = tanks.transfer(from, to, rate, dt); if (kg > 0) flows.push({ from, to, kgS: kg / dt }); return kg; };
      // The GBX follows the faster engine (same freewheel rule as the hydraulics/electrics).
      const l = input.engineSpeed["left"] ?? 0, r = input.engineSpeed["right"] ?? 0;
      const gbx = l >= r + 0.07 ? l : r, rpm = Math.max(l, r);
      const active = gbx > 0.5; // active-fuel centrifugal pump on the GBX drives jet pumps and valves
      const dcPower = input.busPowered ? input.busPowered("dc") : true;
      const clValve = withCl && dcPower && rpm >= 0.8 && input.nzG > 0 && input.altitudeM < 30000 * 0.3048 && !tanks.isEmpty("centerline");
      if (clValve) move("centerline", "tank1", PUMP.centerline);
      let t1Turbo = false, t3Turbo = false, jetOuter = false, jetT3 = false;
      if (active) {
        if (fromTank3 >= L(200)) {
          // Jet pumps run together and share tank 3's free space, so left and right drain evenly.
          const outer = ["tank3A1", "tank3A2", "wingL", "wingR"].filter((id) => !tanks.isEmpty(id));
          const room = tanks.spaceKg("tank3");
          for (const id of outer) if (move(id, "tank3", Math.min(PUMP.jet, room / dt / Math.max(1, outer.length))) > 0) jetOuter = true;
        }
        if (phase === "tank1" && fromTank1 >= L(250)) phase = "tank3";
        if (phase === "tank3" && outerEmpty() && fromTank3 >= L(600)) phase = "pause";
        if (phase === "pause" && pausePhaseKg >= L(280)) phase = "tank3-final";
        const tank3Pumping = (phase === "tank3" || phase === "tank3-final") && !tanks.isEmpty("tank3");
        if (tank3Pumping) {
          const holdTank1 = phase === "tank3" ? cap("tank1") - L(250) : cap("tank1") - L(250) - L(280);
          const before3 = tanks.kg("tank3");
          t3Turbo = move("tank3", "tank2", PUMP.tank3Turbo) > 0 || tanks.spaceKg("tank2") < 1;
          if (tanks.kg("tank1") < holdTank1) jetT3 = move("tank3", "tank1", PUMP.jet) > 0;
          fromTank3 += before3 - tanks.kg("tank3");
        }
        // Tank 1 turbo pump keeps the feed tank full whenever tank 3 is not doing so.
        if (!tank3Pumping || tanks.spaceKg("tank2") > 1) {
          const moved = move("tank1", "tank2", PUMP.tank1Turbo);
          t1Turbo = moved > 0 || (!tanks.isEmpty("tank1") && tanks.spaceKg("tank2") < 1);
          fromTank1 += moved;
          if (phase === "pause") pausePhaseKg += moved;
        }
      } else {
        // No GBX drive (pumps stopped): tank 1 gravity-feeds tank 2 only (GAF T.O.), slowly.
        move("tank1", "tank2", PUMP.gravity);
      }
      // Engines burn from the feed tank; at near-zero / negative g the accumulator carries them briefly.
      let demand = 0;
      for (const v of Object.values(input.engineFlowKgS)) demand += v * dt;
      let got: number;
      if (input.nzG < 0.2) {
        got = Math.min(demand, accumulator);
        accumulator -= got;
      } else {
        got = tanks.draw("tank2", demand);
        accumulator = Math.min(ACCUMULATOR_KG, accumulator + tanks.draw("tank2", Math.min(ACCUMULATOR_KG - accumulator, 1 * dt)));
      }
      for (const [eng, v] of Object.entries(input.engineFlowKgS)) if (v > 0) flows.push({ from: input.nzG < 0.2 ? "accumulator" : "tank2", to: eng, kgS: v });
      feedOk = got >= demand - 1e-9 && (input.nzG < 0.2 ? accumulator > 0 : !tanks.isEmpty("tank2"));
      pumps = [
        { id: "activeFuel", running: active, flowKgS: 0 },
        { id: "tank1Turbo", running: t1Turbo, flowKgS: flows.filter((f) => f.from === "tank1" && f.to === "tank2").reduce((a, f) => a + f.kgS, 0) },
        { id: "tank3Turbo", running: t3Turbo, flowKgS: flows.filter((f) => f.from === "tank3" && f.to === "tank2").reduce((a, f) => a + f.kgS, 0) },
        { id: "tank3Jet", running: jetT3, flowKgS: flows.filter((f) => f.from === "tank3" && f.to === "tank1").reduce((a, f) => a + f.kgS, 0) },
        { id: "outerJet", running: jetOuter, flowKgS: flows.filter((f) => f.to === "tank3").reduce((a, f) => a + f.kgS, 0) }
      ];
      valves = [
        { id: "clTransfer", open: clValve },
        { id: "tank1Level", open: t1Turbo },
        { id: "tank3Level", open: t3Turbo || jetT3 },
        { id: "accumulatorFeed", open: input.nzG < 0.2 }
      ];
    }
  };
}
