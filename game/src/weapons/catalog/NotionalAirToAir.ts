/**
 * NOTIONAL low-fidelity air-to-air missiles for gameplay (owner: weapons/catalog).
 *
 * These entries are placeholders so hostile aircraft (and the player's F-16 until its weapons are
 * reworked) have something to shoot. Every number is an invented gameplay value: none is a
 * measured, published or derived performance figure of the real AIM-9X or AIM-120, and nothing here
 * may be cited as real-world data. Replace with sourced 6-DoF definitions (see Missile.ts) when the
 * F-16 weapons slice is reworked.
 */
import type { MissileShape } from "../../rendering/three/ThreeCockpitView.js";

export interface NotionalMissileSpec {
  readonly id: string;
  readonly display: string;
  /** "radar": launcher-cued midcourse then active terminal seeker; "ir": seeker from launch. */
  readonly guidance: "radar" | "ir";
  /** Speed added by the motor, m/s, and burn time, s. */
  readonly boostDeltaVMps: number;
  readonly burnS: number;
  /** Drag factor k in dv/dt = −k · (ρ/ρ0) · v² (1/m). */
  readonly dragK: number;
  readonly maxG: number;
  readonly navConstant: number;
  readonly lifetimeS: number;
  /** Terminal seeker: acquisition range, field of regard (half-angle). */
  readonly seekerRangeM: number;
  readonly seekerHalfAngleRad: number;
  /** Launcher limits: maximum range and off-boresight half-angle. */
  readonly maxLaunchRangeM: number;
  readonly minLaunchRangeM: number;
  readonly maxOffBoresightRad: number;
  readonly fuzeRadiusM: number;
  readonly lethalRadiusM: number;
  readonly geometry: MissileShape;
  /** Active radar seeker transmitter (radar guidance only): what an RWR can intercept in the terminal phase. */
  readonly activeSeeker?: { readonly carrierHz: number; readonly prfHz: number; readonly pulseWidthS: number; readonly peakPowerW: number; readonly peakGainDbi: number; readonly beamwidthRad: number; readonly sidelobeDb: number };
  readonly provenance: string;
}

const D = Math.PI / 180;
const NOTE = "NOTIONAL gameplay value — not real-world performance";

export const NOTIONAL_AAM = {
  AIM9X: {
    id: "aim9x", display: "AIM-9X", guidance: "ir", boostDeltaVMps: 650, burnS: 2.5, dragK: 0.00009, maxG: 45, navConstant: 4,
    lifetimeS: 28, seekerRangeM: 12000, seekerHalfAngleRad: 80 * D, maxLaunchRangeM: 9000, minLaunchRangeM: 400, maxOffBoresightRad: 70 * D,
    fuzeRadiusM: 9, lethalRadiusM: 7,
    geometry: { lengthM: 3.0, diameterM: 0.127, noseLengthM: 0.25, surfaces: [{ spanM: 0.28, rootChordM: 0.1, tipChordM: 0.08, leadingEdgeM: 0.5 }, { spanM: 0.45, rootChordM: 0.25, tipChordM: 0.12, leadingEdgeM: 2.7 }] },
    provenance: NOTE
  },
  AIM120: {
    id: "aim120", display: "AIM-120", guidance: "radar", boostDeltaVMps: 900, burnS: 6, dragK: 0.00004, maxG: 35, navConstant: 4,
    lifetimeS: 80, seekerRangeM: 15000, seekerHalfAngleRad: 30 * D, maxLaunchRangeM: 45000, minLaunchRangeM: 1500, maxOffBoresightRad: 30 * D,
    fuzeRadiusM: 12, lethalRadiusM: 10,
    activeSeeker: { carrierHz: 15.5e9, prfHz: 120e3, pulseWidthS: 0.6e-6, peakPowerW: 500, peakGainDbi: 24, beamwidthRad: 9 * D, sidelobeDb: -20 },
    geometry: { lengthM: 3.65, diameterM: 0.178, noseLengthM: 0.45, surfaces: [{ spanM: 0.53, rootChordM: 0.4, tipChordM: 0.25, leadingEdgeM: 1.4 }, { spanM: 0.45, rootChordM: 0.3, tipChordM: 0.15, leadingEdgeM: 3.3 }] },
    provenance: NOTE
  }
} as const satisfies Record<string, NotionalMissileSpec>;

export const NOTIONAL_BY_ID: Readonly<Record<string, NotionalMissileSpec>> = Object.fromEntries(Object.values(NOTIONAL_AAM).map((s) => [s.id, s]));
