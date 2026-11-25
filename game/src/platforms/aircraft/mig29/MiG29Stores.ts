/**
 * MiG-29 (9.13) air-to-air stores plan (owner: MiG-29 package).
 *
 * Six underwing pylons (1 = left outboard … 6 = right outboard) plus the centreline (fuel tank, not
 * modelled). The inboard pylons 3/4 (APU-470) carry the R-27; the middle and outboard pylons carry
 * the R-73 or R-60M. At most two R-27, and both must be of one guidance family: radar (R-27R/R-27ER)
 * or infrared (R-27T/R-27ET), not mixed — the aircraft's fire-control setup for the pair.
 */
import { stationErrors, type StoresPlan } from "../common/Avionics.js";

const SHORT = ["R-73", "R-60M"] as const;
const R27 = ["R-27R", "R-27ER", "R-27T", "R-27ET"] as const;
const family = (s: string) => (s === "R-27R" || s === "R-27ER" ? "radar" : s === "R-27T" || s === "R-27ET" ? "infrared" : null);

export const MIG29_STORES: StoresPlan = {
  stations: [
    { id: "p1", label: "Pylon 1 (L outboard)", allowed: SHORT }, { id: "p2", label: "Pylon 2 (L middle)", allowed: SHORT }, { id: "p3", label: "Pylon 3 (L inboard)", allowed: R27 },
    { id: "p4", label: "Pylon 4 (R inboard)", allowed: R27 }, { id: "p5", label: "Pylon 5 (R middle)", allowed: SHORT }, { id: "p6", label: "Pylon 6 (R outboard)", allowed: SHORT }
  ],
  presets: [
    { id: "standard", label: "2 × R-27R + 4 × R-73", description: "Semi-active radar pair inboard, close-combat IR outboard.", stations: ["R-73", "R-73", "R-27R", "R-27R", "R-73", "R-73"] },
    { id: "extended-radar", label: "2 × R-27ER + 4 × R-73", description: "Extended-range radar pair.", stations: ["R-73", "R-73", "R-27ER", "R-27ER", "R-73", "R-73"] },
    { id: "infrared", label: "2 × R-27T + 4 × R-73", description: "Passive IR pair: no radar lock needed to launch.", stations: ["R-73", "R-73", "R-27T", "R-27T", "R-73", "R-73"] },
    { id: "extended-ir", label: "2 × R-27ET + 4 × R-73", description: "Extended-range IR pair.", stations: ["R-73", "R-73", "R-27ET", "R-27ET", "R-73", "R-73"] },
    { id: "short", label: "4 × R-73", description: "Close-combat only; inboard pylons empty.", stations: ["R-73", "R-73", "", "", "R-73", "R-73"] },
    { id: "clean", label: "Clean (training)", description: "No stores.", stations: ["", "", "", "", "", ""] }
  ],
  provenance: "Pylon roles (R-27 inboard on APU-470, R-73/R-60M on the others): public MiG-29 9.13 configuration; centreline tank not modelled",
  validate: (s) => {
    const out = stationErrors(MIG29_STORES, s);
    const fams = new Set(s.map(family).filter((f): f is "radar" | "infrared" => !!f));
    if (fams.size > 1) out.push("R-27 pair must be one family: R-27R/ER (radar) or R-27T/ET (infrared), not both");
    return out;
  }
};
