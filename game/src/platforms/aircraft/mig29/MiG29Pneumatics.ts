/**
 * MiG-29 stored-gas (pneumatic) installation and utility logic on the shared
 * systems/pneumatics network. Per GAF T.O. 1F-MIG29-1 (applicability to product 9.13 not
 * verified; see game/modules/planes/MiG-29A/systems/pneumatics.md):
 *  - Two independent nitrogen systems, MAIN and EMERGENCY, 15 MPa, not charged in flight, check
 *    valves preventing crossfeed; plus a 6.3 MPa drag-chute bottle.
 *  - Main: normal wheel brakes (regulated) and hydraulic reservoir pressurisation (regulated).
 *  - Emergency: staged emergency gear extension — handle pulled aft (NOSE) extends the nose gear;
 *    rotated and pulled full aft (MAIN) extends the main gear. Pneumatically driven shut-off valves
 *    then close the hydraulic gear lines, so normal retraction is no longer available.
 * Volumes, regulated pressures, flows and transit times: ESTIMATED (MiG29Data.ts).
 *
 * Not modelled yet: emergency (main-wheel) braking, anti-skid valves, canopy and seals, drag-chute
 * deployment (the bottle is carried but has no consumer), pneumatic fuel shut-off valves,
 * equipment pressurisation, pressure gauges' power/failure.
 */
import type { PneumaticInstallation } from "../../../systems/pneumatics/PneumaticNetwork.js";
import type { PneumaticLoadContext, PneumaticLoadOutput } from "../common/AircraftDefinition.js";
import { MIG29_PNEUMATICS as N } from "./MiG29Data.js";

const R = 8.314462618, T0 = 288.15;
/** Leak conductance that bleeds a system with time constant τ (P(t) = P0·e^(−t/τ)). */
export const leakForTimeConstant = (volumeM3: number, tauS: number) => volumeM3 / (R * T0 * tauS);

const system = (id: string, chargePa: number, volumeM3: number) => ({
  id, bottles: [{ id: `${id}.bottles`, volumeM3 }], chargePressurePa: chargePa, thermalTimeConstantS: N.gasThermalTimeConstantS.value
});

export const MIG29_PNEUMATIC_INSTALLATION: PneumaticInstallation = {
  systems: [
    system("main", N.mainChargePa.value, N.mainVolumeM3.value),
    system("emergency", N.emergencyChargePa.value, N.emergencyVolumeM3.value),
    system("chute", N.chuteChargePa.value, N.chuteVolumeM3.value)
  ],
  regulators: [
    { id: "reg.brakes", systemId: "main", setpointPa: N.brakePressurePa.value },
    { id: "reg.reservoir", systemId: "main", setpointPa: N.reservoirPressurePa.value }
  ],
  consumers: [
    { id: "brakes.normal", supplyId: "reg.brakes", requiredPressurePa: N.brakePressurePa.value, strokeVolumeM3: N.brakeStrokeVolumeM3.value },
    { id: "hyd.reservoir", supplyId: "reg.reservoir", requiredPressurePa: N.reservoirPressurePa.value, flowM3sAtFull: N.reservoirMakeupM3s.value },
    { id: "gear.emergency.nose", supplyId: "emergency", requiredPressurePa: N.emergencyGearMinPa.value, flowM3sAtFull: N.emergencyGearFlowM3s.value },
    { id: "gear.emergency.main", supplyId: "emergency", requiredPressurePa: N.emergencyGearMinPa.value, flowM3sAtFull: N.emergencyGearFlowM3s.value }
  ]
};

export const MIG29_EMERGENCY_GEAR_POSITIONS = ["STOWED", "NOSE", "MAIN"] as const;

/** Pneumatic utility logic: brakes, reservoir pressurisation → pump inlet, staged emergency gear extension. */
export function mig29PneumaticLoads(emergencyHandleId: string): { step(ctx: PneumaticLoadContext, dt: number): PneumaticLoadOutput; reset(): void } {
  let lastBrakes = 0, noseReleased = false, mainReleased = false;
  return { reset: () => { lastBrakes = 0; noseReleased = false; mainReleased = false; }, step: (ctx) => {
    const brakes = Math.max(0, Math.min(1, ctx.pilot.brakes ?? 0));
    const applied = Math.max(0, brakes - lastBrakes);
    lastBrakes = brakes;
    // Pulling the handle releases emergency gas into the jacks; restowing the handle does not undo it.
    const handle = ctx.switches[emergencyHandleId] ?? "STOWED";
    if (handle !== "STOWED") noseReleased = true;
    if (handle === "MAIN") mainReleased = true;
    const legs = ctx.gear?.legExtension ?? {};
    const rates: Record<string, number> = {};
    const demand: Record<string, number> = { "hyd.reservoir": 1 };
    if (noseReleased && (legs["nose"] ?? 1) < 1) {
      rates["nose"] = ctx.supplyFraction("gear.emergency.nose") / N.emergencyNoseTransitS.value;
      demand["gear.emergency.nose"] = 1;
    }
    if (mainReleased && ((legs["left"] ?? 1) < 1 || (legs["right"] ?? 1) < 1)) {
      const r = ctx.supplyFraction("gear.emergency.main") / N.emergencyMainTransitS.value;
      rates["left"] = r; rates["right"] = r;
      demand["gear.emergency.main"] = 1;
    }
    // Reservoir pressurisation keeps the pump inlets fed; without it only gravity head remains,
    // which vanishes at zero and negative g (ESTIMATED inlet law).
    const pressurised = ctx.supplyFraction("hyd.reservoir");
    const gravity = Math.max(0, Math.min(1, ctx.sensors.nzG));
    const inlet = pressurised + (1 - pressurised) * gravity;
    return {
      demand, actuations: { "brakes.normal": applied },
      hydraulicPumpInlet: { main: inlet, booster: inlet },
      gear: { alternateExtensionRatePerS: rates, normalActuationIsolated: noseReleased }
    };
  } };
}
