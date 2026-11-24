/**
 * F-16C Block 50 package definition: everything aircraft-specific, expressed through the shared
 * AircraftDefinition contract. The shared FixedWingAircraft runtime flies it.
 */
import type { ModuleManifest } from "../../../core/modules/ModuleTypes.js";
import type { AeroModel, AircraftDefinition, FlightControlSystem, ScheduledDevices, SwitchBinding } from "../common/AircraftDefinition.js";
import type { AircraftSnapshot } from "../common/FixedWingAircraft.js";
import { F16_COCKPIT_LAYOUT } from "./F16CockpitLayout.js";
import { applyCompressibility, compressibilityFactors, controlEffectiveness } from "./F16Compressibility.js";
import { F16_ACTUATORS, F16_ENGINE, F16_GEOMETRY, F16_MASS, F16_SPEEDBRAKE } from "./F16Data.js";
import { F16FlightControls } from "./F16FlightControls.js";
import { F110_CONTROL, F110_DESIGN } from "./F110Engine.js";
import { f16Aerodynamics, f16InertiaTensor } from "./F16FlightModel.js";
import { f16HifiAerodynamics, LefSchedule } from "./F16HifiAerodynamics.js";
import { F16_SWITCHES, F16_TEST_CG } from "./F16Switches.js";

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

/** Aero adapter: maps the shared named surfaces onto the F-16 coefficient assembly. */
function f16Aero(model: F16AeroModelId): AeroModel {
  return {
    id: model === "hifi" ? "f16.nasa-tp1538.hifi" : "f16.stevens-lewis.lofi",
    compute: (input) => {
      const surfaces = { elevatorDeg: input.surfaces["elevator"] ?? 0, aileronDeg: input.surfaces["aileron"] ?? 0, rudderDeg: input.surfaces["rudder"] ?? 0 };
      const base = { ...input, surfaces };
      const out = model === "hifi" ? f16HifiAerodynamics({ ...base, lefDeg: input.surfaces["lef"] ?? 0, controlEffectiveness: controlEffectiveness(input.mach) }) : f16Aerodynamics(base);
      // Compressibility (NASA TP-3355 supersonic data; transonic estimated) on the low-speed tables.
      const c = applyCompressibility(out.coefficients, input.alphaRad, input.mach);
      // Speedbrake drag along the air-relative velocity (estimated ΔCD; see F16_SPEEDBRAKE).
      const sb = Math.max(0, Math.min(1, (input.surfaces["speedbrake"] ?? 0) / F16_SPEEDBRAKE.maxDeflectionDeg.value));
      const dCd = sb * F16_SPEEDBRAKE.dragCoefficientAtFull.value;
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
        envelopeReasons: reasons
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
    step: (s, dt) => ({ lef: lef.step(s.alphaRad, s.dynamicPressurePa, s.staticPressurePa, dt) })
  };
}

export function createF16Definition(options: { aeroModel?: F16AeroModelId } = {}): AircraftDefinition {
  const model = options.aeroModel ?? "hifi";
  const a = F16_ACTUATORS;
  return {
    manifest: F16_MANIFEST,
    displayName: "F-16C Block 50",
    dataNote: "Provisional flight model: NASA TP-1538 low-speed F-16 wind-tunnel data (not Block 50-specific, no data above Mach 0.6; NASA TP-3355 supersonic corrections, transonic estimated), F110 gas-path engine calibrated to published thrust with a FADEC (PRI/SEC), project-designed fly-by-wire.",
    mass: { emptyMassKg: F16_MASS.emptyMassKg.value, inertiaKgM2: f16InertiaTensor(), referenceMassKg: F16_MASS.massKg.value, cgFractionMac: F16_MASS.cgFractionMac.value, internalFuelKg: F16_ENGINE.internalFuelKg.value },
    surfaces: [
      { id: "elevator", limitDeg: a.elevatorLimitDeg.value, rateDegS: a.elevatorRateDegS.value, bandwidthRadS: a.bandwidthRadS.value },
      { id: "aileron", limitDeg: a.aileronLimitDeg.value, rateDegS: a.aileronRateDegS.value, bandwidthRadS: a.bandwidthRadS.value },
      { id: "rudder", limitDeg: a.rudderLimitDeg.value, rateDegS: a.rudderRateDegS.value, bandwidthRadS: a.bandwidthRadS.value },
      { id: "speedbrake", limitDeg: F16_SPEEDBRAKE.maxDeflectionDeg.value, rateDegS: F16_SPEEDBRAKE.rateDegS.value, bandwidthRadS: 10 }
    ],
    // Thrust along body x through the CG: engine offset/cant not sourced.
    engines: [{ id: "f110", design: F110_DESIGN, control: F110_CONTROL, positionBodyM: [0, 0, 0], thrustAxisBody: [1, 0, 0] }],
    cockpit: F16_COCKPIT_LAYOUT,
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
        }
      ];
      // Track the achieved stabilator so DIRECT can capture it as trim.
      const trackingFcs: FlightControlSystem = {
        reset: () => fcs.reset(),
        mode: () => fcs.mode(),
        step: (pilot, sensors, surfaces, dt) => { lastElevator = surfaces["elevator"] ?? 0; return fcs.step(pilot, sensors, surfaces, dt); }
      };
      const devices = f16Devices(model);
      return { aero: f16Aero(model), fcs: trackingFcs, switches, ...(devices ? { devices } : {}) };
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
      `RPM  ${(e.spoolSpeed * 100).toFixed(0).padStart(3)} %`,
      `TIT  ${e.turbineInletTemperatureK.toFixed(0)} K`,
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
      ...s.annunciations
    ]
  };
}
