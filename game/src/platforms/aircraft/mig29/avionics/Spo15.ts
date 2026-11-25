/**
 * СПО-15ЛМ indicator (MiG-29 package): draws the processor state (Spo15Lm.ts) on the cockpit
 * screen. Layout after the DCS MiG-29A manual figure (p.106): device-ready light, main-threat
 * (yellow) and threat (green) azimuth lights around the aircraft silhouette with rear channels
 * below, the red track light in the middle, the circular power-level scale, В/Н elevation lights
 * and the type row (П З Х Н F С) with main-threat lights above it. Proportions approximate.
 */
import type { DisplayList, DisplayPrimitive } from "../../../../rendering/instruments/DisplayList.js";
import { SPO_SECTORS, type Spo15LmState, type SpoSector, type SpoType } from "./Spo15Lm.js";

const TYPES: readonly SpoType[] = ["П", "З", "Х", "Н", "F", "С"];
const GRN = "#62ff7a", GOFF = "#173a1f", YEL = "#ffd23a", YOFF = "#3a3212", RED = "#ff3b30", ROFF = "#3d1513";
const D = Math.PI / 180;
/** Lamp angle on the azimuth arc (0 = nose, deg) for each display sector. */
const LAMP_DEG: Record<SpoSector, number> = { RL: -150, L90: -90, L50: -50, L30: -30, L10: -10, R10: 10, R30: 30, R50: 50, R90: 90, RR: 150 };

export function spo15Display(s: Spo15LmState, blink: boolean): DisplayList {
  const out: DisplayPrimitive[] = [];
  const cy = 0.05;
  // Device ready light.
  out.push({ kind: "circle", frame: "screen", at: [-0.85, 0.85], radius: 0.05, fill: true, color: s.ready ? GRN : GOFF });
  // Aircraft silhouette.
  out.push({ kind: "line", frame: "screen", points: [[0, cy + 0.18], [0, cy - 0.18]], color: GRN, width: 2 },
    { kind: "line", frame: "screen", points: [[-0.15, cy + 0.02], [0.15, cy + 0.02]], color: GRN, width: 2 },
    { kind: "line", frame: "screen", points: [[-0.07, cy - 0.15], [0.07, cy - 0.15]], color: GRN, width: 2 });
  // Azimuth lights: inner ring = threat lights (green), outer ring = main threat (yellow).
  for (const sec of SPO_SECTORS) {
    const a = LAMP_DEG[sec] * D;
    const rear = sec === "RL" || sec === "RR";
    const rIn = rear ? 0.5 : 0.48, rOut = rIn + 0.13;
    const at = (r: number) => [r * Math.sin(a), cy + r * Math.cos(a)] as const;
    out.push({ kind: "circle", frame: "screen", at: at(rIn), radius: 0.05, fill: true, color: s.litSectors.has(sec) ? GRN : GOFF });
    out.push({ kind: "circle", frame: "screen", at: at(rOut), radius: 0.045, fill: true, color: s.main?.sector === sec ? YEL : YOFF });
  }
  // Track warning light (red, centre).
  out.push({ kind: "circle", frame: "screen", at: [0, cy], radius: 0.07, fill: true, color: s.trackWarning ? RED : ROFF });
  // Power level: circular scale of 15 lamps around the outside (2 dB per step).
  const level = s.main?.level ?? -1;
  for (let i = 0; i < 15; i++) {
    const a = (-140 + (280 * i) / 14) * D;
    out.push({ kind: "circle", frame: "screen", at: [0.8 * Math.sin(a), cy + 0.8 * Math.cos(a)], radius: 0.03, fill: true, color: i <= level ? (i >= 11 ? RED : YEL) : YOFF });
  }
  // Elevation lights.
  out.push({ kind: "text", frame: "screen", at: [-0.82, 0.45], text: "В", align: "center", size: 0.13, color: s.main?.elevation === "В" ? YEL : YOFF },
    { kind: "text", frame: "screen", at: [-0.82, -0.35], text: "Н", align: "center", size: 0.13, color: s.main?.elevation === "Н" ? YEL : YOFF });
  // Type row with main-threat lights above.
  TYPES.forEach((t, i) => {
    const x = -0.62 + i * 0.25;
    const isMain = s.main?.type === t && !(t === "Х" && s.main.ambiguousX && !blink);
    const on = s.types.has(t) || (t === "Х" && s.flashingX && blink) || isMain;
    out.push({ kind: "circle", frame: "screen", at: [x, -0.7], radius: 0.035, fill: true, color: isMain ? YEL : YOFF });
    out.push({ kind: "text", frame: "screen", at: [x, -0.9], text: t, align: "center", size: 0.15, color: on ? GRN : GOFF });
  });
  if (s.frontBlanked) out.push({ kind: "line", frame: "screen", points: [[-0.35, cy + 0.65], [0.35, cy + 0.65]], color: GOFF, width: 3 });
  if (!s.searchAllowed) out.push({ kind: "text", frame: "screen", at: [0.85, 0.85], text: "ПОИСК", align: "right", size: 0.07, color: GOFF });
  return out;
}
