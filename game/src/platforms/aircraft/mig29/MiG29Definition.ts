/**
 * MiG-29 package definition (provisional, family-level data; see MiG29Data.ts). Everything
 * MiG-29-specific is here and in the files it imports; it imports NOTHING from the F-16 package.
 * Shared code used: the FixedWingAircraft runtime, rigid body, atmosphere, terrain, propulsion
 * (generic-map cycle + FADEC), hydraulics, ground handling, ground effect, cockpit renderer.
 */
import type { ModuleManifest } from "../../../core/modules/ModuleTypes.js";
import type { AircraftDefinition, ScheduledDevices, SwitchBinding } from "../common/AircraftDefinition.js";
import type { AircraftSnapshot } from "../common/FixedWingAircraft.js";
import { mig29Aerodynamics } from "./MiG29Aerodynamics.js";
import { MIG29_COCKPIT_LAYOUT } from "./MiG29Cockpit.js";
import { mig29ControlSystem, type SauMode } from "./MiG29ControlSystem.js";
import { MIG29_CONTROLS as K, MIG29_ENGINE, MIG29_GEOMETRY as G, MIG29_MASS as M } from "./MiG29Data.js";
import { MIG29_ENGINES } from "./MiG29Engines.js";
import { MIG29_HYDRAULIC_INSTALLATION, MIG29_LANDING_GEAR } from "./MiG29Systems.js";

export const MIG29_SWITCHES = Object.freeze({ sau: "mig29.test.sau", speedbrake: "mig29.speedbrake", gear: "mig29.gear.handle", hydraulicFault: "mig29.test.hydraulic-fault", leftEngine: "mig29.test.left-engine" });

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
    source: "Family-level published geometry and RD-33 ratings; textbook-method aerodynamics; GAF T.O. 1F-MIG29-1 system descriptions",
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

/** Automatic leading-edge flaps: deploy with alpha above the onset, retract above Mach 0.85 (estimated). */
function lefSchedule(): ScheduledDevices {
  return {
    reset: () => {},
    step: (s) => ({ lef: s.mach > 0.85 ? 0 : Math.max(0, Math.min(K.lefMaxDeg.value, (s.alphaRad * 180 / Math.PI - K.lefAlphaOnsetDeg.value) * 2)) })
  };
}

export function createMiG29Definition(): AircraftDefinition {
  const referenceMass = M.emptyMassKg.value + M.internalFuelKg.value / 2;
  return {
    manifest: MIG29_MANIFEST,
    displayName: "MiG-29 (provisional)",
    dataNote: "PROVISIONAL: family-level published geometry and RD-33 ratings, textbook-method aerodynamics and estimated control laws. No verified MiG-29 9.13 data is public; this proves the modular systems, not MiG-29 fidelity.",
    mass: { emptyMassKg: M.emptyMassKg.value, inertiaKgM2: inertia(referenceMass), referenceMassKg: referenceMass, cgFractionMac: M.cgFractionMac.value, internalFuelKg: M.internalFuelKg.value },
    surfaces: [
      { id: "elevator", limitDeg: K.stabilatorLimitDeg.value, rateDegS: K.stabilatorRateDegS.value, bandwidthRadS: 20 },
      { id: "aileron", limitDeg: K.aileronLimitDeg.value, rateDegS: K.aileronRateDegS.value, bandwidthRadS: 20 },
      { id: "rudder", limitDeg: K.rudderLimitDeg.value, rateDegS: K.rudderRateDegS.value, bandwidthRadS: 20 },
      { id: "lef", limitDeg: K.lefMaxDeg.value, minDeg: 0, rateDegS: 15, bandwidthRadS: 5 },
      { id: "speedbrake", limitDeg: 60, minDeg: 0, rateDegS: 30, bandwidthRadS: 10 }
    ],
    engines: MIG29_ENGINES,
    hydraulics: MIG29_HYDRAULIC_INSTALLATION,
    landingGear: MIG29_LANDING_GEAR,
    cockpit: MIG29_COCKPIT_LAYOUT,
    mfdPages: { "panel-left": enginePanel, "panel-right": systemsPanel },
    annunciate: (s) => {
      const out: { text: string; level: "caution" | "warning" }[] = [];
      for (const e of s.engines) if (e.flameout) out.push({ text: `${e.id.toUpperCase()} ENGINE OUT`, level: "warning" });
      const low = (s.hydraulics?.circuits ?? []).filter((c) => c.pressurePa < 0.4 * 21e6).map((c) => c.id.toUpperCase());
      if (low.length) out.push({ text: `HYD ${low.join("+")} LOW`, level: low.length > 1 ? "warning" : "caution" });
      return out;
    },
    createSystems: () => {
      const fcs = mig29ControlSystem();
      const switches: SwitchBinding[] = [
        { key: "f", definition: { id: MIG29_SWITCHES.sau, ownerId: "mig29.sau", label: "SAU (TEST)", positions: ["ON", "OFF"], defaultPosition: "ON", provenance: "Simulation test switch for the stability-augmentation dampers" }, onChange: (to) => { fcs.setSau(to as SauMode); return { accepted: true }; } },
        { key: "b", definition: { id: MIG29_SWITCHES.speedbrake, ownerId: "mig29.speedbrake", label: "AIRBRAKE", positions: ["RETRACT", "EXTEND"], defaultPosition: "RETRACT", provenance: "Upper/lower airbrakes modelled as one surface" }, onChange: (to) => { fcs.setSpeedbrake(to === "EXTEND"); return { accepted: true }; } },
        { key: "g", definition: { id: MIG29_SWITCHES.gear, ownerId: "mig29.gear", label: "GEAR", positions: ["UP", "DN"], defaultPosition: "DN", provenance: "Landing-gear handle" }, onChange: (to, ctx) => { ctx.setGearHandle(to === "DN"); return { accepted: true }; } },
        { key: "h", definition: { id: MIG29_SWITCHES.hydraulicFault, ownerId: "mig29.hydraulics", label: "HYD FAULT (TEST)", positions: ["NORMAL", "MAIN PUMP FAIL", "BOOSTER PUMP FAIL"], defaultPosition: "NORMAL", provenance: "Simulation test switch" }, onChange: (to, ctx) => { ctx.setHydraulicFaults(to === "NORMAL" ? [] : [{ kind: "pump-failed", pumpId: to.startsWith("MAIN") ? "pump.main" : "pump.booster" }]); return { accepted: true }; } },
        { key: "l", definition: { id: MIG29_SWITCHES.leftEngine, ownerId: "mig29.engines", label: "L ENGINE (TEST)", positions: ["RUN", "CUT"], defaultPosition: "RUN", provenance: "Simulation test switch: shuts off fuel to the left engine" }, onChange: (to, ctx) => { ctx.setEngineFuelCutoff("left", to === "CUT"); return { accepted: true }; } }
      ];
      return { aero: mig29Aerodynamics(), fcs, switches, devices: lefSchedule() };
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
