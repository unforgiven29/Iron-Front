/**
 * СПО-15ЛМ «Берёза» radar warning receiver installation for the MiG-29 and its indicator panel.
 * Runs on the shared RWR engine (sensors/rwr).
 *
 * PROVISIONAL: crystal-video, wide-open receiver with sector direction finding. Public descriptions
 * give its general form (forward sector lamps finer than the rear, a signal-strength scale, emitter
 * type lamps and a lock lamp); exact sensitivity, band edges, sector boundaries, antenna placement
 * and library are not public, and the 9.13 fit/nomenclature is unverified (see
 * game/modules/planes/MiG-29A/RWR/README.md). Every number here is ESTIMATED; the type library is
 * NOTIONAL and has no entry for active missile seekers (a seeker shows only as an untyped emitter).
 */
import type { DisplayList, DisplayPrimitive } from "../../../../rendering/instruments/DisplayList.js";
import type { RwrContact, RwrProfile } from "../../../../sensors/rwr/RadarWarningReceiver.js";

const D = Math.PI / 180;
/** Sector edges, deg: forward 10/30/50/90 each side, one rear sector each side. */
export const SPO15_SECTOR_EDGES_DEG = [-180, -90, -50, -30, -10, 10, 30, 50, 90] as const;

export const SPO15_PROFILE: RwrProfile = {
  id: "spo15lm.mig29", designation: "СПО-15ЛМ (provisional)",
  provenance: [
    "Form (crystal-video, sector DF, strength scale, type and lock lamps): public descriptions of the SPO-15 family",
    "Band 1.2–18 GHz, sensitivity −45 dBm, 2 dB amplitude noise, sector edges, antenna layout: ESTIMATED",
    "Type library: NOTIONAL entries, no missile-seeker entry"
  ],
  bandHz: [1.2e9, 18e9],
  sensitivityDbm: -45,
  amplitudeNoiseDb: 2,
  antennas: [
    { id: "fwd-l-outer", azimuthRad: -60 * D, peakGainDbi: 4, beamwidthRad: 50 * D, floorDb: -25 },
    { id: "fwd-l-inner", azimuthRad: -20 * D, peakGainDbi: 4, beamwidthRad: 50 * D, floorDb: -25 },
    { id: "fwd-r-inner", azimuthRad: 20 * D, peakGainDbi: 4, beamwidthRad: 50 * D, floorDb: -25 },
    { id: "fwd-r-outer", azimuthRad: 60 * D, peakGainDbi: 4, beamwidthRad: 50 * D, floorDb: -25 },
    { id: "aft-right", azimuthRad: 140 * D, peakGainDbi: 2, beamwidthRad: 100 * D, floorDb: -20 },
    { id: "aft-left", azimuthRad: -140 * D, peakGainDbi: 2, beamwidthRad: 100 * D, floorDb: -20 }
  ],
  directionFinding: { kind: "sectors", edgesRad: SPO15_SECTOR_EDGES_DEG.map((d) => d * D) },
  frequencySigmaHz: 400e6,
  prfRelativeSigma: 0.05,
  pulseWidthSigmaS: 0.3e-6,
  processingDelayS: 0.3,
  dropAfterS: 5,
  steady: { minS: 1.0, maxStdDb: 3 },
  maxTracks: 8,
  library: [
    { id: "airborne-x", symbol: "П", category: "airborne-radar", bandHz: [8e9, 12.5e9], prfHz: [[1e3, 300e3]], pulseWidthS: [0.1e-6, 5e-6], lethality: 5 },
    { id: "awacs-s", symbol: "С", category: "airborne-radar", bandHz: [2e9, 4e9], prfHz: [[100, 5e3]], pulseWidthS: [1e-6, 50e-6], lethality: 1 },
    { id: "lr-sam", symbol: "З", category: "ground-radar", bandHz: [8e9, 10e9], prfHz: [[100, 2e3]], pulseWidthS: [10e-6, 60e-6], lethality: 8 },
    { id: "mr-sam", symbol: "Х", category: "ground-radar", bandHz: [10e9, 12e9], prfHz: [[2e3, 6e3]], pulseWidthS: [0.5e-6, 3e-6], lethality: 7 },
    { id: "old-sam", symbol: "Н", category: "ground-radar", bandHz: [2.5e9, 3.5e9], prfHz: [[300, 1500]], pulseWidthS: [0.5e-6, 2e-6], lethality: 6 },
    { id: "f-band", symbol: "F", category: "ground-radar", bandHz: [5e9, 6e9], prfHz: [[500, 3e3]], pulseWidthS: [0.5e-6, 2e-6], lethality: 6 }
  ]
};

const TYPE_LAMPS = ["П", "З", "Х", "Н", "F", "С"] as const;
const ON = "#ffcf3a", OFF = "#3b3420", RED = "#ff4b3a", REDOFF = "#3d1a17", GRN = "#7dff9a";

/**
 * Indicator panel (screen frame): sector lamps around an aircraft symbol (every detected emitter
 * lights its sector; the main threat's sector is red), a 15-lamp strength scale for the main threat,
 * its type lamp and the ЗАХВ (lock) lamp. Layout ESTIMATED.
 */
export function spo15Display(contacts: readonly RwrContact[], powered: boolean, blink: boolean): DisplayList {
  const out: DisplayPrimitive[] = [];
  const main = powered ? contacts[0] : undefined;
  const lit = new Set<number>();
  const edges = SPO15_SECTOR_EDGES_DEG;
  const sectorOf = (bearing: number) => {
    const d = bearing / D;
    for (let i = 0; i < edges.length - 1; i++) if (d >= edges[i]! && d < edges[i + 1]!) return i;
    return edges.length - 1;
  };
  if (powered) for (const c of contacts) lit.add(sectorOf(c.bearingRad));
  const mainSector = main ? sectorOf(main.bearingRad) : -1;
  // Aircraft symbol.
  out.push({ kind: "line", frame: "screen", points: [[0, 0.02], [0, -0.3]], color: GRN, width: 2 },
    { kind: "line", frame: "screen", points: [[-0.2, -0.12], [0.2, -0.12]], color: GRN, width: 2 },
    { kind: "line", frame: "screen", points: [[-0.08, -0.28], [0.08, -0.28]], color: GRN, width: 2 });
  // Sector lamps on an arc (centre of each sector).
  for (let i = 0; i < edges.length; i++) {
    const a = edges[i]!, b = i + 1 < edges.length ? edges[i + 1]! : 180;
    const mid = ((a + b) / 2) * D;
    const r = 0.58;
    const x = r * Math.sin(mid), y = -0.13 + r * Math.cos(mid) * 0.85;
    const isMain = i === mainSector;
    const color = isMain ? (main?.steadyIllumination && !blink ? REDOFF : RED) : lit.has(i) ? ON : OFF;
    out.push({ kind: "circle", frame: "screen", at: [x, y], radius: 0.065, fill: true, color });
  }
  // Strength scale (15 lamps), left side.
  const strength = main ? Math.max(0, Math.min(15, Math.round(((main.levelDbm + 45) / 40) * 15))) : 0;
  for (let i = 0; i < 15; i++) out.push({ kind: "line", frame: "screen", points: [[-0.92, -0.75 + i * 0.1], [-0.8, -0.75 + i * 0.1]], width: 4, color: i < strength ? (i >= 11 ? RED : ON) : OFF });
  // Type lamps, top row.
  TYPE_LAMPS.forEach((t, i) => {
    const on = !!main && main.match?.entry.symbol === t;
    out.push({ kind: "text", frame: "screen", at: [-0.62 + i * 0.25, 0.78], text: t, align: "center", size: 0.16, color: on ? ON : OFF });
  });
  // Lock lamp.
  const lock = !!main && main.steadyIllumination;
  out.push({ kind: "text", frame: "screen", at: [0.62, -0.88], text: "ЗАХВ", align: "center", size: 0.13, color: lock ? RED : REDOFF });
  if (!powered) out.push({ kind: "text", frame: "screen", at: [0.1, -0.9], text: "ВЫКЛ", align: "center", size: 0.1, color: OFF });
  return out;
}
