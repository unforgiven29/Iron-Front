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

/** Pump capacities, kg/s (ESTIMATED: comfortably above two-engine max-afterburner burn). */
const PUMP = { tank1Turbo: 6, tank3Turbo: 6, jet: 2, centerline: 4 };

export function mig29FuelSystem(options: { readonly centerlineTank?: boolean } = {}): FuelSystemModel {
  const withCl = options.centerlineTank ?? false;
  const tanks = new TankSet(mig29TankSpecs(withCl));
  let fromTank1 = 0, fromTank3 = 0, pausePhaseKg = 0;
  let phase: "tank1" | "tank3" | "pause" | "tank3-final" = "tank1";
  let feedOk = true;
  const cap = (id: string) => tanks.spec(id).capacityKg;
  const outerEmpty = () => ["tank3A1", "tank3A2", "wingL", "wingR"].every((id) => tanks.isEmpty(id));
  return {
    tanks,
    reset: () => {
      for (const s of mig29TankSpecs(withCl)) tanks.set(s.id, s.capacityKg);
      fromTank1 = 0; fromTank3 = 0; pausePhaseKg = 0; phase = "tank1"; feedOk = true;
    },
    engineFuelAvailable: () => feedOk,
    annunciations: () => [
      ...(tanks.kg("tank2") < 550 ? ["550 KG REMAIN"] : []),
      ...(withCl && tanks.isEmpty("centerline") ? ["CL TANK EMPTY"] : []),
      ...(outerEmpty() ? ["WING TANKS EMPTY"] : []),
      ...(!feedOk ? ["NO BOOST"] : [])
    ],
    step: (input: FuelStepInput, dt: number) => {
      const rpm = Math.max(0, ...Object.values(input.engineSpeed));
      const running = rpm > 0.5;
      // External: CL tank → tank 1 above 80 % RPM, not at negative g, not above 30,000 ft.
      if (withCl && rpm >= 0.8 && input.nzG > 0 && input.altitudeM < 30000 * 0.3048) tanks.transfer("centerline", "tank1", PUMP.centerline, dt);
      if (running) {
        // Tanks 3A and wing tanks feed tank 3 once ≈200 L have left it.
        // Jet pumps run together; they share tank 3's free space so left and right drain evenly.
        if (fromTank3 >= L(200)) {
          const outer = ["tank3A1", "tank3A2", "wingL", "wingR"].filter((id) => !tanks.isEmpty(id));
          const room = tanks.spaceKg("tank3");
          for (const id of outer) tanks.transfer(id, "tank3", Math.min(PUMP.jet, room / dt / outer.length), dt);
        }
        if (phase === "tank1" && fromTank1 >= L(250)) phase = "tank3";
        if (phase === "tank3" && outerEmpty() && fromTank3 >= L(600)) phase = "pause";
        if (phase === "pause" && pausePhaseKg >= L(280)) phase = "tank3-final";
        const tank3Pumping = phase === "tank3" || phase === "tank3-final";
        if (tank3Pumping) {
          // Tank 3 keeps tank 2 full and holds tank 1 at its level (jet pump to tank 1).
          const holdTank1 = phase === "tank3" ? cap("tank1") - L(250) : cap("tank1") - L(250) - L(280);
          const before3 = tanks.kg("tank3");
          tanks.transfer("tank3", "tank2", PUMP.tank3Turbo, dt);
          if (tanks.kg("tank1") < holdTank1) tanks.transfer("tank3", "tank1", PUMP.jet, dt);
          fromTank3 += before3 - tanks.kg("tank3");
          if (tanks.isEmpty("tank3")) phase = "tank3-final";
        }
        // Tank 1 turbo pump keeps tank 2 full whenever tank 3 is not doing so (or tank 3 is empty).
        if (!tank3Pumping || tanks.isEmpty("tank3")) {
          const moved = tanks.transfer("tank1", "tank2", PUMP.tank1Turbo, dt);
          fromTank1 += moved;
          if (phase === "pause") pausePhaseKg += moved;
        }
      } else {
        // Pump failure / engines stopped: tank 1 gravity-feeds tank 2 (slowly; ESTIMATED rate).
        tanks.transfer("tank1", "tank2", 0.5, dt);
      }
      // Engines burn from the feed tank only.
      let demand = 0;
      for (const v of Object.values(input.engineFlowKgS)) demand += v * dt;
      const got = tanks.draw("tank2", demand);
      feedOk = !tanks.isEmpty("tank2") || got >= demand - 1e-9;
    }
  };
}
