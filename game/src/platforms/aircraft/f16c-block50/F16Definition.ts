/**
 * F-16C Block 50 package definition: everything aircraft-specific, expressed through the shared
 * AircraftDefinition contract. The shared FixedWingAircraft runtime flies it.
 */
import { F16_EFB } from "./F16Efb.js";
import type { ModuleManifest } from "../../../core/modules/ModuleTypes.js";
import { groundEffect, groundEffectPitchIncrement, type WingPlanform } from "../../../physics/aerodynamics/GroundEffect.js";
import { buffetIntensity, LaggedFlowState, smoothStep } from "../../../physics/aerodynamics/UnsteadyFlow.js";
import type { AeroModel, AircraftDefinition, FlightControlSystem, ScheduledDevices, SwitchBinding } from "../common/AircraftDefinition.js";
import type { AircraftSnapshot } from "../common/FixedWingAircraft.js";
import { F16_COCKPIT_LAYOUT } from "./F16CockpitLayout.js";
import { applyCompressibility, compressibilityFactors, controlEffectiveness, LOW_SPEED_REFERENCE } from "./F16Compressibility.js";
import { F16_ACTUATORS, F16_ENGINE, F16_GEAR, F16_GEOMETRY, F16_HYDRAULICS, F16_MASS, F16_SPEEDBRAKE } from "./F16Data.js";
import { f16AccessoryDrives, f16SystemsCoupling, F16_ELECTRICAL_INSTALLATION } from "./F16Electrical.js";
import { f16FuelSystem, f16TankSpecs } from "./F16FuelSystem.js";
import { F16FlightControls } from "./F16FlightControls.js";
import { F110_CONTROL, F110_DESIGN } from "./F110Engine.js";
import { f16Aerodynamics, f16InertiaTensor } from "./F16FlightModel.js";
import { f16HifiAerodynamics, LefSchedule } from "./F16HifiAerodynamics.js";
import { F16_HYDRAULIC_INSTALLATION } from "./F16Hydraulics.js";
import { F16_LANDING_GEAR } from "./F16LandingGear.js";
import { F16_SWITCHES, F16_TEST_CG, F16_TEST_HYDRAULIC_FAULTS } from "./F16Switches.js";

export const F16_MANIFEST: ModuleManifest = {
  manifestSchemaVersion: 1,
  id: "aircraft.f16c-block50",
  kind: "aircraft",
  name: "F-16C Block 50 (provisional data)",
  version: "0.1.0",
  apiCompatibility: { minimum: "0.1.0", maximumExclusive: "0.2.0" },
  variant: { family: "F-16 Fighting Falcon", designation: "F-16C Block 50", revision: "provisional", operatorBaseline: "not frozen" },
  provides: [{ id: "platform.aircraft.definition", apiVersion: "0.1.0" }],
  dependencies: [],
  configuration: [],
  lifecycle: { initialization: "scenario-load", updateDomain: "fixed-tick", deterministic: true, supportsSaveState: false },
  provenance: {
    maintainer: "Iron-Front",
    source: "NASA TP-1538 aero (via Stevens & Lewis / UMN nlplant); F110 cycle from public references; project-designed FLCS",
    notes: "Not a validated Block 50 model. See game/modules/planes/F-16/flight-model/README.md."
  }
};

export type F16AeroModelId = "hifi" | "lofi";

const F16_WING: WingPlanform = {
  spanM: F16_GEOMETRY.spanM.value,
  aspectRatio: F16_GEOMETRY.spanM.value ** 2 / F16_GEOMETRY.wingAreaM2.value,
  midChordSweepRad: (F16_GEOMETRY.midChordSweepDeg.value * Math.PI) / 180
};

/**
 * Ground effect (shared physics/aerodynamics/GroundEffect.ts) applied to the F-16 coefficients:
 * attached-flow lift scaled by the lift-slope factor (blended out between α 12° and 20°, as for
 * compressibility), and ideal induced drag CL²/(πA) rescaled by φ at the new lift.
 */
function applyGroundEffect(c: { cx: number; cz: number; cm: number }, alphaRad: number, mach: number, heightM: number | undefined): { cx: number; cz: number; cm: number } {
  const ge = groundEffect(F16_WING, heightM === undefined ? undefined : heightM + F16_GEOMETRY.wingHeightAboveCgM.value, mach);
  if (ge.inducedDragFactor >= 1 && ge.liftSlopeFactor <= 1) return c;
  const ca = Math.cos(alphaRad), sa = Math.sin(alphaRad);
  const cl = -c.cz * ca + c.cx * sa, cd = -c.cx * ca - c.cz * sa;
  const attached = 1 - Math.min(1, Math.max(0, (Math.abs(alphaRad) * 180 / Math.PI - 12) / 8));
  const cl0 = LOW_SPEED_REFERENCE.cl0;
  const clGe = cl0 + (cl - cl0) * (1 + (ge.liftSlopeFactor - 1) * attached);
  const ideal = (x: number) => (x * x) / (Math.PI * F16_WING.aspectRatio);
  const cdGe = cd - ideal(cl) + ge.inducedDragFactor * ideal(clGe);
  // Tail downwash falls near the ground → nose-down increment (DATCOM approach; k estimated).
  return { cx: -cdGe * ca + clGe * sa, cz: -clGe * ca - cdGe * sa, cm: c.cm + groundEffectPitchIncrement(ge, clGe, F16_UNSTEADY.groundEffectTailSensitivity) };
}

/**
 * Unsteady separation on top of the STATIC NASA tables (shared physics/aerodynamics/UnsteadyFlow.ts):
 * ΔCL = CLα·α·(x − x0(α)), zero in steady flight, so the measured data are reproduced exactly.
 * ESTIMATED (no F-16 identification values in the repo): x0 departs from attached flow over
 * 15–40° (where the TP-1538 lift curve bends), τ1 = 12 c/V, τ2 = 4 c/V (Goman–Khrabrov range),
 * the transient lift acts at ≈25 % MAC (0.10 MAC ahead of the 0.35 reference), shock-buffet onset CL.
 */
export const F16_UNSTEADY = Object.freeze({
  tau1Chords: 12, tau2Chords: 4, separationOnsetDeg: 15, separationWidthDeg: 25, transientLiftArmMac: 0.10,
  buffetOnsetClLowMach: 1.0, buffetOnsetClM095: 0.55, groundEffectTailSensitivity: 0.35
});

/** Aero adapter: maps the shared named surfaces onto the F-16 coefficient assembly. */
function f16Aero(model: F16AeroModelId): AeroModel {
  const U = F16_UNSTEADY;
  const attachment = new LaggedFlowState({ tau1Chords: U.tau1Chords, tau2Chords: U.tau2Chords });
  const x0 = (a: number) => 1 - smoothStep((Math.abs(a) * 180 / Math.PI - U.separationOnsetDeg) / U.separationWidthDeg);
  return {
    id: model === "hifi" ? "f16.nasa-tp1538.hifi" : "f16.stevens-lewis.lofi",
    compute: (input) => {
      const surfaces = { elevatorDeg: input.surfaces["elevator"] ?? 0, aileronDeg: input.surfaces["aileron"] ?? 0, rudderDeg: input.surfaces["rudder"] ?? 0 };
      const base = { ...input, surfaces };
      const out = model === "hifi" ? f16HifiAerodynamics({ ...base, lefDeg: input.surfaces["lef"] ?? 0, controlEffectiveness: controlEffectiveness(input.mach) }) : f16Aerodynamics(base);
      // Compressibility (NASA TP-3355 supersonic data; transonic estimated) on the low-speed tables.
      const cs = applyGroundEffect(applyCompressibility(out.coefficients, input.alphaRad, input.mach), input.alphaRad, input.mach, input.heightAboveGroundM);
      const x = attachment.step(input.alphaRad, x0, F16_GEOMETRY.meanChordM.value, input.trueAirspeedMps, input.stepSeconds);
      const dCl = LOW_SPEED_REFERENCE.clAlphaPerDeg * compressibilityFactors(input.mach).liftScale * (input.alphaRad * 180 / Math.PI) * (x - x0(input.alphaRad));
      const c = { cx: cs.cx + dCl * Math.sin(input.alphaRad), cz: cs.cz - dCl * Math.cos(input.alphaRad), cm: cs.cm + U.transientLiftArmMac * dCl };
      // Speedbrake drag along the air-relative velocity (estimated ΔCD; see F16_SPEEDBRAKE).
      const sb = Math.max(0, Math.min(1, (input.surfaces["speedbrake"] ?? 0) / F16_SPEEDBRAKE.maxDeflectionDeg.value));
      // Plus landing-gear drag in proportion to extension (estimated ΔCD; see F16_GEAR).
      const dCd = sb * F16_SPEEDBRAKE.dragCoefficientAtFull.value + Math.max(0, Math.min(1, input.surfaces["gear"] ?? 0)) * F16_GEAR.dragCoefficient.value;
      const cx = c.cx - dCd * Math.cos(input.alphaRad) * Math.cos(input.betaRad);
      const cz = c.cz - dCd * Math.sin(input.alphaRad);
      const qS = input.dynamicPressurePa * F16_GEOMETRY.wingAreaM2.value;
      const reasons = out.envelopeReasons.filter((r) => !r.startsWith("Mach"));
      const f = compressibilityFactors(input.mach);
      if (input.mach > 2.16) reasons.push(`Mach ${input.mach.toFixed(2)} above the TP-3355 supersonic data (M 2.16)`);
      else if (f.basis === "estimated" && input.mach > 0.85) reasons.push(`Mach ${input.mach.toFixed(2)}: transonic corrections are estimated`);
      return {
        forceBodyN: [qS * cx, out.forceBodyN[1], qS * cz],
        momentBodyNm: [out.momentBodyNm[0], qS * F16_GEOMETRY.meanChordM.value * c.cm, out.momentBodyNm[2]],
        outsideEnvelope: reasons.length > 0,
        envelopeReasons: reasons,
        buffet: buffetIntensity(x, -c.cz * Math.cos(input.alphaRad) + c.cx * Math.sin(input.alphaRad), input.mach,
          (m) => (m >= 1.1 ? 0 : m <= 0.6 ? U.buffetOnsetClLowMach : U.buffetOnsetClLowMach + (U.buffetOnsetClM095 - U.buffetOnsetClLowMach) * Math.min(1, (m - 0.6) / 0.35)))
      };
    }
  };
}

/** FLCS adapter: NORM (project-designed fly-by-wire) or DIRECT (test: stick straight to surfaces). */
function f16Fcs(): FlightControlSystem & { setMode(mode: "NORM" | "DIRECT", currentElevatorDeg: number): void; setSpeedbrake(out: boolean): void } {
  const flcs = new F16FlightControls();
  let mode: "NORM" | "DIRECT" = "NORM";
  let speedbrakeOut = false;
  let directTrimDeg = 0;
  const a = F16_ACTUATORS;
  return {
    reset: () => { flcs.reset(); },
    mode: () => mode,
    setSpeedbrake: (out: boolean) => { speedbrakeOut = out; },
    setMode: (m, currentElevatorDeg) => {
      mode = m;
      // Entering DIRECT keeps the current stabilator position as pitch trim (like a trim wheel).
      directTrimDeg = m === "DIRECT" ? currentElevatorDeg : 0;
      flcs.reset();
    },
    step: (pilot, sensors, _surfaces, dt) => {
      const out = flcs.step(pilot, sensors, dt);
      if (mode === "DIRECT") {
        // Source sign conventions: negative elevator = nose up, negative aileron = roll right, negative rudder = nose right.
        return {
          mode,
          annunciations: ["FLCS DIRECT — NO AUGMENTATION (TEST)"],
          commands: { elevator: directTrimDeg - pilot.pitch * a.elevatorLimitDeg.value, aileron: -pilot.roll * a.aileronLimitDeg.value, rudder: -pilot.yaw * a.rudderLimitDeg.value, speedbrake: speedbrakeOut ? F16_SPEEDBRAKE.maxDeflectionDeg.value : 0 }
        };
      }
      return {
        mode,
        annunciations: out.alphaLimiting ? ["AOA LIMIT"] : [],
        commands: { elevator: out.commands.elevatorDeg, aileron: out.commands.aileronDeg, rudder: out.commands.rudderDeg, speedbrake: speedbrakeOut ? F16_SPEEDBRAKE.maxDeflectionDeg.value : 0 }
      };
    }
  };
}

function f16Devices(model: F16AeroModelId): ScheduledDevices | undefined {
  if (model !== "hifi") return undefined;
  const lef = new LefSchedule();
  return {
    reset: () => lef.reset(),
    // Command to the hydraulic LEF actuator (surface "lef").
    step: (s, dt) => ({ lef: lef.command(s.alphaRad, s.dynamicPressurePa, s.staticPressurePa, dt) })
  };
}

const F16_FUEL_CAPACITY_KG = f16TankSpecs().reduce((s, t) => s + t.capacityKg, 0);

export function createF16Definition(options: { aeroModel?: F16AeroModelId } = {}): AircraftDefinition {
  const model = options.aeroModel ?? "hifi";
  const a = F16_ACTUATORS;
  return {
    manifest: F16_MANIFEST,
    displayName: "F-16C Block 50",
    dataNote: "Provisional flight model: NASA TP-1538 low-speed F-16 wind-tunnel data (not Block 50-specific, no data above Mach 0.6; NASA TP-3355 supersonic corrections, transonic estimated), F110 gas-path engine calibrated to published thrust with a FADEC (PRI/SEC), project-designed fly-by-wire.",
    mass: { emptyMassKg: F16_MASS.emptyMassKg.value, inertiaKgM2: f16InertiaTensor(), referenceMassKg: F16_MASS.massKg.value, cgFractionMac: F16_MASS.zeroFuelCgFractionMac.value, internalFuelKg: F16_FUEL_CAPACITY_KG, macM: F16_GEOMETRY.meanChordM.value },
    surfaces: [
      { id: "elevator", limitDeg: a.elevatorLimitDeg.value, rateDegS: a.elevatorRateDegS.value, bandwidthRadS: a.bandwidthRadS.value },
      { id: "aileron", limitDeg: a.aileronLimitDeg.value, rateDegS: a.aileronRateDegS.value, bandwidthRadS: a.bandwidthRadS.value },
      { id: "rudder", limitDeg: a.rudderLimitDeg.value, rateDegS: a.rudderRateDegS.value, bandwidthRadS: a.bandwidthRadS.value },
      { id: "speedbrake", limitDeg: F16_SPEEDBRAKE.maxDeflectionDeg.value, minDeg: 0, rateDegS: F16_SPEEDBRAKE.rateDegS.value, bandwidthRadS: 10 },
      // Leading-edge flaps: TP-1538 appendix A actuator (0.136 s lag, 25°/s, 0–25°).
      ...(model === "hifi" ? [{ id: "lef", limitDeg: 25, minDeg: 0, rateDegS: LefSchedule.rateLimitDegS, bandwidthRadS: 1 / 0.136 }] : [])
    ],
    // Thrust along body x through the CG: engine offset/cant not sourced.
    engines: [{ id: "f110", design: F110_DESIGN, control: F110_CONTROL, positionBodyM: [0, 0, 0], thrustAxisBody: [1, 0, 0] }],
    hydraulics: F16_HYDRAULIC_INSTALLATION,
    landingGear: F16_LANDING_GEAR,
    annunciate: f16Annunciations,
    createFuelSystem: () => f16FuelSystem(),
    electrical: F16_ELECTRICAL_INSTALLATION,
    systemsCoupling: f16SystemsCoupling,
    cockpit: F16_COCKPIT_LAYOUT,
    efb: F16_EFB,
    mfdPages: { "mfd-left": engPage, "mfd-right": flcsPage },
    createSystems: () => {
      const fcs = f16Fcs();
      let lastElevator = 0;
      const switches: SwitchBinding[] = [
        {
          key: "f",
          definition: { id: F16_SWITCHES.flcsMode, ownerId: "f16.flcs", label: "FLCS MODE", positions: ["NORM", "DIRECT"], defaultPosition: "NORM", provenance: "Simulation test switch. The real F-16 has no fly-by-wire OFF switch." },
          onChange: (to) => { fcs.setMode(to as "NORM" | "DIRECT", lastElevator); return { accepted: true }; }
        },
        {
          key: "b",
          definition: { id: F16_SWITCHES.speedbrake, ownerId: "f16.speedbrake", label: "SPEEDBRAKE", positions: ["RETRACT", "EXTEND"], defaultPosition: "RETRACT", provenance: "Real F-16 control is a 3-position throttle thumb switch; modelled as a toggle" },
          onChange: (to) => { fcs.setSpeedbrake(to === "EXTEND"); return { accepted: true }; }
        },
        {
          key: "c",
          definition: { id: F16_SWITCHES.testCg, ownerId: "f16.mass", label: "CG (TEST)", positions: Object.keys(F16_TEST_CG), defaultPosition: "NOMINAL", provenance: "Simulation test setting. Moves the CG used by the aero CG-offset terms; mass and inertia are unchanged." },
          onChange: (to, ctx) => { ctx.setCgFractionMac(F16_TEST_CG[to as keyof typeof F16_TEST_CG]); return { accepted: true }; }
        },
        {
          key: "n",
          definition: { id: F16_SWITCHES.engineControl, ownerId: "f16.engine.control", label: "ENG CONT", positions: ["PRI", "SEC"], defaultPosition: "PRI", provenance: "F-16 engine control switch: PRI = digital electronic control, SEC = hydromechanical secondary control (guarded switch in the real cockpit)" },
          onChange: (to, ctx) => { ctx.setEngineControlMode("f110", to === "SEC" ? "backup" : "primary"); return { accepted: true }; }
        },
        {
          key: "g",
          definition: { id: F16_SWITCHES.gearHandle, ownerId: "f16.landing-gear", label: "LDG GR", positions: ["UP", "DN"], defaultPosition: "DN", provenance: "F-16 landing-gear handle; cannot retract with weight on wheels (squat interlock in the gear model)" },
          onChange: (to, ctx) => { ctx.setGearHandle(to === "DN"); return { accepted: true }; }
        },
        {
          key: "j",
          definition: { id: F16_SWITCHES.electricalFault, ownerId: "f16.electrical", label: "ELEC FAULT (TEST)", positions: ["NORMAL", "MAIN GEN FAIL", "MAIN+STBY GEN FAIL"], defaultPosition: "NORMAL", provenance: "Simulation test switch: fails engine-driven generators. Not a real F-16 control." },
          onChange: (to, ctx) => { ctx.setElectricalSourcesOff(to === "NORMAL" ? [] : to === "MAIN GEN FAIL" ? ["gen.main"] : ["gen.main", "gen.standby"]); return { accepted: true }; }
        },
        {
          key: "h",
          definition: { id: F16_SWITCHES.hydraulicFault, ownerId: "f16.hydraulics", label: "HYD FAULT (TEST)", positions: Object.keys(F16_TEST_HYDRAULIC_FAULTS), defaultPosition: "NORMAL", provenance: "Simulation test switch: fails engine-driven hydraulic pumps. Not a real F-16 control." },
          onChange: (to, ctx) => { ctx.setHydraulicFaults(F16_TEST_HYDRAULIC_FAULTS[to as keyof typeof F16_TEST_HYDRAULIC_FAULTS].map((pumpId) => ({ kind: "pump-failed" as const, pumpId }))); return { accepted: true }; }
        }
      ];
      // Track the achieved stabilator so DIRECT can capture it as trim.
      const trackingFcs: FlightControlSystem = {
        reset: () => fcs.reset(),
        mode: () => fcs.mode(),
        step: (pilot, sensors, surfaces, dt) => {
          lastElevator = surfaces["elevator"] ?? 0;
          // Without FLCS power the computers stop commanding: surfaces hold where they are.
          if (sensors.electricalBuses?.["flcs"]?.powered === false) {
            return { mode: fcs.mode(), annunciations: ["FLCS POWER LOST"], commands: { ...surfaces } };
          }
          return fcs.step(pilot, sensors, surfaces, dt);
        }
      };
      const devices = f16Devices(model);
      return { aero: f16Aero(model), fcs: trackingFcs, switches, accessoryDrives: f16AccessoryDrives(), ...(devices ? { devices } : {}) };
    }
  };
}

function engPage(s: AircraftSnapshot) {
  const e = s.engines[0];
  const max = F16_ENGINE.maxAfterburnerThrustN.value;
  if (!e) return { title: "ENG", lines: ["NO ENGINE"] };
  return {
    title: "ENG",
    lines: [
      `THR  ${(s.throttle * 100).toFixed(0).padStart(3)} %`,
      `RPM  ${(e.spoolSpeed * 100).toFixed(0).padStart(3)} %  N1 ${((e.n1Rpm ?? 0) / 1000).toFixed(1)}k`,
      `EGT  ${(e.exhaustGasTemperatureK ?? e.turbineInletTemperatureK).toFixed(0)} K${e.outsideDeck ? "  (EXTRAP)" : ""}`,
      `THRUST ${(e.netThrustN / 1000).toFixed(1)} kN`,
      `       ${((e.netThrustN / max) * 100).toFixed(0)}% of max`,
      `A/B  ${e.afterburnerLit ? "ON" : "OFF"}  NOZ ${Number.isFinite(e.nozzle.position) ? (e.nozzle.position * 100).toFixed(0).padStart(3) + "%" : " — "}`,
      `CONT ${e.control.mode === "backup" ? "SEC" : "PRI"}  N DMD ${(e.control.speedDemand * 100).toFixed(0)}%`,
      `LIM  ${e.control.activeLimits.filter((l) => l !== "acceleration" && l !== "deceleration").map(limitLabel).join(" ") || "—"}`,
      `FF   ${(e.fuelFlowKgS * 3600).toFixed(0)} kg/h`,
      `FUEL ${s.fuelKg.toFixed(0)} kg`,
      `GW   ${s.massKg.toFixed(0)} kg`,
      "F110 CYCLE: CALIBRATED"
    ]
  };
}

function limitLabel(l: string): string {
  return ({ "max-speed": "NMAX", "corrected-speed": "NCOR", "compressor-exit-temperature": "T3", "turbine-inlet-temperature": "TIT", "nozzle-area": "NOZ", "min-burner-pressure": "PB MIN", "afterburner-inhibited": "AB INH", "afterburner-envelope": "AB ENV" } as Record<string, string>)[l] ?? l;
}

function flcsPage(s: AircraftSnapshot) {
  const D = 180 / Math.PI;
  const f = (n: number | undefined) => (n ?? 0).toFixed(1).padStart(6);
  return {
    title: `FLCS ${s.fcsMode}`,
    lines: [
      `STAB ${f(s.surfaces["elevator"])}°`,
      `FLPN ${f(s.surfaces["aileron"])}°`,
      `RUD  ${f(s.surfaces["rudder"])}°`,
      `LEF  ${f(s.surfaces["lef"])}°`,
      `SPDB ${f(s.surfaces["speedbrake"])}°`,
      `AOA  ${(s.alphaRad * D).toFixed(1).padStart(6)}°`,
      `NZ   ${s.nzG.toFixed(2).padStart(6)} g`,
      `CG   ${(s.cgFractionMac * 100).toFixed(0)}% MAC ${s.switches[F16_SWITCHES.testCg] ?? ""}`,
      `GEAR ${gearText(s)}`,
      `HYD  A ${psi(s, "A")}  B ${psi(s, "B")}${s.hydraulics?.emergencyUnit && s.hydraulics.emergencyUnit.state !== "off" ? "  EPU " + s.hydraulics.emergencyUnit.state.toUpperCase() : ""}`,
      ...s.annunciations
    ]
  };
}

function psi(s: AircraftSnapshot, circuitId: string): string {
  const c = s.hydraulics?.circuits.find((x) => x.id === circuitId);
  return c ? (c.pressurePa / 6894.757).toFixed(0).padStart(4) : " ---";
}

/** F-16 cautions from the hydraulic network (thresholds in F16_HYDRAULICS; see provenance there). */
function f16Annunciations(s: AircraftSnapshot): { text: string; level: "caution" | "warning" }[] {
  const out: { text: string; level: "caution" | "warning" }[] = [];
  const low = (s.hydraulics?.circuits ?? []).filter((c) => c.pressurePa < F16_HYDRAULICS.cautionBelowPa.value).map((c) => c.id);
  if (low.length > 0) out.push({ text: `HYD PRESS ${low.join("+")}`, level: low.length > 1 ? "warning" : "caution" });
  const g = s.gear;
  if (g && g.extension > 0 && g.extension < 1) out.push({ text: "GEAR IN TRANSIT", level: "caution" });
  if (g && !g.handleDown && g.extension <= 0 && s.ground.kind === "airborne" && s.ground.aglM < 300 && s.verticalSpeedMps < -2 && s.equivalentAirspeedMps < 95) out.push({ text: "GEAR UP — LANDING", level: "warning" });
  const epu = s.hydraulics?.emergencyUnit;
  const online = (id: string) => s.electrical?.sources.find((x) => x.id === id)?.online ?? true;
  if (!online("gen.main")) out.push({ text: "ELEC SYS", level: "caution" });
  if (s.electrical?.buses.find((b) => b.id === "flcs")?.sourceId === "battery.flcs") out.push({ text: "FLCS PMG", level: "caution" });
  if (epu && epu.state !== "off") out.push({ text: epu.state === "depleted" ? "EPU FUEL DEPLETED" : "EPU RUN", level: epu.state === "depleted" ? "warning" : "caution" });
  return out;
}

function gearText(s: AircraftSnapshot): string {
  const g = s.gear;
  if (!g) return "—";
  const pos = g.extension >= 1 ? "DN LOCKED" : g.extension <= 0 ? "UP" : `TRANSIT ${(g.extension * 100).toFixed(0)}%`;
  return `${pos}${g.weightOnWheels ? "  WOW" : ""}`;
}
