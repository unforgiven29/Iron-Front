/**
 * F-16C electrical system — this package's own installation on the shared bus-power network
 * (systems/electrical).
 *
 * SECONDARY-REPORTED (F-16 -1 descriptions as reproduced in public study material; not verified
 * against T.O. 1F-16C-1 for Block 50): a 60 kVA main AC generator and a 10 kVA standby generator,
 * both on the engine-driven accessory drive gearbox; a 5 kVA EPU generator; an FLCS permanent-
 * magnet generator (PMG) on the gearbox; a main battery and FLCS batteries. The EPU starts
 * automatically when both the main and standby generators are lost (as well as on dual hydraulic
 * low pressure, see F16Hydraulics.ts). The FLCS power supply takes the best of PMG, aircraft
 * power and FLCS batteries, so the flight controls survive total generator loss.
 * ESTIMATED: bus structure (simplified to non-essential AC / essential AC / essential DC / FLCS),
 * loads, minimum drive speeds, battery capacities.
 */
import type { ElectricalInstallation, ElectricalSnapshot } from "../../../systems/electrical/ElectricalNetwork.js";
import type { DriveContext } from "../common/AircraftDefinition.js";

export const F16_ELECTRICAL = Object.freeze({
  mainGeneratorW: 60_000, standbyGeneratorW: 10_000, epuGeneratorW: 5_000, pmgW: 1_000,
  generatorMinDriveFraction: 0.5, mainBatteryAh: 17, flcsBatteryAh: 5, batteryVoltage: 24
});
const E = F16_ELECTRICAL;

export const F16_ELECTRICAL_INSTALLATION: ElectricalInstallation = {
  sources: [
    { id: "gen.main", kind: "generator", driveId: "f110", minDriveFraction: E.generatorMinDriveFraction, ratedPowerW: E.mainGeneratorW },
    { id: "gen.standby", kind: "generator", driveId: "f110", minDriveFraction: E.generatorMinDriveFraction, ratedPowerW: E.standbyGeneratorW },
    { id: "gen.epu", kind: "generator", driveId: "epu", minDriveFraction: 0.5, ratedPowerW: E.epuGeneratorW },
    { id: "pmg", kind: "generator", driveId: "f110", minDriveFraction: E.generatorMinDriveFraction, ratedPowerW: E.pmgW },
    { id: "tr", kind: "converter", inputBusId: "ac.essential", ratedPowerW: 3_000, efficiency: 0.85 },
    { id: "tr.flcs", kind: "converter", inputBusId: "ac.essential", ratedPowerW: 1_000, efficiency: 0.85 },
    { id: "battery.main", kind: "battery", capacityAh: E.mainBatteryAh, nominalVoltage: E.batteryVoltage, rechargeFromBusId: "ac.essential", rechargeCurrentA: 10 },
    { id: "battery.flcs", kind: "battery", capacityAh: E.flcsBatteryAh, nominalVoltage: E.batteryVoltage, rechargeFromBusId: "ac.essential", rechargeCurrentA: 3 }
  ],
  buses: [
    { id: "ac.nonessential", sources: ["gen.main"], essentialLoadW: 25_000, sheddableLoadW: 0 },
    // On standby/EPU power the essential bus sheds its lower-priority loads to fit the smaller generator.
    { id: "ac.essential", sources: ["gen.main", "gen.standby", "gen.epu"], essentialLoadW: 2_500, sheddableLoadW: 4_000, shedOn: ["gen.epu"] },
    { id: "dc.essential", sources: ["tr", "battery.main"], essentialLoadW: 1_200, sheddableLoadW: 0 },
    { id: "flcs", sources: ["pmg", "tr.flcs", "battery.flcs"], essentialLoadW: 600, sheddableLoadW: 0 }
  ]
};

/** The EPU generator turns while the EPU runs (hydraulic network's emergency unit). */
export function f16AccessoryDrives(): (ctx: DriveContext) => Readonly<Record<string, number>> {
  return (ctx) => ({ epu: ctx.emergencyUnitRunning ? 1 : 0 });
}

/** EPU auto-start on loss of both main and standby generators. */
export function f16SystemsCoupling(s: { readonly electrical?: ElectricalSnapshot }): { readonly startEmergencyUnit?: boolean } {
  const online = (id: string) => s.electrical?.sources.find((x) => x.id === id)?.online ?? true;
  const anyGenOnAc = s.electrical?.buses.find((b) => b.id === "ac.essential")?.sourceId;
  return { startEmergencyUnit: !online("gen.main") && anyGenOnAc !== "gen.standby" };
}
