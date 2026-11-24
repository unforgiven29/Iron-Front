/**
 * F-16C Block 50 basic cockpit layout (untextured).
 *
 * APPROXIMATE VISUAL LAYOUT ONLY: proportions are hand-placed for a recognisable F-16 arrangement
 * (side-stick on the right console, throttle on the left, HUD above a low glareshield, two
 * MFDs, bubble canopy without a forward bow). They are not measured cockpit geometry and must not
 * be used for reach, vision or collision analysis. Body FRD metres from the design eye point.
 */
import type { CockpitLayout } from "../../../rendering/three/CockpitLayout.js";
import { F16_SWITCHES } from "./F16Switches.js";

const PANEL = "#2a3036";
const DARK = "#1b1f23";
const CONSOLE = "#30363c";
const FRAME = "#4a5056";

export const F16_COCKPIT_LAYOUT: CockpitLayout = {
  aircraftId: "f16c-block50",
  provenance: "Approximate visual layout; not measured geometry",
  eyeFromCgM: [4.6, 0, -1.1],
  fieldOfViewDeg: 62,
  parts: [
    // Main instrument panel and glareshield.
    { id: "panel", kind: "box", positionM: [0.86, 0, 0.44], sizeM: [0.06, 0.62, 0.3], rotationRad: [0, -0.35, 0], color: PANEL },
    { id: "glareshield", kind: "box", positionM: [0.78, 0, 0.28], sizeM: [0.2, 0.5, 0.04], color: DARK },
    { id: "mfd-left", kind: "screen", positionM: [0.825, -0.19, 0.44], sizeM: [0.13, 0.13, 0], rotationRad: [0, -0.35, 0], color: "#0d1a12", screen: "mfd-left" },
    { id: "mfd-right", kind: "screen", positionM: [0.825, 0.19, 0.44], sizeM: [0.13, 0.13, 0], rotationRad: [0, -0.35, 0], color: "#0d1a12", screen: "mfd-right" },
    { id: "icp", kind: "box", positionM: [0.8, 0, 0.36], sizeM: [0.05, 0.16, 0.08], rotationRad: [0, -0.35, 0], color: DARK },
    // HUD combiner glass and frame.
    { id: "hud-glass", kind: "glass", positionM: [0.66, 0, 0.07], sizeM: [0.15, 0.16, 0], rotationRad: [0, -0.2, 0], color: "#7fe0a0" },
    { id: "hud-frame-l", kind: "box", positionM: [0.66, -0.08, 0.12], sizeM: [0.02, 0.01, 0.16], color: FRAME },
    { id: "hud-frame-r", kind: "box", positionM: [0.66, 0.08, 0.12], sizeM: [0.02, 0.01, 0.16], color: FRAME },
    // Side consoles, side-stick (right) and throttle (left).
    { id: "console-left", kind: "box", positionM: [0.2, -0.36, 0.48], sizeM: [0.7, 0.16, 0.08], color: CONSOLE },
    { id: "console-right", kind: "box", positionM: [0.2, 0.36, 0.48], sizeM: [0.7, 0.16, 0.08], color: CONSOLE },
    { id: "side-stick", kind: "cylinder", positionM: [0.34, 0.33, 0.38], sizeM: [0.018, 0.12, 0], color: "#15181b", binding: { kind: "stick" } },
    { id: "throttle", kind: "box", positionM: [0.18, -0.34, 0.4], sizeM: [0.06, 0.04, 0.1], color: "#15181b", binding: { kind: "throttle" } },
    // Canopy sill rails and rear frame (bubble canopy: no forward bow).
    { id: "sill-left", kind: "box", positionM: [0.25, -0.44, 0.3], sizeM: [1.4, 0.04, 0.04], color: FRAME },
    { id: "sill-right", kind: "box", positionM: [0.25, 0.44, 0.3], sizeM: [1.4, 0.04, 0.04], color: FRAME },
    // Test switches on the left console (labelled in the view as simulation test controls).
    { id: "sw-flcs", kind: "box", positionM: [0.42, -0.36, 0.43], sizeM: [0.03, 0.03, 0.03], color: "#c8a032", binding: { kind: "switch", switchId: F16_SWITCHES.flcsMode, positions: ["NORM", "DIRECT"] } },
    { id: "sw-cg", kind: "box", positionM: [0.36, -0.36, 0.43], sizeM: [0.03, 0.03, 0.03], color: "#3278c8", binding: { kind: "switch", switchId: F16_SWITCHES.testCg, positions: ["NOMINAL", "AFT", "FULL AFT"] } }
  ]
};
