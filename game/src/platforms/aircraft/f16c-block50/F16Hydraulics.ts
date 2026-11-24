/**
 * F-16C Block 50 hydraulic installation for the shared hydraulic network (systems/hydraulics),
 * laid out per T.O. GR1F-16CJ-1 fig 1-33 "Hydraulic Power Supply" (sheets 1 and 2) and Section I
 * "Hydraulic System".
 *
 * PRIMARY (manual):
 *  - Two independent 3,000 psi systems, A and B, each with an engine-driven pump on the ADG, a
 *    reservoir pressurised by its own system (reservoir pressurisation accumulator), filters, a
 *    pressure switch (HYD/OIL PRESS light) and a pressure transmitter (HYD PRESS indicator), a dump
 *    and relief valve, and return flow through the fuel/oil heat exchanger with a thermal bypass.
 *  - Each system has an FLCS accumulator isolated from the main system by check valves; it supplies
 *    extra flow when rapid surface motion exceeds the pump and keeps the flight controls
 *    pressurised while the EPU comes up to speed. Both systems feed the LEFs, rudder, horizontal
 *    tails and flaperons (one chamber each); one system alone suffices at reduced FLCS rate.
 *  - System A only: speedbrakes and the fuel flow proportioner (FFP). The EPU pump feeds system A.
 *  - System B only: landing gear (behind the LG isolation valve, "LG doors uplock actuated"), NWS,
 *    drag chute (own accumulator), gun, air-refuelling system, and the brake/JFS accumulators (two),
 *    which feed the brakes and the JFS through the dump and relief manifold. B recharges them in
 *    40 s (hot) to 60 s (cold) when the engine turns at ≥ 12 % rpm.
 *  - The EPU starts automatically when both systems fall below 1,000 psi.
 * ESTIMATED (no F-16 component data in the project): pump flows, every volume and precharge,
 * check-valve conductances, branch (servo) leakage, consumer flows, the reservoir contents, fluid
 * heat capacity, pump efficiency, the thermal-bypass temperature and heat-exchanger conductance.
 * The LG isolation-valve logic (open while the gear is commanded to move) is simplified.
 * Not modelled: pneumatic emergency gear extension, JFS start, drag chute deployment and gun firing
 * (their consumers exist but have no demand until those systems are modelled).
 */
import type { HydraulicInstallation } from "../../../systems/hydraulics/HydraulicNetwork.js";
import type { HydraulicLoadContext } from "../common/AircraftDefinition.js";
import { F16_HYDRAULICS as H } from "./F16Data.js";
import { F16_SWITCHES } from "./F16Switches.js";

const PSI = 6894.757, GPM = 6.309e-5, L = 1e-3;

/** ESTIMATED component values (see header). */
export const F16_HYD_COMPONENTS = Object.freeze({
  reservoirM3: 5 * L,
  flcsChargeConductance: (35 * GPM) / (100 * PSI),
  flcsBranchLeakage: (0.25 * GPM) / (3000 * PSI),
  brakeJfsAccumulatorGasM3: 2 * L, brakeJfsPrechargePa: 1000 * PSI, brakeJfsChargeConductance: 7.7e-12, brakeLeakage: (0.005 * GPM) / (3000 * PSI),
  dragChuteAccumulatorGasM3: 0.5 * L,
  lgIsolationConductance: (30 * GPM) / (300 * PSI),
  consumerFlow: { gear: 15 * GPM, nws: 2 * GPM, brakes: 0.6 * GPM, jfs: 20 * GPM, dragChute: 5 * GPM, gun: 8 * GPM, airRefuel: 3 * GPM, ffp: 6 * GPM },
  ffpFullFuelFlowKgS: 9,
  heatCapacityJPerK: 6e4, pumpEfficiency: 0.85, coolerBypassBelowK: 330, ambientConductanceWPerK: 20, heatExchangerUaWPerK: 400
});
const K = F16_HYD_COMPONENTS;

const circuit = (id: string) => ({
  id, nominalPressurePa: H.nominalPressurePa.value, fluidVolumeM3: H.fluidVolumeM3.value, bulkModulusPa: H.bulkModulusPa.value, leakageM3sPerPa: H.leakageM3sPerPa.value, reliefPressurePa: H.reliefPressurePa.value,
  reservoirM3: K.reservoirM3,
  thermal: { heatCapacityJPerK: K.heatCapacityJPerK, pumpEfficiency: K.pumpEfficiency, coolerBypassBelowK: K.coolerBypassBelowK, ambientConductanceWPerK: K.ambientConductanceWPerK }
});
const pump = (id: string, circuitId: string) => ({ id, circuitId, ratedFlowM3s: H.pumpRatedFlowM3s.value, compensatorPressurePa: H.nominalPressurePa.value + H.pumpCompensatorBandPa.value / 2, compensatorBandPa: H.pumpCompensatorBandPa.value, drive: { kind: "engine" as const, engineId: "f110", ratedSpeedFraction: 1 } });
const hingeLoad = { loadFractionAtReference: H.hingeLoadFractionAtReference.value, referenceDynamicPressurePa: H.hingeReferenceDynamicPressurePa.value };
/** Flight-control actuators: one chamber on each system's FLCS (check-valve, accumulator) branch. */
const dual = (d: number) => ({ chambers: [{ circuitId: "A.flcs", displacementM3PerDeg: d }, { circuitId: "B.flcs", displacementM3PerDeg: d }], hingeLoad });
const flcsBranch = (c: string) => ({ id: `${c}.flcs`, circuitId: c, chargeConductanceM3sPerPa: K.flcsChargeConductance, fluidVolumeM3: 2 * L, leakageM3sPerPa: K.flcsBranchLeakage });

export const F16_HYDRAULIC_INSTALLATION: HydraulicInstallation = {
  circuits: [circuit("A"), circuit("B")],
  branches: [
    flcsBranch("A"), flcsBranch("B"),
    { id: "B.brakes", circuitId: "B", chargeConductanceM3sPerPa: K.brakeJfsChargeConductance, fluidVolumeM3: 0.3 * L, leakageM3sPerPa: K.brakeLeakage },
    { id: "B.dragchute", circuitId: "B", chargeConductanceM3sPerPa: K.brakeJfsChargeConductance, fluidVolumeM3: 0.2 * L, leakageM3sPerPa: K.brakeLeakage },
    { id: "B.lg", circuitId: "B", chargeConductanceM3sPerPa: K.lgIsolationConductance, fluidVolumeM3: 1.5 * L, leakageM3sPerPa: K.brakeLeakage, isolationValve: true }
  ],
  pumps: [
    pump("pump.A", "A"), pump("pump.B", "B"),
    { id: "pump.epu", circuitId: "A", ratedFlowM3s: H.epuPumpFlowM3s.value, compensatorPressurePa: H.nominalPressurePa.value + H.pumpCompensatorBandPa.value / 2, compensatorBandPa: H.pumpCompensatorBandPa.value, drive: { kind: "emergency" } }
  ],
  accumulators: [
    { id: "acc.flcs.A", circuitId: "A.flcs", gasVolumeM3: H.flcsAccumulatorGasM3.value, prechargePa: H.flcsAccumulatorPrechargePa.value },
    { id: "acc.flcs.B", circuitId: "B.flcs", gasVolumeM3: H.flcsAccumulatorGasM3.value, prechargePa: H.flcsAccumulatorPrechargePa.value },
    { id: "acc.brakeJfs.1", circuitId: "B.brakes", gasVolumeM3: K.brakeJfsAccumulatorGasM3, prechargePa: K.brakeJfsPrechargePa },
    { id: "acc.brakeJfs.2", circuitId: "B.brakes", gasVolumeM3: K.brakeJfsAccumulatorGasM3, prechargePa: K.brakeJfsPrechargePa },
    { id: "acc.dragChute", circuitId: "B.dragchute", gasVolumeM3: K.dragChuteAccumulatorGasM3, prechargePa: K.brakeJfsPrechargePa }
  ],
  consumers: [
    { id: "ffp", nodeId: "A", flowM3sAtFull: K.consumerFlow.ffp, heatFraction: 0.3 },
    { id: "gear", nodeId: "B.lg", flowM3sAtFull: K.consumerFlow.gear },
    { id: "nws", nodeId: "B", flowM3sAtFull: K.consumerFlow.nws },
    { id: "brakes", nodeId: "B.brakes", flowM3sAtFull: K.consumerFlow.brakes, heatFraction: 0.9 },
    { id: "jfs", nodeId: "B.brakes", flowM3sAtFull: K.consumerFlow.jfs },
    { id: "dragChute", nodeId: "B.dragchute", flowM3sAtFull: K.consumerFlow.dragChute },
    { id: "gun", nodeId: "B", flowM3sAtFull: K.consumerFlow.gun },
    { id: "airRefuel", nodeId: "B", flowM3sAtFull: K.consumerFlow.airRefuel }
  ],
  emergencyUnit: { id: "epu", autoStartWhenAllBelowPa: H.epuAutoStartBelowPa.value, autoStartCircuits: ["A", "B"], startDelayS: H.epuStartDelayS.value, enduranceS: H.epuEnduranceS.value },
  actuators: {
    elevator: dual(H.stabilatorDisplacementM3PerDeg.value),
    aileron: dual(H.rollDisplacementM3PerDeg.value),
    rudder: dual(H.rudderDisplacementM3PerDeg.value),
    lef: dual(H.lefDisplacementM3PerDeg.value),
    speedbrake: { chambers: [{ circuitId: "A", displacementM3PerDeg: H.speedbrakeDisplacementM3PerDeg.value }], hingeLoad }
  }
};

/**
 * The F-16's own hydraulic utility logic: what each consumer is doing, the LG isolation valve,
 * and the fuel/oil heat exchanger each system's return flow passes through.
 */
export function f16HydraulicLoads(): (ctx: HydraulicLoadContext, dt: number) => { demand: Record<string, number>; valves: Record<string, boolean>; cooling: Record<string, { sinkK: number; conductanceWPerK: number }> } {
  let lastBrakes = 0, lastYaw = 0, lastAr = "CLOSE", arTimer = 0, lgHold = 0;
  return (ctx, dt) => {
    const brakes = ctx.pilot.brakes ?? 0;
    // Brakes: fluid to apply (pedal travel) plus anti-skid cycling while braking with the wheels rolling.
    const brakeDemand = Math.min(1, Math.abs(brakes - lastBrakes) / Math.max(dt, 1e-6) * 0.5 + (ctx.gear?.weightOnWheels && ctx.groundSpeedMps > 2 ? 0.3 * brakes : 0));
    lastBrakes = brakes;
    const nws = ctx.gear?.weightOnWheels ? Math.min(1, Math.abs(ctx.pilot.yaw - lastYaw) / Math.max(dt, 1e-6) * 0.5 + 0.05) : 0;
    lastYaw = ctx.pilot.yaw;
    // LG isolation valve: open while the gear is commanded to a position it is not in (and briefly after).
    const g = ctx.gear;
    const moving = !!g && ((g.handleDown && g.extension < 1) || (!g.handleDown && g.extension > 0));
    lgHold = moving ? 3 : Math.max(0, lgHold - dt);
    // Air-refuelling door/latch: a few seconds of flow after the AIR REFUEL switch moves.
    const ar = ctx.switches[F16_SWITCHES.airRefuel] ?? "CLOSE";
    if (ar !== lastAr) arTimer = 3;
    lastAr = ar; arTimer = Math.max(0, arTimer - dt);
    const fuelFlow = ctx.engines.reduce((a, e) => a + e.fuelFlowKgS, 0);
    // Fuel/oil heat exchanger: sink = tank fuel; conductance limited by the fuel flow's capacity rate.
    const tankK = ctx.fuelComponents?.indications?.["tankFuelTemperatureK"] ?? ctx.ambientTemperatureK;
    const ua = Math.min(K.heatExchangerUaWPerK, fuelFlow * 2010 * 0.5);
    return {
      demand: { brakes: brakeDemand, nws, gear: moving ? 1 : 0, airRefuel: arTimer > 0 ? 1 : 0, ffp: Math.min(1, fuelFlow / K.ffpFullFuelFlowKgS), jfs: 0, dragChute: 0, gun: 0 },
      valves: { "B.lg": moving || lgHold > 0 },
      cooling: { A: { sinkK: tankK, conductanceWPerK: ua }, B: { sinkK: tankK, conductanceWPerK: ua } }
    };
  };
}
