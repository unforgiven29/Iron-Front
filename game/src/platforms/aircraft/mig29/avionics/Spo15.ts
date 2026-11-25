/**
 * СПО-15ЛМ indicator (MiG-29 package): draws the processor state (Spo15Lm.ts) on the cockpit
 * screen. Layout after the DCS MiG-29A manual figure (p.106) and photographs of the indicator
 * (front panel only; proportions approximate):
 *  - numbered main-threat bearing lamps 10/30/50/90 left and right on the outer arc (lit amber);
 *  - small green threat lamps inside them; rear: small green lamps and the ◁ ▷ rear main-threat lamps;
 *  - power-level scale: amber arc segments around the centre, starting at the own-ship marker ▲
 *    (lower left) and running clockwise over the top;
 *  - centre disc (red = track / launch warning) behind the aircraft silhouette, with the В/Н
 *    elevation half-lamps on the fuselage; device-ready lamp above the nose;
 *  - type row: main-threat bars (amber) above the letters П З Х Н F С (green = present).
 */
import type { DisplayList, DisplayPrimitive } from "../../../../rendering/instruments/DisplayList.js";
import { type Spo15LmState, type SpoSector, type SpoType } from "./Spo15Lm.js";

const TYPES: readonly SpoType[] = ["П", "З", "Х", "Н", "F", "С"];
const GRN = "#5dff8a", GOFF = "#1d3324", AMB = "#ffa21f", AOFF = "#4a4030", LAMP_TXT = "#1a1408", LAMP_TXT_OFF = "#7a6c52";
const RED = "#ff2a1a", ROFF = "#3a1a14", WHITE = "#f2f2f2", BLACK = "#000000";
const D = Math.PI / 180;
const CY = 0.22;
/** Front bearing lamps: sector → (label, lamp angle from the nose, deg). */
const FRONT: readonly (readonly [SpoSector, string, number])[] = [
  ["L90", "90", -97], ["L50", "50", -62], ["L30", "30", -36], ["L10", "10", -12],
  ["R10", "10", 12], ["R30", "30", 36], ["R50", "50", 62], ["R90", "90", 97]
];
const polar = (r: number, deg: number): [number, number] => [r * Math.sin(deg * D), CY + r * Math.cos(deg * D)];
const arc = (r: number, a0: number, a1: number, n = 10): [number, number][] => Array.from({ length: n + 1 }, (_, i) => polar(r, a0 + ((a1 - a0) * i) / n));

/** Aircraft silhouette (right half, x mirrored), units of 0.3 around the disc centre. */
const HALF: readonly (readonly [number, number])[] = [[0, 1.5], [0.08, 1.2], [0.09, 0.45], [0.62, -0.1], [0.62, -0.3], [0.11, -0.2], [0.11, -0.75], [0.32, -1.02], [0.32, -1.18], [0, -1.0]];
const SILHOUETTE: [number, number][] = [...HALF, ...[...HALF].reverse().slice(1, -1).map(([x, y]) => [-x, y] as const)].map(([x, y]) => [x * 0.3, CY + y * 0.3]);

export function spo15Display(s: Spo15LmState, blink: boolean): DisplayList {
  const out: DisplayPrimitive[] = [];
  const main = s.main?.sector ?? null;
  // Black indicator face.
  out.push({ kind: "line", frame: "screen", points: [[-1, 1], [1, 1], [1, -1], [-1, -1]], fill: "#050505", color: "#050505" });
  // Centre disc: red track / launch warning.
  out.push({ kind: "circle", frame: "screen", at: [0, CY], radius: 0.27, fill: true, color: s.trackWarning ? RED : ROFF });
  // Power-level scale: 15 segments (2 dB per step) from the own-ship marker clockwise.
  const level = s.main?.level ?? -1, A0 = -145, A1 = 145, step = (A1 - A0) / 15;
  for (let i = 0; i < 15; i++) {
    const a = A0 + i * step;
    out.push({ kind: "line", frame: "screen", points: arc(0.39, a + step * 0.18, a + step * 0.82, 3), width: 6, color: i <= level ? AMB : AOFF });
  }
  const own = polar(0.39, A0 - 8);
  out.push({ kind: "line", frame: "screen", points: [[own[0] - 0.05, own[1] + 0.03], [own[0] + 0.04, own[1] + 0.03], [own[0] + 0.01, own[1] - 0.05]], fill: AMB, color: AMB });
  // Aircraft silhouette with the В/Н elevation half-lamps.
  out.push({ kind: "line", frame: "screen", points: SILHOUETTE, fill: BLACK, color: WHITE, width: 2 });
  const el = s.main?.elevation ?? null, er = 0.085, ec: [number, number] = [0, CY + 0.06];
  const half = (top: boolean): [number, number][] => Array.from({ length: 13 }, (_, i) => { const t = (top ? 0 : Math.PI) + (Math.PI * i) / 12; return [ec[0] + er * Math.cos(t), ec[1] + er * Math.sin(t)]; });
  out.push({ kind: "line", frame: "screen", points: half(true), fill: el === "В" ? AMB : AOFF, color: WHITE, width: 1 },
    { kind: "line", frame: "screen", points: half(false), fill: el === "Н" ? AMB : AOFF, color: WHITE, width: 1 },
    { kind: "text", frame: "screen", at: [ec[0], ec[1] + 0.04], text: "В", align: "center", size: 0.07, color: el === "В" ? LAMP_TXT : LAMP_TXT_OFF },
    { kind: "text", frame: "screen", at: [ec[0], ec[1] - 0.04], text: "Н", align: "center", size: 0.07, color: el === "Н" ? LAMP_TXT : LAMP_TXT_OFF });
  // Device-ready lamp above the nose.
  const ny = CY + 0.52;
  out.push({ kind: "line", frame: "screen", points: [[-0.025, ny], [0.025, ny], [0.012, ny + 0.1], [-0.012, ny + 0.1]], fill: s.ready ? AMB : AOFF, color: s.ready ? AMB : AOFF });
  // Front bearing lamps: numbered main-threat discs outside, green threat lamps inside.
  for (const [sec, label, deg] of FRONT) {
    const lit = main === sec;
    out.push({ kind: "circle", frame: "screen", at: polar(0.66, deg), radius: 0.088, fill: true, color: lit ? AMB : AOFF },
      { kind: "text", frame: "screen", at: polar(0.66, deg), text: label, align: "center", size: 0.08, color: lit ? LAMP_TXT : LAMP_TXT_OFF },
      { kind: "circle", frame: "screen", at: polar(0.52, deg), radius: 0.032, fill: true, color: s.litSectors.has(sec) ? GRN : GOFF });
  }
  // Rear hemisphere: small green threat lamps and the ◁ ▷ main-threat lamps.
  for (const [sec, side] of [["RL", -1], ["RR", 1]] as const) {
    out.push({ kind: "circle", frame: "screen", at: [side * 0.25, CY - 0.47], radius: 0.032, fill: true, color: s.litSectors.has(sec) ? GRN : GOFF });
    const c: [number, number] = [side * 0.38, CY - 0.62], lit = main === sec;
    out.push({ kind: "circle", frame: "screen", at: c, radius: 0.085, fill: true, color: lit ? AMB : AOFF },
      { kind: "line", frame: "screen", points: [[c[0] + side * 0.045, c[1]], [c[0] - side * 0.03, c[1] + 0.045], [c[0] - side * 0.03, c[1] - 0.045]], fill: lit ? LAMP_TXT : LAMP_TXT_OFF, color: lit ? LAMP_TXT : LAMP_TXT_OFF });
  }
  // Type row: main-threat bars over green type letters.
  TYPES.forEach((t, i) => {
    const x = -0.7 + i * 0.28, y = -0.66;
    const isMain = s.main?.type === t && !(t === "Х" && s.main.ambiguousX && !blink);
    const on = s.types.has(t) || (t === "Х" && s.flashingX && blink) || isMain;
    out.push({ kind: "line", frame: "screen", points: [[x - 0.09, y + 0.035], [x + 0.09, y + 0.035], [x + 0.09, y - 0.035], [x - 0.09, y - 0.035]], fill: isMain ? AMB : AOFF, color: isMain ? AMB : AOFF });
    out.push({ kind: "text", frame: "screen", at: [x, -0.84], text: t, align: "center", size: 0.13, color: on ? GRN : GOFF });
  });
  if (s.frontBlanked) out.push({ kind: "text", frame: "screen", at: [0, 0.97], text: "ПЕРЕДН. БЛАНК", align: "center", size: 0.06, color: AOFF });
  if (!s.searchAllowed) out.push({ kind: "text", frame: "screen", at: [0.95, -0.97], text: "ПОИСК ОТКЛ", align: "right", size: 0.06, color: AOFF });
  return out;
}
