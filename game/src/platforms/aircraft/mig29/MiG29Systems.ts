/**
 * MiG-29 hydraulics, electrical system, accessory drives and landing gear — this package's own
 * installations on the shared modules (systems/hydraulics, systems/electrical,
 * physics/ground-handling). Per GAF T.O. 1F-MIG29-1:
 *  - The airframe accessory gearbox (GBX) drives BOTH hydraulic pumps and BOTH generators. It is
 *    normally driven by the RH engine; a freewheel clutch selects the LH engine when its RPM exceeds
 *    the RH by ≥7 %. One engine out therefore keeps all hydraulic and electrical power.
 *  - Main and boost systems, 19–22 MPa, relief 24 MPa, accumulators 8 MPa precharge; full control
 *    on either system. A fuel-driven emergency pump feeds the boost system when both systems are
 *    below 10 MPa, with both engines at ≥85 % RPM; its low delivery gives severely degraded control.
 *  - AC: 30 kVA generator → AC bus; on loss, the DC/AC converter PTO (1.5 kVA) feeds essential
 *    AC loads and the non-essential ones (incl. the AFCS) are shed. DC: 12 kW generator → DC bus;
 *    on loss, the batteries feed it and the damping (SAU) etc. drop out.
 * Sizes of pumps/actuators/loads/battery capacity: estimated (MiG29Data.ts).
 */
import type { LandingGearSpec, WheelSpec } from "../../../physics/ground-handling/LandingGear.js";
import type { HydraulicInstallation } from "../../../systems/hydraulics/HydraulicNetwork.js";
import type { DriveContext, HydraulicLoadContext } from "../common/AircraftDefinition.js";
import type { ElectricalInstallation } from "../../../systems/electrical/ElectricalNetwork.js";
import { MIG29_ELECTRICAL as E, MIG29_GEAR as G, MIG29_HYDRAULICS as H } from "./MiG29Data.js";

const circuit = (id: string) => ({
  id, nominalPressurePa: H.nominalPressurePa.value, fluidVolumeM3: 0.014, bulkModulusPa: 1.5e9, leakageM3sPerPa: 2.5e-5 / H.nominalPressurePa.value, reliefPressurePa: H.reliefPressurePa.value,
  reservoirM3: H.reservoirM3.value,
  // Reservoirs sit in fuel tank 3: cooled by the fuel continuously (no thermal bypass).
  thermal: { heatCapacityJPerK: H.heatCapacityJPerK.value, pumpEfficiency: 0.85, coolerBypassBelowK: 0, ambientConductanceWPerK: 10 }
});
const pump = (id: string, circuitId: string, engineId: string, flowFraction = 1) => ({ id, circuitId, ratedFlowM3s: H.pumpRatedFlowM3s.value * flowFraction, compensatorPressurePa: H.nominalPressurePa.value * 1.03, compensatorBandPa: H.nominalPressurePa.value * 0.06, drive: { kind: "engine" as const, engineId, ratedSpeedFraction: 1 } });
const hingeLoad = { loadFractionAtReference: H.hingeLoadFractionAtReference.value, referenceDynamicPressurePa: H.hingeReferenceDynamicPressurePa.value };
/** Flight controls: first chamber on the boost system, second on the main system (GAF T.O.). */
const dual = { chambers: [{ circuitId: "main", displacementM3PerDeg: H.displacementM3PerDeg.value }, { circuitId: "booster", displacementM3PerDeg: H.displacementM3PerDeg.value }], hingeLoad };

/**
 * GAF T.O. "Hydraulic power supply system": main and boost systems on GBX-driven variable piston
 * pumps (19–22 MPa), relief valves at 24 MPa, nitrogen accumulators at 8 MPa, air-pressurised two-
 * chamber reservoirs inside fuel tank 3 (feed at negative g, fuel cooling), and a pressure limiter /
 * isolation valve in the main system: below 13 MPa everything except the flight controls is cut off
 * (modelled as the "main.util" branch: gear, nose-wheel steering, speedbrakes, intake ramps).
 * Main keeps the second chambers of the flight controls and the flaps/LEF. Wheel brakes are
 * pneumatic (not on this network). Sizes and flows ESTIMATED.
 */
export const MIG29_HYDRAULIC_INSTALLATION: HydraulicInstallation = {
  circuits: [circuit("main"), circuit("booster")],
  branches: [{ id: "main.util", circuitId: "main", chargeConductanceM3sPerPa: 1.6e-3 / 2e6, fluidVolumeM3: 0.004, leakageM3sPerPa: 2e-6 / 21e6, isolationValve: true }],
  pumps: [pump("pump.main", "main", "gbx"), pump("pump.booster", "booster", "gbx"), pump("pump.emergency", "booster", "emergencyPump", H.emergencyPumpFlowFraction.value)],
  accumulators: [
    { id: "acc.main", circuitId: "main", gasVolumeM3: 0.0012, prechargePa: H.accumulatorPrechargePa.value },
    { id: "acc.booster", circuitId: "booster", gasVolumeM3: 0.0012, prechargePa: H.accumulatorPrechargePa.value }
  ],
  consumers: [
    { id: "gear", nodeId: "main.util", flowM3sAtFull: 8e-4 },
    { id: "nws", nodeId: "main.util", flowM3sAtFull: 1e-4 },
    { id: "rampLeft", nodeId: "main.util", flowM3sAtFull: 1.5e-4 },
    { id: "rampRight", nodeId: "main.util", flowM3sAtFull: 1.5e-4 }
  ],
  actuators: {
    elevator: dual, aileron: dual, differentialStabilator: dual, rudder: dual,
    lef: { chambers: [{ circuitId: "main", displacementM3PerDeg: H.displacementM3PerDeg.value }], hingeLoad },
    // Trailing-edge flaps on the main system (GAF T.O.: main keeps the flaps/LEF below the limiter).
    flap: { chambers: [{ circuitId: "main", displacementM3PerDeg: H.displacementM3PerDeg.value }], hingeLoad },
    speedbrake: { chambers: [{ circuitId: "main.util", displacementM3PerDeg: H.displacementM3PerDeg.value }], hingeLoad }
  }
};

/** MiG-29 hydraulic utility logic: pressure limiter, consumer activity, fuel cooling of the reservoirs. */
export function mig29HydraulicLoads(): (ctx: HydraulicLoadContext, dt: number) => { demand: Record<string, number>; valves: Record<string, boolean>; cooling: Record<string, { sinkK: number; conductanceWPerK: number }> } {
  let limiterOpen = true, lastYaw = 0;
  const lastRamp: Record<string, number> = {};
  return (ctx, dt) => {
    // Pressure limiter / isolation valve: closes below 13 MPa, reopens with a small hysteresis (ESTIMATED 0.5 MPa).
    const pMain = ctx.sensors.hydraulicPressuresPa?.["main"] ?? H.nominalPressurePa.value;
    if (pMain < H.pressureLimiterPa.value) limiterOpen = false;
    else if (pMain > H.pressureLimiterPa.value + 0.5e6) limiterOpen = true;
    const g = ctx.gear;
    const gearMoving = !!g && ((g.handleDown && g.extension < 1) || (!g.handleDown && g.extension > 0));
    const nws = g?.weightOnWheels ? Math.min(1, Math.abs(ctx.pilot.yaw - lastYaw) / Math.max(dt, 1e-6) * 0.5 + 0.05) : 0;
    lastYaw = ctx.pilot.yaw;
    const ramp = (id: string) => { const r = ctx.inlets?.[id]?.rampExtension ?? 0, prev = lastRamp[id] ?? r; lastRamp[id] = r; return Math.min(1, Math.abs(r - prev) / Math.max(dt, 1e-6) / 0.5); };
    const sink = { sinkK: ctx.ambientTemperatureK + 10, conductanceWPerK: H.fuelCoolingWPerK.value };
    return {
      demand: { gear: gearMoving ? 1 : 0, nws, rampLeft: ramp("left"), rampRight: ramp("right") },
      valves: { "main.util": limiterOpen },
      cooling: { main: sink, booster: sink }
    };
  };
}

const mainX = -G.wheelbaseM.value * G.noseLoadFraction.value, z = G.contactBelowCgM.value;
const tyre = { rollingFriction: 0.02, peakFriction: 0.6, corneringStiffnessPerRad: 6 };
const main = (id: string, y: number): WheelSpec => ({ id, contactPointBodyM: [mainX, y, z], strokeM: 0.3, springNPerM: G.springNPerM.value, damperNsPerM: G.damperNsPerM.value, ...tyre, brake: { maxForceN: G.brakeMaxForceN.value, antiSkidFraction: 0.8 } });

export const MIG29_LANDING_GEAR: LandingGearSpec = {
  wheels: [
    { id: "nose", contactPointBodyM: [mainX + G.wheelbaseM.value, 0, z], strokeM: 0.25, springNPerM: G.noseSpringNPerM.value, damperNsPerM: G.noseDamperNsPerM.value, ...tyre, steering: { maxAngleDeg: 31, rateDegS: 30 } /* GAF T.O.: high (taxi) mode 31°, low mode 8° not modelled */ },
    main("left", -G.wheelTrackM.value / 2), main("right", G.wheelTrackM.value / 2)
  ],
  transitTimeS: 8, /* GAF T.O.: extension 7–8 s, retraction 9–10 s (single transit time) */ // Gear and NWS behind the pressure limiter; wheel brakes are pneumatic (GAF T.O.), not hydraulic.
  gearCircuitId: "main.util", steeringCircuitId: "main.util",
  // Normal wheel brakes: pneumatic, regulated from the main nitrogen system (MiG29Pneumatics.ts).
  brakeCircuitId: "brakes.normal",
  maxSinkRateMps: G.maxSinkRateMps.value, restCgHeightM: z - 0.11,
  // Estimated strike points: nose, tail (≈13° tail-strike pitch), wingtips, belly.
  airframePointsBodyM: [[8.5, 0, 0.7], [-8, 0, 0.1], [0, -5.6, 1.1], [0, 5.6, 1.1], [0, 0, 1.3]]
};

/** Accessory drives: the GBX follows the RH engine unless the LH is ≥7 % faster; the emergency pump latches on dual low pressure. */
export function mig29AccessoryDrives(): (ctx: DriveContext) => Readonly<Record<string, number>> {
  let emergencyLatched = false;
  return (ctx) => {
    const lh = ctx.engineSpeed("left"), rh = ctx.engineSpeed("right");
    const gbx = lh >= rh + H.gearboxEngineSelectMargin.value ? lh : rh;
    const low = H.lowPressurePa.value;
    if (ctx.hydraulicPressurePa("main") < low && ctx.hydraulicPressurePa("booster") < low) emergencyLatched = true;
    if (ctx.hydraulicPressurePa("main") > 0.9 * H.nominalPressurePa.value) emergencyLatched = false; // normal supply restored
    const emergencyPump = emergencyLatched && Math.min(lh, rh) >= H.emergencyPumpMinEngineSpeed.value ? 1 : 0;
    return { gbx, emergencyPump };
  };
}

/**
 * GAF T.O. "Electrical power supply system": 30 kVA 115/200 V 400 Hz AC generator on a hydrodynamic
 * constant-speed drive (GBX) → AC bus; transformer → 36 VAC (1.5 kVA); 12 kW 28.5 V DC generator →
 * DC bus; DC/AC converter PTO (115 V ≥ 1.5 kVA, 36 V ≥ 1 kVA) powers flight-essential AC on AC
 * generator or transformer failure with the non-essential consumers shed automatically (INS heaters,
 * radar/sight, IRST/LRF/HMS, LH AOA/sideslip heaters, windshield heat, AFCS, armament, IFF encoder;
 * on transformer failure LRF, FCS rate sensors and ILS course/glide-path); two silver-zinc batteries
 * (27.6 V, not charged by the generator) feed the DC bus on DC generator failure.
 * Switches: BAT-GND SUPPLY, DC GEN, AC GEN, PTO. Loads ESTIMATED.
 */
export const MIG29_ELECTRICAL_INSTALLATION: ElectricalInstallation = {
  sources: [
    { id: "gen.dc", kind: "generator", driveId: "gbx", minDriveFraction: E.generatorMinDriveFraction.value, ratedPowerW: E.dcGeneratorW.value },
    { id: "gen.ac", kind: "generator", driveId: "gbx", minDriveFraction: E.generatorMinDriveFraction.value, ratedPowerW: E.acGeneratorW.value },
    { id: "battery", kind: "battery", capacityAh: E.batteryCapacityAh.value, nominalVoltage: E.batteryVoltage.value },
    { id: "transformer", kind: "converter", inputBusId: "ac.gen", ratedPowerW: E.transformerW.value, efficiency: 0.95 },
    { id: "pto", kind: "converter", inputBusId: "dc", ratedPowerW: E.ptoConverterW.value, efficiency: 0.8 },
    { id: "pto36", kind: "converter", inputBusId: "dc", ratedPowerW: E.pto36W.value, efficiency: 0.8 }
  ],
  buses: [
    // The transformer runs from the AC generator only (on generator loss the PTO supplies 36 V itself).
    { id: "ac.gen", sources: ["gen.ac"], essentialLoadW: 0, sheddableLoadW: 0 },
    { id: "dc", sources: ["gen.dc", "battery"], essentialLoadW: E.dcEssentialLoadW.value, sheddableLoadW: E.dcSheddableLoadW.value, shedOn: ["battery"] },
    { id: "ac", sources: ["gen.ac", "pto"], essentialLoadW: E.acEssentialLoadW.value, sheddableLoadW: E.acSheddableLoadW.value, shedOn: ["pto"] },
    // 36 VAC: instruments and FCS rate sensors; on the PTO the LRF, rate sensors and ILS deviations drop (sheddable part).
    { id: "ac36", sources: ["transformer", "pto36"], essentialLoadW: 400, sheddableLoadW: 500, shedOn: ["pto36"] }
  ]
};
