/**
 * F-16C Block 50 air-to-air stores plan (owner: F-16 package).
 *
 * Station layout from the public F-16 configuration: nine stations, 1 and 9 wingtip launchers,
 * 2/8 and 3/7 wing stations that carry air-to-air missiles, 4/6 heavy wing stations and 5 centreline
 * (tanks / air-to-ground — not modelled here, so they stay empty). Wingtips and 2/3/7/8 accept the
 * AIM-9X or AIM-120 (the missiles themselves are NOTIONAL low-fidelity placeholders, see
 * weapons/catalog/NotionalAirToAir.ts).
 */
import { stationErrors, type StoresPlan } from "../common/Avionics.js";

const AAM = ["AIM-9X", "AIM-120"] as const;
const st = (n: number, label: string, allowed: readonly string[], note?: string) => ({ id: `sta${n}`, label: `STA ${n} (${label})`, allowed, ...(note ? { note } : {}) });
const HEAVY = "Tanks / air-to-ground only (not modelled)";

export const F16_STORES: StoresPlan = {
  stations: [
    st(1, "L wingtip", AAM), st(2, "L outboard", AAM), st(3, "L mid", AAM), st(4, "L inboard", [], HEAVY), st(5, "centreline", [], HEAVY),
    st(6, "R inboard", [], HEAVY), st(7, "R mid", AAM), st(8, "R outboard", AAM), st(9, "R wingtip", AAM)
  ],
  presets: [
    { id: "a2a-standard", label: "Air superiority", description: "AIM-120 on the wingtips and mid stations, AIM-9X outboard.", stations: ["AIM-120", "AIM-9X", "AIM-120", "", "", "", "AIM-120", "AIM-9X", "AIM-120"] },
    { id: "a2a-bvr", label: "Beyond visual range", description: "6 × AIM-120.", stations: ["AIM-120", "AIM-120", "AIM-120", "", "", "", "AIM-120", "AIM-120", "AIM-120"] },
    { id: "a2a-wvr", label: "Close-in fight", description: "4 × AIM-9X and 2 × AIM-120.", stations: ["AIM-9X", "AIM-9X", "AIM-120", "", "", "", "AIM-120", "AIM-9X", "AIM-9X"] },
    { id: "clean", label: "Clean (training)", description: "No stores.", stations: ["", "", "", "", "", "", "", "", ""] }
  ],
  provenance: "Station numbering and air-to-air station capability: public F-16 configuration data; heavy stations not modelled",
  validate: (s) => stationErrors(F16_STORES, s)
};
