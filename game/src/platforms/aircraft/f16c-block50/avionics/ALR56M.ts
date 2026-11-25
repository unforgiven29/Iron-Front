/**
 * AN/ALR-56M radar warning receiver installation for the F-16C Block 50 and its threat display
 * (azimuth indicator). Runs on the shared RWR engine (sensors/rwr).
 *
 * PROVISIONAL: the ALR-56M is a superheterodyne, wide-band RWR with four quadrant spiral antennas;
 * exact sensitivity, DF accuracy, band edges and threat-library contents are not public. Every
 * number here is ESTIMATED from the receiver class, and the library is a fictional/notional set
 * written for the game's emitters. Display conventions follow the general ALR-56M style: nose up,
 * symbols placed by bearing, stronger (closer/more lethal) emitters nearer the centre, a diamond on
 * the priority threat, a "new guy" hat, a circle on steady illumination, flashing on a missile.
 */
import type { DisplayList, DisplayPrimitive } from "../../../../rendering/instruments/DisplayList.js";
import type { RwrContact, RwrProfile } from "../../../../sensors/rwr/RadarWarningReceiver.js";

const D = Math.PI / 180;
const spiral = (id: string, azDeg: number) => ({ id, azimuthRad: azDeg * D, peakGainDbi: 3, beamwidthRad: 90 * D, floorDb: -20 });

export const ALR56M_PROFILE: RwrProfile = {
  id: "alr56m.f16c50", designation: "AN/ALR-56M (provisional)",
  provenance: [
    "Architecture (superhet receiver, 4 quadrant antennas, amplitude-comparison DF): public descriptions of the ALR-56M class",
    "Band 2–20 GHz, sensitivity −65 dBm, 1.5 dB amplitude noise (≈8° rms DF), 5 MHz frequency error: ESTIMATED",
    "Threat library: NOTIONAL entries for the game's emitters, not real mission data"
  ],
  bandHz: [2e9, 20e9],
  sensitivityDbm: -65,
  amplitudeNoiseDb: 1.5,
  antennas: [spiral("fwd-right", 45), spiral("aft-right", 135), spiral("aft-left", -135), spiral("fwd-left", -45)],
  directionFinding: { kind: "continuous" },
  frequencySigmaHz: 5e6,
  prfRelativeSigma: 0.005,
  pulseWidthSigmaS: 50e-9,
  processingDelayS: 0.5,
  dropAfterS: 6,
  steady: { minS: 1.0, maxStdDb: 2.5 },
  maxTracks: 16,
  library: [
    { id: "fighter-x-a", symbol: "16", category: "airborne-radar", bandHz: [9.5e9, 10.1e9], prfHz: [[8e3, 20e3], [140e3, 200e3]], pulseWidthS: [0.8e-6, 1.6e-6], lethality: 5 },
    { id: "fighter-x-b", symbol: "29", category: "airborne-radar", bandHz: [9.0e9, 10.0e9], prfHz: [[90e3, 130e3], [1e3, 4e3]], pulseWidthS: [1.5e-6, 3e-6], lethality: 5 },
    { id: "aam-active-ku", symbol: "M", category: "missile-seeker", bandHz: [14e9, 18e9], prfHz: [[60e3, 250e3]], pulseWidthS: [0.2e-6, 1.2e-6], lethality: 10 }
  ]
};

/** Threat display (screen frame, nose up). `blink` toggles at ~2 Hz for missile flashing. */
export function alr56mDisplay(contacts: readonly RwrContact[], powered: boolean, blink: boolean): DisplayList {
  const out: DisplayPrimitive[] = [];
  out.push({ kind: "circle", frame: "screen", at: [0, 0], radius: 0.92, color: "#2f6b45" });
  out.push({ kind: "circle", frame: "screen", at: [0, 0], radius: 0.5, dash: true, color: "#2f6b45" });
  out.push({ kind: "line", frame: "screen", points: [[-0.08, 0], [0.08, 0]], color: "#2f6b45" }, { kind: "line", frame: "screen", points: [[0, -0.08], [0, 0.08]], color: "#2f6b45" });
  for (let a = 0; a < 360; a += 30) {
    const r = a * D;
    out.push({ kind: "line", frame: "screen", points: [[0.92 * Math.sin(r), 0.92 * Math.cos(r)], [0.98 * Math.sin(r), 0.98 * Math.cos(r)]], color: "#2f6b45" });
  }
  if (!powered) { out.push({ kind: "text", frame: "screen", at: [0, -0.05], text: "OFF", align: "center", size: 0.12 }); return out; }
  const shown = contacts.slice(0, 8);
  shown.forEach((c, i) => {
    const missile = c.match?.entry.category === "missile-seeker";
    // Radial position: missiles and steady illumination inside the inner ring, others by signal level.
    const strength = Math.max(0, Math.min(1, (c.levelDbm + 65) / 45));
    const r = missile || c.steadyIllumination ? 0.3 : 0.85 - 0.3 * strength;
    const x = r * Math.sin(c.bearingRad), y = r * Math.cos(c.bearingRad);
    if (missile && !blink) return;
    const color = missile || c.steadyIllumination ? "#ff6b5e" : undefined;
    out.push({ kind: "text", frame: "screen", at: [x, y - 0.05], text: c.match?.entry.symbol ?? "U", align: "center", size: 0.13, ...(color ? { color } : {}) });
    if (c.steadyIllumination || missile) out.push({ kind: "circle", frame: "screen", at: [x, y], radius: 0.12, ...(color ? { color } : {}) });
    if (c.isNew) out.push({ kind: "line", frame: "screen", points: [[x - 0.09, y + 0.07], [x - 0.05, y + 0.12], [x + 0.05, y + 0.12], [x + 0.09, y + 0.07]] });
    if (i === 0) out.push({ kind: "line", frame: "screen", points: [[x, y + 0.15], [x + 0.15, y], [x, y - 0.15], [x - 0.15, y]], closed: true });
  });
  out.push({ kind: "text", frame: "screen", at: [-0.95, -0.95], text: "ALR-56M", size: 0.07, color: "#2f6b45" });
  return out;
}
