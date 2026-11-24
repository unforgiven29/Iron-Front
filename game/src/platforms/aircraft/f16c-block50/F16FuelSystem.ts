/**
 * F-16C fuel system — this package's own logic on the shared tank physics (systems/fuel).
 *
 * SECONDARY-REPORTED, NOT VERIFIED against T.O. 1F-16C-1 (sources disagree by up to ≈100 lb per tank):
 *  - Tanks: F-1 forward fuselage ≈2,770 lb, A-1 aft fuselage ≈2,330 lb, forward and aft
 *    reservoirs ≈480 lb each, left/right internal wing tanks ≈550 lb each (total ≈7,160 lb,
 *    consistent with the ≈7,160 lb F-16C internal fuel reported by Aerospaceweb). Reservoir and
 *    wing figures: F-16.net forum and study-card sources; F-1/A-1 = reported fwd/aft system totals
 *    (3,250 / 2,810 lb) minus the 480 lb reservoirs.
 *  - Architecture: a forward system (F-1 → forward reservoir) and an aft system (A-1 → aft
 *    reservoir) both feed the engine; internal wing fuel is transferred into the fuselage tanks
 *    first; the system keeps the forward and aft systems in balance to limit CG travel.
 * ESTIMATED: tank centroids, transfer rates, the balancing law (equal remaining fraction in the
 * forward and aft systems), "FWD/AFT FUEL LOW" at 400 lb in a reservoir, no unusable fuel.
 * External tanks, air refuelling and the fuel/oil/hydraulic heat exchange are not modelled.
 */
import type { Vector3 } from "../../../core/coordinates/CoordinateFrames.js";
import { TankSet, type FuelStepInput, type FuelSystemModel, type TankSpec } from "../../../systems/fuel/FuelTanks.js";

const LB = 0.45359237;
const POS: Record<string, Vector3> = {
  f1: [2.0, 0, -0.3], fwdReservoir: [0.4, 0, -0.2], aftReservoir: [-0.4, 0, -0.2], a1: [-1.6, 0, -0.3],
  wingL: [-0.3, -1.6, 0], wingR: [-0.3, 1.6, 0]
};
const CAP_LB: Record<string, number> = { f1: 2770, fwdReservoir: 480, aftReservoir: 480, a1: 2330, wingL: 550, wingR: 550 };

export function f16TankSpecs(): TankSpec[] {
  return Object.keys(CAP_LB).map((id) => ({ id, capacityKg: CAP_LB[id]! * LB, unusableKg: 0, positionBodyM: POS[id]! }));
}

const RATE = { wing: 1.5, reservoir: 6 }; // kg/s, ESTIMATED

export function f16FuelSystem(): FuelSystemModel {
  const tanks = new TankSet(f16TankSpecs());
  let feedOk = true;
  const system = (t: string, r: string) => tanks.kg(t) + tanks.kg(r);
  const cap = (t: string, r: string) => tanks.spec(t).capacityKg + tanks.spec(r).capacityKg;
  return {
    tanks,
    reset: () => { for (const s of f16TankSpecs()) tanks.set(s.id, s.capacityKg); feedOk = true; },
    engineFuelAvailable: () => feedOk,
    annunciations: () => [
      ...(tanks.kg("fwdReservoir") < 400 * LB ? ["FWD FUEL LOW"] : []),
      ...(tanks.kg("aftReservoir") < 400 * LB ? ["AFT FUEL LOW"] : [])
    ],
    step: (input: FuelStepInput, dt: number) => {
      // Wing fuel goes first, into F-1 and A-1 in proportion to their free space.
      const room = tanks.spaceKg("f1") + tanks.spaceKg("a1");
      if (room > 0) for (const w of ["wingL", "wingR"]) {
        const share = Math.min(RATE.wing, room / dt / 2);
        tanks.transfer(w, "f1", share * tanks.spaceKg("f1") / room, dt);
        tanks.transfer(w, "a1", share * tanks.spaceKg("a1") / room, dt);
      }
      // Reservoirs are kept full from their fuselage tank.
      tanks.transfer("f1", "fwdReservoir", RATE.reservoir, dt);
      tanks.transfer("a1", "aftReservoir", RATE.reservoir, dt);
      // Engine draw split between the reservoirs to keep both systems at the same remaining fraction.
      let demand = 0;
      for (const v of Object.values(input.engineFlowKgS)) demand += v * dt;
      const fwdFrac = system("f1", "fwdReservoir") / cap("f1", "fwdReservoir"), aftFrac = system("a1", "aftReservoir") / cap("a1", "aftReservoir");
      const fwdShare = Math.min(1, Math.max(0, 0.5 + 4 * (fwdFrac - aftFrac)));
      let got = tanks.draw("fwdReservoir", demand * fwdShare) + tanks.draw("aftReservoir", demand * (1 - fwdShare));
      if (got < demand) got += tanks.draw("fwdReservoir", demand - got);
      if (got < demand) got += tanks.draw("aftReservoir", demand - got);
      feedOk = got >= demand - 1e-9 && !(tanks.isEmpty("fwdReservoir") && tanks.isEmpty("aftReservoir"));
    }
  };
}
