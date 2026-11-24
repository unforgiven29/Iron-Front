/**
 * F-16C electrical system — this package's own installation on the shared bus-power network
 * (systems/electrical).
 *
 * PRIMARY (T.O. GR1F-16CJ-1, Section I "Electrical System", figs 1-29 to 1-32), PX II / Block 50:
 *  - Main AC: 60 kVA main generator on the ADG (through the CSD) feeds the non-essential,
 *    essential and emergency AC buses.
 *  - Standby AC: 10 kVA standby generator on the ADG powers the essential and emergency AC buses
 *    when the main generator is not supplying power.
 *  - Emergency AC: if main and standby fail, the 5 kVA (PX II) EPU generator powers the emergency AC
 *    buses. The EPU starts automatically on loss of both generators (or both hydraulic systems).
 *  - DC: AC-to-DC converters. Main generator → emergency DC 1/2, battery buses 1/2, non-essential DC,
 *    essential DC. Standby → all but non-essential DC. EPU → emergency DC 1/2 and battery buses only.
 *    With all generators failed the aircraft battery powers battery buses 1 and 2.
 *  - FLCS power: dedicated FLCS PMG (integral with the standby generator, enough for the FLCS at
 *    ≥40 % rpm) through two dual-channel converter/regulators that pick the highest-voltage source
 *    among the PMG, emergency DC 1 (branches A/B) / 2 (C/D), the EPU PMG and the aircraft battery.
 *  - During start the FLCS PMG light goes off at ≈44 % rpm and the STBY GEN light at ≈60 % rpm;
 *    the MAIN GEN light about 10 s later (GE 129).
 * ESTIMATED: bus loads, battery capacity, converter ratings, the PMG/generator drive thresholds
 * as fractions of core speed (taken from the rpm figures above), the main-generator 10 s delay is
 * not modelled (it comes on line with the standby). The four FLCS branches are lumped into one bus,
 * and converter/regulator selection is a fixed priority instead of "highest voltage".
 * Not modelled: the overcurrent sensing contactors, radar/inlet/nacelle buses, external power,
 * the MAIN PWR switch, and the rule that non-essential/essential DC drop whenever the EPU runs
 * even with the main generator on line (EPU started by hydraulic failure).
 */
import type { ElectricalInstallation, ElectricalSnapshot } from "../../../systems/electrical/ElectricalNetwork.js";
import type { DriveContext } from "../common/AircraftDefinition.js";

export const F16_ELECTRICAL = Object.freeze({
  mainGeneratorW: 60_000, standbyGeneratorW: 10_000, epuGeneratorW: 5_000,
  standbyOnlineFraction: 0.60, pmgFlcsFraction: 0.40,
  // ESTIMATED
  pmgW: 1_500, epuPmgW: 1_000, mainBatteryAh: 17, batteryVoltage: 24
});
const E = F16_ELECTRICAL;

const conv = (id: string, inputBusId: string, ratedPowerW: number) => ({ id, kind: "converter" as const, inputBusId, ratedPowerW, efficiency: 0.85 });

export const F16_ELECTRICAL_INSTALLATION: ElectricalInstallation = {
  sources: [
    { id: "gen.main", kind: "generator", driveId: "f110", minDriveFraction: E.standbyOnlineFraction, ratedPowerW: E.mainGeneratorW },
    { id: "gen.standby", kind: "generator", driveId: "f110", minDriveFraction: E.standbyOnlineFraction, ratedPowerW: E.standbyGeneratorW },
    { id: "gen.epu", kind: "generator", driveId: "epu", minDriveFraction: 0.5, ratedPowerW: E.epuGeneratorW },
    { id: "pmg.flcs", kind: "generator", driveId: "f110", minDriveFraction: E.pmgFlcsFraction, ratedPowerW: E.pmgW },
    { id: "pmg.epu", kind: "generator", driveId: "epu", minDriveFraction: 0.5, ratedPowerW: E.epuPmgW },
    // Converters fed by converter-powered buses come first (load roll-up order).
    conv("conv.flcs", "dc.emergency1", 1_500),
    conv("conv.dc.nonessential", "ac.nonessential", 6_000),
    conv("conv.dc.essential", "ac.essential", 3_000),
    conv("conv.dc.emergency1", "ac.emergency1", 2_000),
    conv("conv.dc.emergency2", "ac.emergency2", 2_000),
    { id: "battery.main", kind: "battery", capacityAh: E.mainBatteryAh, nominalVoltage: E.batteryVoltage, rechargeFromBusId: "ac.emergency1", rechargeCurrentA: 10 }
  ],
  buses: [
    { id: "ac.nonessential", sources: ["gen.main"], essentialLoadW: 22_000, sheddableLoadW: 0 },
    { id: "ac.essential", sources: ["gen.main", "gen.standby"], essentialLoadW: 3_000, sheddableLoadW: 0 },
    { id: "ac.emergency1", sources: ["gen.main", "gen.standby", "gen.epu"], essentialLoadW: 1_000, sheddableLoadW: 0 },
    { id: "ac.emergency2", sources: ["gen.main", "gen.standby", "gen.epu"], essentialLoadW: 1_000, sheddableLoadW: 0 },
    { id: "dc.nonessential", sources: ["conv.dc.nonessential"], essentialLoadW: 2_000, sheddableLoadW: 0 },
    { id: "dc.essential", sources: ["conv.dc.essential"], essentialLoadW: 1_200, sheddableLoadW: 0 },
    { id: "dc.emergency1", sources: ["conv.dc.emergency1"], essentialLoadW: 500, sheddableLoadW: 0 },
    { id: "dc.emergency2", sources: ["conv.dc.emergency2"], essentialLoadW: 500, sheddableLoadW: 0 },
    { id: "dc.battery1", sources: ["conv.dc.emergency1", "battery.main"], essentialLoadW: 300, sheddableLoadW: 0 },
    { id: "dc.battery2", sources: ["conv.dc.emergency2", "battery.main"], essentialLoadW: 300, sheddableLoadW: 0 },
    { id: "flcs", sources: ["pmg.flcs", "pmg.epu", "conv.flcs", "battery.main"], essentialLoadW: 600, sheddableLoadW: 0 }
  ]
};

/** The EPU generator and PMG turn while the EPU runs (hydraulic network's emergency unit). */
export function f16AccessoryDrives(): (ctx: DriveContext) => Readonly<Record<string, number>> {
  return (ctx) => ({ epu: ctx.emergencyUnitRunning ? 1 : 0 });
}

/** EPU auto-start on loss of both main and standby generators (essential AC bus unpowered). */
export function f16SystemsCoupling(s: { readonly electrical?: ElectricalSnapshot }): { readonly startEmergencyUnit?: boolean } {
  const essential = s.electrical?.buses.find((b) => b.id === "ac.essential");
  return { startEmergencyUnit: essential !== undefined && !essential.powered };
}
