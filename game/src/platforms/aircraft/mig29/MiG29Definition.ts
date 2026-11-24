/**
 * MiG-29 package definition (provisional, family-level data; see MiG29Data.ts). Everything
 * MiG-29-specific is here and in the files it imports; it imports NOTHING from the F-16 package.
 * Shared code used: the FixedWingAircraft runtime, rigid body, atmosphere, terrain, propulsion
 * (generic-map cycle + FADEC), hydraulics, ground handling, ground effect, cockpit renderer.
 */
import { MIG29_EFB } from "./MiG29Efb.js";
import type { PerformanceOptions } from "../common/Performance.js";
import type { ModuleManifest } from "../../../core/modules/ModuleTypes.js";
import type { AircraftDefinition, ScheduledDevices, SwitchBinding } from "../common/AircraftDefinition.js";
import type { AircraftSnapshot } from "../common/FixedWingAircraft.js";
import { mig29Aerodynamics } from "./MiG29Aerodynamics.js";
import { mig29FuelSystem, mig29TankSpecs } from "./MiG29FuelSystem.js";
import { MIG29_COCKPIT_LAYOUT } from "./MiG29Cockpit.js";
import { mig29ControlSystem, type SauMode } from "./MiG29ControlSystem.js";
import { MIG29_CONTROLS as K, MIG29_ENGINE, MIG29_GEOMETRY as G, MIG29_HYDRAULICS as HYD, MIG29_MASS as M } from "./MiG29Data.js";
import { mig29IntakeSystem } from "./MiG29Intake.js";
import { mig29Engines, type Rd33PowerMode } from "./MiG29Engines.js";
import { mig29AccessoryDrives, mig29HydraulicLoads, MIG29_ELECTRICAL_INSTALLATION, MIG29_HYDRAULIC_INSTALLATION, MIG29_LANDING_GEAR } from "./MiG29Systems.js";

export const MIG29_SWITCHES = Object.freeze({ sau: "mig29.test.sau", speedbrake: "mig29.speedbrake", gear: "mig29.gear.handle", hydraulicFault: "mig29.test.hydraulic-fault", leftEngine: "mig29.test.left-engine", electricalFault: "mig29.test.electrical-fault",
  batGnd: "mig29.elec.bat-gnd", dcGen: "mig29.elec.dc-gen", acGen: "mig29.elec.ac-gen", pto: "mig29.elec.pto" });

/** Electrical test faults (simulation only). CSD OVERSPEED = automatic CSD disconnect at 14,300–14,500 rpm (GAF T.O.). */
const ELEC_FAULTS = Object.freeze({ NORMAL: [], "AC GEN FAIL": ["gen.ac"], "DC GEN FAIL": ["gen.dc"], "BOTH GEN FAIL": ["gen.ac", "gen.dc"], "CSD OVERSPEED": ["gen.ac"], "TRANSFORMER FAIL": ["transformer"] } as const);

export const MIG29_MANIFEST: ModuleManifest = {
  manifestSchemaVersion: 1,
  id: "aircraft.mig29",
  kind: "aircraft",
  name: "MiG-29 (provisional, family-level data)",
  version: "0.1.0",
  apiCompatibility: { minimum: "0.1.0", maximumExclusive: "0.2.0" },
  variant: { family: "MiG-29 Fulcrum", designation: "MiG-29 (product 9.13 working baseline)", revision: "provisional", operatorBaseline: "not frozen" },
  provides: [{ id: "platform.aircraft.definition", apiVersion: "0.1.0" }],
  dependencies: [],
  configuration: [],
  lifecycle: { initialization: "scenario-load", updateDomain: "fixed-tick", deterministic: true, supportsSaveState: false },
  provenance: {
    maintainer: "Iron-Front",
    source: "GAF T.O. 1F-MIG29-1 Section 1 (weights, RD-33 ratings, control travel, feel unit, LEF and AoA limiter); family-level geometry; textbook-method aerodynamics",
    notes: "Bounded, clearly labelled approximation (docs/platform-reference-program/aircraft/MiG-29-product-9-13.md). Not a validated product 9.13 model."
  }
};

/** Inertia from mass and Roskam radii of gyration (estimated), at the reference mass. */
function inertia(massKg: number): [[number, number, number], [number, number, number], [number, number, number]] {
  const b = G.spanM.value, l = G.lengthM.value;
  const ixx = (massKg * (b * M.rollGyrationRadius.value) ** 2) / 4;
  const iyy = (massKg * (l * M.pitchGyrationRadius.value) ** 2) / 4;
  const izz = (massKg * (((b + l) / 2) * M.yawGyrationRadius.value) ** 2) / 4;
  return [[ixx, 0, 0], [0, iyy, 0], [0, 0, izz]];
}

/**
 * Manoeuvring LEF (GAF T.O. 1F-MIG29-1): hydraulically locked fully IN or OUT. Extend at AoA ≥ 8.7°
 * below M0.8, retract at AoA ≤ 7° or above M0.8. Gear/flap-linked extension is not modelled (the
 * device schedule has no gear-position input yet).
 */
export function lefSchedule(): ScheduledDevices {
  let out = false;
  return {
    reset: () => { out = false; },
    step: (s) => {
      const alpha = s.alphaRad * 180 / Math.PI;
      if (s.mach >= K.lefMachLimit.value || alpha <= K.lefRetractAlphaDeg.value) out = false;
      else if (alpha >= K.lefExtendAlphaDeg.value) out = true;
      return { lef: out ? K.lefMaxDeg.value : 0 };
    }
  };
}

/**
 * Settings for the shared steady-state performance calculator. Taileron trim range is the full
 * mechanical travel (35° nose-up); LEF follow the steady-state AoA/Mach logic of lefSchedule().
 */
export const MIG29_PERFORMANCE_OPTIONS: PerformanceOptions = {
  pitchSurfaceId: "elevator",
  pitchSurfaceLimitDeg: K.stabilatorNoseUpDeg.value,
  cgFractionMac: M.aeroReferenceCgFractionMac.value,
  devices: (alpha, q, ps) => {
    const mach = Math.sqrt(q / (0.7 * ps)); // q = 0.7·p·M²
    return { lef: alpha * 180 / Math.PI >= K.lefExtendAlphaDeg.value && mach < K.lefMachLimit.value ? K.lefMaxDeg.value : 0 };
  }
};

/** `engineMode`: RD-33 tuning set by the ground crew before flight (GAF T.O.: normal or limited power mode). */
export function createMiG29Definition(options: { readonly engineMode?: Rd33PowerMode } = {}): AircraftDefinition {
  const referenceMass = M.emptyMassKg.value + M.internalFuelKg.value / 2;
  return {
    manifest: MIG29_MANIFEST,
    displayName: "MiG-29 (provisional)",
    dataNote: "PROVISIONAL: weights, RD-33 ratings, control travel, feel-unit schedule, LEF and AoA-limiter logic from the GAF MiG-29G flight manual (9.13 applicability unverified); aerodynamic coefficients are still textbook estimates.",
    mass: { emptyMassKg: M.emptyMassKg.value, inertiaKgM2: inertia(referenceMass), referenceMassKg: referenceMass, cgFractionMac: M.cgFractionMac.value, internalFuelKg: mig29TankSpecs(false).reduce((s, t) => s + t.capacityKg, 0), macM: G.meanChordM.value },
    surfaces: [
      { id: "elevator", limitDeg: K.stabilatorNoseDownDeg.value, minDeg: -K.stabilatorNoseUpDeg.value, rateDegS: K.stabilatorRateDegS.value, bandwidthRadS: 20 },
      { id: "aileron", limitDeg: K.aileronLimitDeg.value, rateDegS: K.aileronRateDegS.value, bandwidthRadS: 20 },
      { id: "differentialStabilator", limitDeg: K.differentialStabilatorDeg.value, rateDegS: K.stabilatorRateDegS.value, bandwidthRadS: 20 },
      { id: "rudder", limitDeg: K.rudderLimitDeg.value, rateDegS: K.rudderRateDegS.value, bandwidthRadS: 20 },
      { id: "lef", limitDeg: K.lefMaxDeg.value, minDeg: 0, rateDegS: 15, bandwidthRadS: 5 },
      { id: "speedbrake", limitDeg: 60, minDeg: 0, rateDegS: 30, bandwidthRadS: 10 }
    ],
    engines: mig29Engines(options.engineMode ?? "NPM"),
    hydraulics: MIG29_HYDRAULIC_INSTALLATION,
    landingGear: MIG29_LANDING_GEAR,
    createFuelSystem: () => mig29FuelSystem(),
    electrical: MIG29_ELECTRICAL_INSTALLATION,
    cockpit: MIG29_COCKPIT_LAYOUT,
    efb: MIG29_EFB,
    mfdPages: { "panel-left": enginePanel, "panel-right": systemsPanel },
    annunciate: (s) => {
      const out: { text: string; level: "caution" | "warning" }[] = [];
      for (const e of s.engines) if (e.flameout) out.push({ text: `${e.id.toUpperCase()} ENGINE OUT`, level: "warning" });
      // GAF T.O.: warning when either hydraulic system is below 100 kp/cm² (10 MPa).
      const low = (s.hydraulics?.circuits ?? []).filter((c) => c.pressurePa < HYD.lowPressurePa.value).map((c) => (c.id === "booster" ? "BOOST" : "MAIN"));
      if (low.length) out.push({ text: `HYD ${low.join("+")} LOW`, level: "warning" });
      const util = s.hydraulics?.branches?.find((b) => b.id === "main.util");
      if (util && !util.open) out.push({ text: "HYD LIMITER: FLT CONTROLS ONLY", level: "caution" });
      if (s.switches[MIG29_SWITCHES.electricalFault] === "CSD OVERSPEED") out.push({ text: "DISCON GEN DRIVE", level: "caution" });
      if (s.electrical?.buses.find((b) => b.id === "ac")?.sourceId === "pto") out.push({ text: "PTO ON", level: "caution" });
      // Engine captions (GAF T.O.): oil temperature > 195 °C, oil pressure below 1.8 kp/cm² (50–89 % NH) or
      // 2.7 kp/cm² (> 89 %) — the manual's 20 s persistence is not modelled — vibration, AB blow-out, surge.
      for (const e of s.engines) {
        const side = e.id === "left" ? "LEFT" : "RIGHT", h = e.health;
        if (e.surging) out.push({ text: `${side} ENG SURGE`, level: "warning" });
        if (e.afterburnerBlowout) out.push({ text: `${side} AB BLOW-OUT`, level: "caution" });
        if (h && h.oilTemperatureK - 273.15 > 195) out.push({ text: `OIL TEMP ${side}`, level: "warning" });
        if (h && e.spoolSpeed >= 0.5 && h.oilPressurePa < (e.spoolSpeed > 0.89 ? 2.7 : 1.8) * 98066.5) out.push({ text: `OIL PRESS ${side}`, level: "warning" });
        if (h && h.vibration > 1) out.push({ text: `VIBR ${side}`, level: "caution" });
      }
      // AEKRAN generator captions (GAF T.O.: "AC GEN", "DC GEN", "TWO GEN").
      const online = (id: string) => s.electrical?.sources.find((x) => x.id === id)?.online ?? true;
      const ac = online("gen.ac"), dc = online("gen.dc");
      if (!ac && !dc) out.push({ text: "TWO GEN", level: "warning" });
      else if (!ac) out.push({ text: "AC GEN", level: "caution" });
      else if (!dc) out.push({ text: "DC GEN", level: "caution" });
      return out;
    },
    createSystems: () => {
      const fcs = mig29ControlSystem();
      const elec = { fault: "NORMAL", batGnd: true, dcGen: true, acGen: true, pto: true };
      const applyElec = (ctx: { setElectricalSourcesOff(ids: readonly string[]): void }) => ctx.setElectricalSourcesOff([
        ...(ELEC_FAULTS[elec.fault as keyof typeof ELEC_FAULTS] ?? []),
        ...(elec.batGnd ? [] : ["battery"]), ...(elec.dcGen ? [] : ["gen.dc"]), ...(elec.acGen ? [] : ["gen.ac"]), ...(elec.pto ? [] : ["pto", "pto36"])
      ]);
      let speedbrakeSwitch = false;
      const switches: SwitchBinding[] = [
        { key: "f", definition: { id: MIG29_SWITCHES.sau, ownerId: "mig29.sau", label: "SAU (TEST)", positions: ["ON", "OFF"], defaultPosition: "ON", provenance: "Simulation test switch for the stability-augmentation dampers" }, onChange: (to) => { fcs.setSau(to as SauMode); return { accepted: true }; } },
        { key: "b", definition: { id: MIG29_SWITCHES.speedbrake, ownerId: "mig29.speedbrake", label: "AIRBRAKE", positions: ["RETRACT", "EXTEND"], defaultPosition: "RETRACT", provenance: "Upper/lower airbrakes modelled as one surface" }, onChange: (to) => { speedbrakeSwitch = to === "EXTEND"; return { accepted: true }; } },
        { key: "g", gearHandle: { up: "UP", down: "DN" }, definition: { id: MIG29_SWITCHES.gear, ownerId: "mig29.gear", label: "GEAR", positions: ["UP", "DN"], defaultPosition: "DN", provenance: "Landing-gear handle" }, onChange: (to, ctx) => { ctx.setGearHandle(to === "DN"); return { accepted: true }; } },
        { key: "h", definition: { id: MIG29_SWITCHES.hydraulicFault, ownerId: "mig29.hydraulics", label: "HYD FAULT (TEST)", positions: ["NORMAL", "MAIN PUMP FAIL", "BOOSTER PUMP FAIL"], defaultPosition: "NORMAL", provenance: "Simulation test switch" }, onChange: (to, ctx) => { ctx.setHydraulicFaults(to === "NORMAL" ? [] : [{ kind: "pump-failed", pumpId: to.startsWith("MAIN") ? "pump.main" : "pump.booster" }]); return { accepted: true }; } },
        { key: "j", definition: { id: MIG29_SWITCHES.electricalFault, ownerId: "mig29.electrical", label: "ELEC FAULT (TEST)", positions: Object.keys(ELEC_FAULTS), defaultPosition: "NORMAL", provenance: "Simulation test switch: generator, CSD and transformer failures" }, onChange: (to, ctx) => { elec.fault = to; applyElec(ctx); return { accepted: true }; } },
        ...([["batGnd", "BAT-GND SUPPLY"], ["dcGen", "DC GEN"], ["acGen", "AC GEN"], ["pto", "PTO"]] as const).map(([k, label]): SwitchBinding => ({
          definition: { id: MIG29_SWITCHES[k], ownerId: "mig29.electrical", label, positions: ["ON", "OFF"], defaultPosition: "ON", provenance: "GAF T.O. 1F-MIG29-1 fig 1-22, electrical power panel (RH console)" },
          onChange: (to, ctx) => { elec[k] = to === "ON"; applyElec(ctx); return { accepted: true }; }
        })),
        { key: "l", definition: { id: MIG29_SWITCHES.leftEngine, ownerId: "mig29.engines", label: "L ENGINE (TEST)", positions: ["RUN", "CUT"], defaultPosition: "RUN", provenance: "Simulation test switch: shuts off fuel to the left engine" }, onChange: (to, ctx) => { ctx.setEngineFuelCutoff("left", to === "CUT"); return { accepted: true }; } }
      ];
      // Speedbrake logic (GAF T.O.): electrically deactivated (retracted) when main or boost pressure is
      // below 10 MPa, with the gear extended, or without DC power; blow-back above 540 KIAS (estimated
      // linear limit over 60 kt). Main-pressure loss leaves the surface where the air pushes it (not modelled: held).
      const guardedFcs: typeof fcs = { ...fcs,
        step: (pilot: Parameters<typeof fcs.step>[0], sensors: Parameters<typeof fcs.step>[1], surfaces: Parameters<typeof fcs.step>[2], dt: number) => {
          const p = sensors.hydraulicPressuresPa ?? {}, low = HYD.lowPressurePa.value;
          const dcOn = sensors.electricalBuses?.["dc"]?.powered ?? true;
          const allowed = speedbrakeSwitch && (p["main"] ?? 21e6) >= low && (p["booster"] ?? 21e6) >= low && sensors.gearUpLocked !== false && dcOn;
          fcs.setSpeedbrake(allowed);
          const out = fcs.step(pilot, sensors, surfaces, dt);
          const kias = Math.sqrt((2 * sensors.dynamicPressurePa) / 1.225) / 0.514444;
          const blow = Math.max(0, Math.min(1, 1 - (kias - HYD.speedbrakeBlowBackKias.value) / 60));
          const sb = out.commands["speedbrake"];
          return sb === undefined ? out : { ...out, commands: { ...out.commands, speedbrake: sb * blow } };
        }
      };
      return { aero: mig29Aerodynamics(), fcs: guardedFcs, switches, devices: lefSchedule(), accessoryDrives: mig29AccessoryDrives(), intakes: mig29IntakeSystem(["left", "right"]), hydraulicLoads: mig29HydraulicLoads() };
    }
  };
}

function enginePanel(s: AircraftSnapshot) {
  const max = MIG29_ENGINE.maxAfterburnerThrustN.value;
  return { title: "ENGINES", lines: [
    ...s.engines.map((e) => `${e.id === "left" ? "L" : "R"} RPM ${(e.spoolSpeed * 100).toFixed(0).padStart(3)}% ${e.flameout ? "OUT" : e.afterburnerLit ? "AB" : "  "} ${(e.netThrustN / max * 100).toFixed(0).padStart(3)}%`),
    `THR  ${(s.throttle * 100).toFixed(0)}%`,
    `FUEL ${s.fuelKg.toFixed(0)} kg`,
    `MASS ${s.massKg.toFixed(0)} kg`
  ] };
}

function systemsPanel(s: AircraftSnapshot) {
  const D = 180 / Math.PI;
  const hyd = (id: string) => ((s.hydraulics?.circuits.find((c) => c.id === id)?.pressurePa ?? 0) / 1e5).toFixed(0).padStart(4);
  return { title: s.fcsMode, lines: [
    `STAB ${(s.surfaces["elevator"] ?? 0).toFixed(1)}  AIL ${(s.surfaces["aileron"] ?? 0).toFixed(1)}`,
    `RUD  ${(s.surfaces["rudder"] ?? 0).toFixed(1)}  LEF ${(s.surfaces["lef"] ?? 0).toFixed(0)}`,
    `AOA  ${(s.alphaRad * D).toFixed(1)}  NZ ${s.nzG.toFixed(2)}`,
    `HYD MAIN ${hyd("main")} BST ${hyd("booster")} bar`,
    `GEAR ${s.gear ? (s.gear.extension >= 1 ? "DN" : s.gear.extension <= 0 ? "UP" : "TRANSIT") : "-"}${s.gear?.weightOnWheels ? " WOW" : ""}`,
    ...s.annunciations
  ] };
}
