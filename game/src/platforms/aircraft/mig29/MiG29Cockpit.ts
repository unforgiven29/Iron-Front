/**
 * MiG-29 product 9.13 cockpit presentation.
 *
 * The static cockpit tub, seat, canopy, consoles and physical panel hardware are built
 * by the companion procedural Three.js shell module. The live instruments and supported click controls remain data-driven overlays here.
 *
 * Evidence boundary: the procedural shell is an original, reference-guided family-level reconstruction. The
 * public photo set is not positively identified as product 9.13 and does not provide full
 * dimensional drawings. Do not call the model a measured 1:1 product 9.13 cockpit. The layout's
 * photo-derived instrument coordinates and several instrument identifications remain estimates.
 *
 * Visual references: IrasD, MiG-29 cockpit photographs 1–4 (c.1995), Wikimedia Commons,
 * CC BY-SA 4.0; GAF T.O. 1F-MIG29-1 (German Air Force installation, exact baseline applicability
 * unverified); Eagle Dynamics MiG-29 manual (simulator variant caveat). Full provenance is in the
 * companion asset manifest and cockpit reconstruction specification.
 *
 * Instrument power behavior and values are sourced/estimated as individually noted below.
 */
import type { CockpitLayout, CockpitPart } from "../../../rendering/three/CockpitLayout.js";
import type { InstrumentFace } from "../../../rendering/instruments/Gauges.js";
import type { AircraftSnapshot } from "../common/FixedWingAircraft.js";
import { MIG29_HYDRAULICS as H } from "./MiG29Data.js";
import { createMiG29CockpitShell } from "./MiG29CockpitModel.js";

const RED = "#d33", YELLOW = "#e0b020";

/** Switch ids (kept in step with MIG29_SWITCHES in MiG29Definition.ts; asserted by tests). */
const SW = {
  gear: "mig29.gear.handle", flaps: "mig29.flaps", speedbrake: "mig29.speedbrake", emergencyGear: "mig29.gear.emergency",
  batGnd: "mig29.elec.bat-gnd", dcGen: "mig29.elec.dc-gen", acGen: "mig29.elec.ac-gen", pto: "mig29.elec.pto"
} as const;

/**
 * Panel geometry. The main panel is a centre section tilted 0.3 rad (top away from the pilot) with
 * left and right wings yawed toward the pilot beyond |u| > WING_U (the photographs show the outer
 * instruments turned inward; the 0.38 rad yaw is ESTIMATED from "cockpit 3", not measured).
 * Face coordinates u (right), v (down), metres → body FRD from the eye. The live face planes sit 27 mm forward of the structural panel to prevent z-fighting.
 */
const TILT = -0.3, FACE_X = 0.818, FACE_Z = 0.37, WING_U = 0.2, WING_YAW = 0.38;
const onPanel = (u: number, v: number): [number, number, number] => {
  const over = Math.max(0, Math.abs(u) - WING_U), side = Math.sign(u);
  const lateral = side * (Math.min(Math.abs(u), WING_U) + over * Math.cos(WING_YAW));
  return [FACE_X + Math.sin(TILT) * v - over * Math.sin(WING_YAW), lateral, FACE_Z + Math.cos(TILT) * v];
};
const panelRot = (u: number): [number, number, number] => [0, TILT, Math.abs(u) > WING_U ? Math.sign(u) * WING_YAW : 0];
/** Provisional photo-to-metre registration ("cockpit 3", 870 px crop); perspective and absolute scale are not calibrated. */
const PX = 0.1 / 75, OX = 390, OY = 190;
const at = (x: number, y: number): [number, number] => [(x - OX) * PX, (y - OY) * PX];
const round = (id: string, x: number, y: number, dPx: number, face: InstrumentFace): CockpitPart => {
  const [u, v] = at(x, y), d = dPx * PX;
  return { id, kind: "instrument", positionM: onPanel(u, v), sizeM: [d, d, 0], rotationRad: panelRot(u), color: "#000", instrument: face };
};
const rect = (id: string, x: number, y: number, wPx: number, hPx: number, face: InstrumentFace): CockpitPart => {
  const [u, v] = at(x, y);
  return { id, kind: "instrument", positionM: onPanel(u, v), sizeM: [wPx * PX, hPx * PX, 0], rotationRad: panelRot(u), color: "#000", instrument: face };
};
const screenAt = (id: string, screen: string, x: number, y: number, w: number, h: number): CockpitPart => {
  const [u, v] = at(x, y);
  return { id, kind: "screen", positionM: onPanel(u, v), sizeM: [w, h, 0], rotationRad: panelRot(u), color: "#101214", screen };
};
const lever = (id: string, switchId: string, positions: readonly string[], positionM: [number, number, number], sizeM: [number, number, number], color: string): CockpitPart =>
  ({ id, kind: "box", positionM, sizeM, color, binding: { kind: "switch", switchId, positions } });
const KGF = 98066.5; // Pa per kgf/cm²

export const MIG29_COCKPIT_LAYOUT: CockpitLayout = {
  aircraftId: "mig29",
  provenance: "Original reference-guided procedural cockpit shell plus live overlay layout. Family-level photo arrangement only; dimensions, selected 9.13 equipment fit and eye datum are not fully verified.",
  eyeFromCgM: [4.9, 0, -1.15],
  fieldOfViewDeg: 62,
  buildShell: createMiG29CockpitShell,
  parts: [
    // Physical dashboard, HUD assembly, canopy rails, cockpit tub and consoles are in the procedural shell.
    // Dynamic instruments below intentionally share the same eye-relative photo transform as its bezels.
    // Flight instruments (left of the stick, Soviet "T").
    round("ias", 130, 165, 65, { kind: "dial", label: "КУС", unit: "км/ч", min: 0, max: 1600, majorStep: 200, minorStep: 50, labelDivisor: 100, needles: ["", ""] }),
    round("alt", 140, 235, 65, { kind: "dial", label: "ВД", unit: "м", min: 0, max: 1000, majorStep: 100, minorStep: 20, labelDivisor: 100, startDeg: 0, sweepDeg: 360, wrap: true, readout: { divisor: 1000, digits: 2, suffix: " км" } }),
    round("adi", 255, 150, 75, { kind: "attitude", label: "КПП" }),
    round("hsi", 245, 245, 95, { kind: "hsi", label: "ПНП" }),
    round("aoa", 340, 140, 55, { kind: "dial", label: "α", unit: "град", min: 0, max: 40, majorStep: 10, minorStep: 2, startDeg: -120, sweepDeg: 240, bands: [{ from: 26, to: 40, color: RED }], readout: { index: 1, digits: 1, suffix: " g" } }),
    round("ralt", 330, 215, 55, { kind: "dial", label: "РВ", unit: "м", min: 0, max: 1500, majorStep: 100, marks: [0, 50, 100, 200, 300, 600, 1000, 1500],
      scale: [[0, 0], [50, 0.15], [100, 0.27], [200, 0.43], [300, 0.55], [600, 0.75], [1000, 0.9], [1500, 1]] }),
    // Engine and systems cluster (right of the stick).
    round("vvi", 440, 145, 60, { kind: "dial", label: "ВАР", unit: "м/с", min: -300, max: 300, majorStep: 100, marks: [-300, -100, -50, -20, 0, 20, 50, 100, 300], startDeg: -260, sweepDeg: 340,
      scale: [[-300, 0], [-100, 0.12], [-50, 0.22], [-20, 0.35], [0, 0.5], [20, 0.65], [50, 0.78], [100, 0.88], [300, 1]] }),
    round("rpm", 515, 140, 60, { kind: "dial", label: "ИТА", unit: "% ×10", min: 0, max: 110, majorStep: 20, minorStep: 5, labelDivisor: 10, needles: ["1", "2"], bands: [{ from: 103, to: 110, color: RED }] }),
    round("egt-l", 445, 210, 55, { kind: "dial", label: "1", unit: "×100°C", min: 200, max: 1000, majorStep: 200, minorStep: 50, labelDivisor: 100, bands: [{ from: 860, to: 900, color: YELLOW }, { from: 900, to: 1000, color: RED }] }),
    round("egt-r", 505, 210, 55, { kind: "dial", label: "2", unit: "×100°C", min: 200, max: 1000, majorStep: 200, minorStep: 50, labelDivisor: 100, bands: [{ from: 860, to: 900, color: YELLOW }, { from: 900, to: 1000, color: RED }] }),
    rect("fuel", 570, 180, 32, 72, { kind: "tapes", title: "ТОПЛ", footer: "т", tapes: [{ label: "Σ", min: 0, max: 5000 }], marks: [0, 1000, 2000, 3000, 4000, 5000] }),
    rect("cabin", 435, 255, 55, 42, { kind: "tapes", title: "Нкаб O2 ΔP", footer: "not simulated", tapes: [{ label: "Н", min: 0, max: 1 }, { label: "O2", min: 0, max: 1 }, { label: "ΔP", min: 0, max: 1 }] }),
    rect("hydgas", 490, 255, 55, 42, { kind: "tapes", title: "ГИДРО  ГАЗ", footer: "кгс/см²", tapes: [
      { label: "ОБЩ", min: 0, max: 250, bands: [{ from: 0, to: H.lowPressurePa.value / KGF, color: RED }] },
      { label: "БУСТ", min: 0, max: 250, bands: [{ from: 0, to: H.lowPressurePa.value / KGF, color: RED }] },
      { label: "ОСН", min: 0, max: 200 }, { label: "АВАР", min: 0, max: 200 }] }),
    rect("ramps", 555, 255, 55, 42, { kind: "tapes", title: "КЛИН", footer: "%", tapes: [{ label: "Л", min: 0, max: 100 }, { label: "П", min: 0, max: 100 }], marks: [0, 50, 100] }),
    // Radar head-down display: repeats the radar/KOLS picture (drawn from the weapon-control system).
    screenAt("hdd", "radar", 600, 95, 0.15, 0.13),
    // СПО-15 indicator (right side of the panel; position approximate).
    screenAt("spo15", "rwr", 650, 215, 0.1, 0.1),
    // Levers and switches (clickable; positions approximate, not from the photographs).
    lever("gear-lever", SW.gear, ["UP", "DN"], [0.62, -0.46, 0.36], [0.04, 0.03, 0.08], "#c33"),
    lever("emerg-gear", SW.emergencyGear, ["STOWED", "NOSE", "MAIN"], [0.7, -0.33, 0.64], [0.03, 0.06, 0.03], YELLOW),
    lever("flap-lever", SW.flaps, ["UP", "TAKEOFF", "LANDING"], [0.32, -0.42, 0.42], [0.05, 0.025, 0.05], "#ddd"),
    lever("airbrake", SW.speedbrake, ["RETRACT", "EXTEND"], [0.24, -0.33, 0.33], [0.02, 0.02, 0.02], "#3c7"),
    lever("sw-bat", SW.batGnd, ["ON", "OFF"], [0.48, 0.41, 0.43], [0.03, 0.02, 0.03], "#ddd"),
    lever("sw-dcgen", SW.dcGen, ["ON", "OFF"], [0.43, 0.41, 0.43], [0.03, 0.02, 0.03], "#ddd"),
    lever("sw-acgen", SW.acGen, ["ON", "OFF"], [0.38, 0.41, 0.43], [0.03, 0.02, 0.03], "#ddd"),
    lever("sw-pto", SW.pto, ["ON", "OFF"], [0.33, 0.41, 0.43], [0.03, 0.02, 0.03], "#ddd"),
    // Live centre-stick shaft and twin-throttle levers are overlaid on the physical procedural assemblies.
    { id: "centre-stick", kind: "cylinder", positionM: [0.42, 0, 0.42], sizeM: [0.016, 0.38, 0], rotationRad: [0, 0.12, 0], color: "#151815", binding: { kind: "stick" } },
    { id: "throttle", kind: "box", positionM: [0.22, -0.385, 0.20], sizeM: [0.06, 0.03, 0.1], color: "#151815", binding: { kind: "throttle" } },
    { id: "throttle-2", kind: "box", positionM: [0.22, -0.35, 0.20], sizeM: [0.06, 0.03, 0.1], color: "#151815", binding: { kind: "throttle" } }
  ]
};

const DEG = 180 / Math.PI;
const NAN = Number.NaN;
const powered = (s: AircraftSnapshot, bus: string) => s.electrical?.buses.find((b) => b.id === bus)?.powered ?? true;
const eng = (s: AircraftSnapshot, id: string) => s.engines.find((e) => e.id === id);
const egtC = (s: AircraftSnapshot, id: string) => { const e = eng(s, id); const k = e?.exhaustGasTemperatureK ?? e?.stations?.Tt6K; return k === undefined ? NAN : k - 273.15; };
const hyd = (s: AircraftSnapshot, id: string) => (s.hydraulics?.circuits.find((c) => c.id === id)?.pressurePa ?? NAN) / KGF;
const gas = (s: AircraftSnapshot, id: string) => (s.pneumatics?.systems.find((x) => x.id === id)?.pressurePa ?? NAN) / KGF;
const agl = (s: AircraftSnapshot) => (s.ground.kind === "airborne" ? s.ground.aglM : s.ground.kind === "on-ground" ? 0 : NAN);

/** Instrument values from the snapshot, by part id (non-finite = no valid signal → OFF / empty). */
export const MIG29_COCKPIT_INSTRUMENTS: Readonly<Record<string, (s: AircraftSnapshot) => readonly number[]>> = {
  ias: (s) => [s.equivalentAirspeedMps * 3.6, s.trueAirspeedMps * 3.6],
  alt: (s) => [s.altitudeMslM],
  vvi: (s) => [s.verticalSpeedMps],
  adi: (s) => (powered(s, "ac36") ? [s.pitchRad * DEG, s.rollRad * DEG] : [NAN, NAN]),
  hsi: (s) => (powered(s, "ac36") ? [((s.headingRad * DEG) % 360 + 360) % 360] : [NAN]),
  aoa: (s) => (powered(s, "ac36") ? [s.alphaRad * DEG, s.nzG] : [NAN, NAN]),
  ralt: (s) => (powered(s, "ac") ? [agl(s)] : [NAN]),
  rpm: (s) => [(eng(s, "left")?.spoolSpeed ?? NAN) * 100, (eng(s, "right")?.spoolSpeed ?? NAN) * 100],
  "egt-l": (s) => [egtC(s, "left")],
  "egt-r": (s) => [egtC(s, "right")],
  fuel: (s) => (powered(s, "dc") ? [s.fuelKg] : [NAN]),
  cabin: () => [NAN, NAN, NAN],
  hydgas: (s) => (powered(s, "ac36") ? [hyd(s, "main"), hyd(s, "booster"), gas(s, "main"), gas(s, "emergency")] : [NAN, NAN, NAN, NAN]),
  ramps: (s) => (powered(s, "ac36") ? [(s.inlets?.["left"]?.rampExtension ?? NAN) * 100, (s.inlets?.["right"]?.rampExtension ?? NAN) * 100] : [NAN, NAN])
};
