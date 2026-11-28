/**
 * MiG-29 product 9.13 cockpit presentation.
 *
 * The current cockpit is intentionally a neutral structural blockout. The procedural shell
 * provides the tub, blank instrument-panel structure, empty side-console trays, bare seat frame
 * and canopy structure. No instrument/display overlays or clickable cockpit controls are fitted.
 *
 * Keep the snapshot-derived instrument sources below available for a later, separately verified
 * panel-integration pass. They are not rendered while MIG29_COCKPIT_LAYOUT.parts is empty.
 *
 * Geometry and equipment fit remain provisional family-level approximations, not a measured
 * 1:1 product 9.13 cockpit.
 */
import type { CockpitLayout } from "../../../rendering/three/CockpitLayout.js";
import type { AircraftSnapshot } from "../common/FixedWingAircraft.js";
import { MIG29_HYDRAULICS as H } from "./MiG29Data.js";
import { createMiG29CockpitShell } from "./MiG29CockpitModel.js";

export const MIG29_COCKPIT_LAYOUT: CockpitLayout = {
  aircraftId: "mig29",
  provenance: "Neutral structural shell only. Reference-guided family-level geometry; exact product 9.13 dimensions, equipment fit and eye datum remain unverified.",
  eyeFromCgM: [4.9, 0, -1.15],
  fieldOfViewDeg: 72,
  cameraPitchOffsetRad: -0.08,
  buildShell: createMiG29CockpitShell,
  parts: []
};

const DEG = 180 / Math.PI;
const NAN = Number.NaN;
const KGF = 98066.5; // Pa per kgf/cm²
const powered = (s: AircraftSnapshot, bus: string) => s.electrical?.buses.find((b) => b.id === bus)?.powered ?? true;
const eng = (s: AircraftSnapshot, id: string) => s.engines.find((e) => e.id === id);
const egtC = (s: AircraftSnapshot, id: string) => {
  const e = eng(s, id);
  const k = e?.exhaustGasTemperatureK ?? e?.stations?.Tt6K;
  return k === undefined ? NAN : k - 273.15;
};
const hyd = (s: AircraftSnapshot, id: string) => (s.hydraulics?.circuits.find((c) => c.id === id)?.pressurePa ?? NAN) / KGF;
const gas = (s: AircraftSnapshot, id: string) => (s.pneumatics?.systems.find((x) => x.id === id)?.pressurePa ?? NAN) / KGF;
const agl = (s: AircraftSnapshot) => (s.ground.kind === "airborne" ? s.ground.aglM : s.ground.kind === "on-ground" ? 0 : NAN);

/**
 * Snapshot-derived instrument values reserved for later panel integration.
 * No instrument meshes are currently included in the cockpit layout.
 */
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
  ramps: (s) => (powered(s, "ac36") ? [(s.inlets?.["left"]?.rampExtension ?? NAN) * 100, (s.inlets?.["right"]?.rampExtension ?? NAN) * 100] : [NAN, NAN]),
  hydraulicPressureCautionReferencePa: () => [H.lowPressurePa.value]
};
