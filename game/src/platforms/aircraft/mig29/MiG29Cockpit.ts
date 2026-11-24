/**
 * MiG-29 basic cockpit layout (untextured, APPROXIMATE visual only): centre stick, throttle on the
 * left, HUD above an analogue panel shown as two instrument blocks, and a canopy front bow
 * (unlike the F-16's frameless bubble). Not measured geometry.
 */
import type { CockpitLayout } from "../../../rendering/three/CockpitLayout.js";

const PANEL = "#2b3a35", DARK = "#1a211e", FRAME = "#3f4a45";

export const MIG29_COCKPIT_LAYOUT: CockpitLayout = {
  aircraftId: "mig29",
  provenance: "Approximate visual layout; not measured geometry",
  eyeFromCgM: [4.9, 0, -1.15],
  fieldOfViewDeg: 62,
  parts: [
    { id: "panel", kind: "box", positionM: [0.88, 0, 0.42], sizeM: [0.06, 0.7, 0.34], rotationRad: [0, -0.3, 0], color: PANEL },
    { id: "glareshield", kind: "box", positionM: [0.8, 0, 0.25], sizeM: [0.22, 0.56, 0.05], color: DARK },
    { id: "panel-left", kind: "screen", positionM: [0.845, -0.2, 0.42], sizeM: [0.15, 0.14, 0], rotationRad: [0, -0.3, 0], color: "#101612", screen: "panel-left" },
    { id: "panel-right", kind: "screen", positionM: [0.845, 0.2, 0.42], sizeM: [0.15, 0.14, 0], rotationRad: [0, -0.3, 0], color: "#101612", screen: "panel-right" },
    { id: "hud-glass", kind: "glass", positionM: [0.68, 0, 0.06], sizeM: [0.14, 0.14, 0], rotationRad: [0, -0.2, 0], color: "#7fe0a0" },
    { id: "centre-stick", kind: "cylinder", positionM: [0.42, 0, 0.36], sizeM: [0.02, 0.3, 0], color: "#151815", binding: { kind: "stick" } },
    { id: "throttle", kind: "box", positionM: [0.2, -0.33, 0.38], sizeM: [0.07, 0.05, 0.1], color: "#151815", binding: { kind: "throttle" } },
    { id: "console-left", kind: "box", positionM: [0.2, -0.37, 0.48], sizeM: [0.7, 0.15, 0.08], color: PANEL },
    { id: "console-right", kind: "box", positionM: [0.2, 0.37, 0.48], sizeM: [0.7, 0.15, 0.08], color: PANEL },
    { id: "canopy-bow-l", kind: "box", positionM: [0.75, -0.3, -0.1], sizeM: [0.03, 0.03, 0.5], rotationRad: [0.35, 0, 0], color: FRAME },
    { id: "canopy-bow-r", kind: "box", positionM: [0.75, 0.3, -0.1], sizeM: [0.03, 0.03, 0.5], rotationRad: [-0.35, 0, 0], color: FRAME },
    { id: "sill-left", kind: "box", positionM: [0.25, -0.45, 0.3], sizeM: [1.4, 0.04, 0.04], color: FRAME },
    { id: "sill-right", kind: "box", positionM: [0.25, 0.45, 0.3], sizeM: [1.4, 0.04, 0.04], color: FRAME }
  ]
};
