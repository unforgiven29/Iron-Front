/**
 * MiG-29 cockpit layout (untextured, APPROXIMATE geometry: not measured): an analogue main panel of
 * round instruments driven by the live snapshot, clickable levers and switches wired to the
 * package's switch logic, centre stick, throttle on the left and a canopy front bow.
 * Instrument choice and arrangement follow the general layout of GAF T.O. 1F-MIG29-1 Section 1
 * (MiG-29G); positions, ranges and colour bands other than those noted are ESTIMATED.
 *
 * Power: pitot-static instruments (IAS, altimeter, VSI) and the self-powered tachometers and EGT
 * thermocouples need no aircraft power. The attitude indicator and hydraulic pressure gauges are
 * modelled on the 36 V AC bus and the fuel gauge on the DC bus (ESTIMATED assignment); without
 * power they show OFF instead of a reading.
 */
import type { CockpitLayout, CockpitPart } from "../../../rendering/three/CockpitLayout.js";
import type { InstrumentFace } from "../../../rendering/instruments/Gauges.js";
import type { AircraftSnapshot } from "../common/FixedWingAircraft.js";
import { MIG29_HYDRAULICS as H } from "./MiG29Data.js";

const PANEL = "#2b3a35", DARK = "#1a211e", FRAME = "#3f4a45";
const RED = "#d33", GREEN = "#2e9e4f", AMBER = "#e0a020";

/** Switch ids (kept in step with MIG29_SWITCHES in MiG29Definition.ts; asserted by tests). */
const SW = {
  gear: "mig29.gear.handle", flaps: "mig29.flaps", speedbrake: "mig29.speedbrake", emergencyGear: "mig29.gear.emergency",
  batGnd: "mig29.elec.bat-gnd", dcGen: "mig29.elec.dc-gen", acGen: "mig29.elec.ac-gen", pto: "mig29.elec.pto"
} as const;

/** Main panel plane: tilted 0.3 rad (top away from the pilot). Face coordinates u (right) and v (down) → body FRD. */
const TILT = -0.3, FACE_X = 0.845, FACE_Z = 0.42;
const onPanel = (u: number, v: number): [number, number, number] => [FACE_X + Math.sin(TILT) * v, u, FACE_Z + Math.cos(TILT) * v];
const DIAL = 0.115;
const instrument = (id: string, u: number, v: number, face: InstrumentFace): CockpitPart =>
  ({ id, kind: "instrument", positionM: onPanel(u, v), sizeM: [DIAL, DIAL, 0], rotationRad: [0, TILT, 0], color: "#000", instrument: face });
const lever = (id: string, switchId: string, positions: readonly string[], positionM: [number, number, number], sizeM: [number, number, number], color: string): CockpitPart =>
  ({ id, kind: "box", positionM, sizeM, color, binding: { kind: "switch", switchId, positions } });

const MPA = 1e6;
export const MIG29_COCKPIT_LAYOUT: CockpitLayout = {
  aircraftId: "mig29",
  provenance: "Approximate visual layout after GAF T.O. 1F-MIG29-1 Section 1; not measured geometry",
  eyeFromCgM: [4.9, 0, -1.15],
  fieldOfViewDeg: 62,
  parts: [
    { id: "panel", kind: "box", positionM: [0.88, 0, 0.42], sizeM: [0.06, 0.78, 0.34], rotationRad: [0, TILT, 0], color: PANEL },
    { id: "glareshield", kind: "box", positionM: [0.8, 0, 0.23], sizeM: [0.22, 0.62, 0.05], color: DARK },
    // Top row: flight instruments. Bottom row: engines and systems.
    instrument("ias", -0.27, -0.035, { kind: "dial", label: "IAS", unit: "km/h", min: 0, max: 1600, majorStep: 200, minorStep: 50, labelDivisor: 100 }),
    instrument("adi", -0.135, -0.035, { kind: "attitude", label: "ADI" }),
    instrument("alt", 0, -0.035, { kind: "dial", label: "ALT", unit: "m", min: 0, max: 1000, majorStep: 100, minorStep: 20, labelDivisor: 100, startDeg: 0, sweepDeg: 360, wrap: true, readout: { divisor: 1000, digits: 2, suffix: " km" } }),
    instrument("vsi", 0.135, -0.035, { kind: "dial", label: "VSI", unit: "m/s", min: -100, max: 100, majorStep: 50, minorStep: 10, startDeg: -225, sweepDeg: 270 }),
    instrument("fuel", 0.27, -0.035, { kind: "dial", label: "FUEL", unit: "kg ×1000", min: 0, max: 4000, majorStep: 1000, minorStep: 250, labelDivisor: 1000, readout: { digits: 0, suffix: " kg" } }),
    instrument("rpm", -0.27, 0.105, { kind: "dial", label: "RPM", unit: "% NH", min: 0, max: 110, majorStep: 10, labelDivisor: 1, needles: ["L", "R"], bands: [{ from: 100, to: 110, color: RED }] }),
    instrument("egt", -0.135, 0.105, { kind: "dial", label: "EGT", unit: "°C ×100", min: 200, max: 1000, majorStep: 100, minorStep: 50, labelDivisor: 100, needles: ["L", "R"] }),
    instrument("hyd", 0.135, 0.105, { kind: "dial", label: "HYD", unit: "MPa", min: 0, max: 30, majorStep: 5, minorStep: 1, needles: ["M", "B"],
      bands: [{ from: 0, to: H.lowPressurePa.value / MPA, color: RED }, { from: H.pumpMinPressurePa.value / MPA, to: 22, color: GREEN }] }),
    instrument("n2", 0.27, 0.105, { kind: "dial", label: "N2 AIR", unit: "MPa", min: 0, max: 16, majorStep: 4, minorStep: 1, needles: ["M", "E"], bands: [{ from: 0, to: 5, color: AMBER }] }),
    instrument("g", 0, 0.105, { kind: "dial", label: "G", unit: "g", min: -3, max: 10, majorStep: 1, startDeg: -135, sweepDeg: 270, bands: [{ from: 8.5, to: 10, color: RED }] }),
    // Levers and switches (clickable; positions are approximate).
    lever("gear-lever", SW.gear, ["UP", "DN"], [0.62, -0.44, 0.36], [0.04, 0.03, 0.08], "#c33"),
    lever("emerg-gear", SW.emergencyGear, ["STOWED", "NOSE", "MAIN"], [0.7, -0.33, 0.62], [0.03, 0.06, 0.03], "#e0a020"),
    lever("flap-lever", SW.flaps, ["UP", "TAKEOFF", "LANDING"], [0.32, -0.42, 0.42], [0.05, 0.025, 0.05], "#ddd"),
    lever("airbrake", SW.speedbrake, ["RETRACT", "EXTEND"], [0.24, -0.33, 0.33], [0.02, 0.02, 0.02], "#3c7"),
    lever("sw-bat", SW.batGnd, ["ON", "OFF"], [0.48, 0.39, 0.43], [0.03, 0.02, 0.03], "#ddd"),
    lever("sw-dcgen", SW.dcGen, ["ON", "OFF"], [0.43, 0.39, 0.43], [0.03, 0.02, 0.03], "#ddd"),
    lever("sw-acgen", SW.acGen, ["ON", "OFF"], [0.38, 0.39, 0.43], [0.03, 0.02, 0.03], "#ddd"),
    lever("sw-pto", SW.pto, ["ON", "OFF"], [0.33, 0.39, 0.43], [0.03, 0.02, 0.03], "#ddd"),
    { id: "hud-glass", kind: "glass", positionM: [0.68, 0, 0.06], sizeM: [0.14, 0.14, 0], rotationRad: [0, -0.2, 0], color: "#7fe0a0" },
    { id: "centre-stick", kind: "cylinder", positionM: [0.42, 0, 0.36], sizeM: [0.02, 0.3, 0], color: "#151815", binding: { kind: "stick" } },
    { id: "throttle", kind: "box", positionM: [0.2, -0.33, 0.38], sizeM: [0.07, 0.05, 0.1], color: "#151815", binding: { kind: "throttle" } },
    { id: "console-left", kind: "box", positionM: [0.2, -0.4, 0.48], sizeM: [0.7, 0.15, 0.08], color: PANEL },
    { id: "console-right", kind: "box", positionM: [0.2, 0.4, 0.48], sizeM: [0.7, 0.15, 0.08], color: PANEL },
    { id: "canopy-bow-l", kind: "box", positionM: [0.75, -0.3, -0.1], sizeM: [0.03, 0.03, 0.5], rotationRad: [0.35, 0, 0], color: FRAME },
    { id: "canopy-bow-r", kind: "box", positionM: [0.75, 0.3, -0.1], sizeM: [0.03, 0.03, 0.5], rotationRad: [-0.35, 0, 0], color: FRAME },
    { id: "sill-left", kind: "box", positionM: [0.25, -0.48, 0.3], sizeM: [1.4, 0.04, 0.04], color: FRAME },
    { id: "sill-right", kind: "box", positionM: [0.25, 0.48, 0.3], sizeM: [1.4, 0.04, 0.04], color: FRAME }
  ]
};

const DEG = 180 / Math.PI;
const NAN = Number.NaN;
const powered = (s: AircraftSnapshot, bus: string) => s.electrical?.buses.find((b) => b.id === bus)?.powered ?? true;
const eng = (s: AircraftSnapshot, id: string) => s.engines.find((e) => e.id === id);
const egtC = (s: AircraftSnapshot, id: string) => { const e = eng(s, id); const k = e?.exhaustGasTemperatureK ?? e?.stations?.Tt6K; return k === undefined ? NAN : k - 273.15; };
const hyd = (s: AircraftSnapshot, id: string) => (s.hydraulics?.circuits.find((c) => c.id === id)?.pressurePa ?? NAN) / MPA;
const n2 = (s: AircraftSnapshot, id: string) => (s.pneumatics?.systems.find((x) => x.id === id)?.pressurePa ?? NAN) / MPA;

/** Instrument values from the snapshot, by part id (non-finite = no valid signal → OFF flag). */
export const MIG29_COCKPIT_INSTRUMENTS: Readonly<Record<string, (s: AircraftSnapshot) => readonly number[]>> = {
  ias: (s) => [s.equivalentAirspeedMps * 3.6],
  alt: (s) => [s.altitudeMslM],
  vsi: (s) => [s.verticalSpeedMps],
  adi: (s) => (powered(s, "ac36") ? [s.pitchRad * DEG, s.rollRad * DEG] : [NAN, NAN]),
  fuel: (s) => (powered(s, "dc") ? [s.fuelKg] : [NAN]),
  rpm: (s) => [(eng(s, "left")?.spoolSpeed ?? NAN) * 100, (eng(s, "right")?.spoolSpeed ?? NAN) * 100],
  egt: (s) => [egtC(s, "left"), egtC(s, "right")],
  hyd: (s) => (powered(s, "ac36") ? [hyd(s, "main"), hyd(s, "booster")] : [NAN, NAN]),
  n2: (s) => [n2(s, "main"), n2(s, "emergency")],
  g: (s) => [s.nzG]
};
