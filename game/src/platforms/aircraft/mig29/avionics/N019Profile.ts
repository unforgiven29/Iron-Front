/**
 * N019 radar of the RLPK-29 sighting system, MiG-29 (exported RLPK-29E fit) — equipment profile.
 *
 * Primary source for behaviour and performance: «Боевое применение самолёта МиГ-29. Методическое
 * пособие лётчику», 2nd ed. (cited as "BP-29", page numbers of the printed book). The manual gives
 * what the radar does (modes, zones, ranges, limits) but not its hardware. Hardware values below
 * are open-literature or engineering ESTIMATES; they drive the physics. Only `peakPowerW` is
 * FITTED: chosen so the radar equation reproduces BP-29 table 1. Every other BP-29 figure
 * (table 4 rear-hemisphere ranges, the 3.5° beam, blind aspects) is an independent check that
 * the shared physics must pass with that one value — see game/tests/unit/MiG29Radar.test.ts.
 */
import type { RadarProfile, WaveformSpec } from "../../../../sensors/radar/PulseDopplerRadar.js";
import { DEG } from "../../../../sensors/common/ScanGeometry.js";

const BP = "BP-29 (MiG-29 combat employment manual, 2nd ed.)";

const HPRF: WaveformSpec = {
  id: "HPRF", label: "ВЧП",
  prfsHz: { value: [143e3, 152e3, 161e3], source: "ESTIMATED: 'high PRF' (BP-29 p.5) must exceed the main-lobe-to-closure Doppler span; three PRFs for eclipse/ambiguity resolution", status: "estimated" },
  pulseWidthS: { value: 1.4e-6, source: "ESTIMATED (duty ≈ 0.21, typical of HPRF velocity search)", status: "estimated" },
  requiredPrfs: 2,
  mainlobeNotchMps: { value: 64, source: `${BP} p.7: mode В minimum target speed 230 km/h (64 m/s); p.6 fig.2 blind aspects (V·cos q < V min)`, status: "derived" },
  ranging: { kind: "fm", fractionalError: { value: 0.03, source: "ESTIMATED FM-ranging accuracy in velocity search", status: "estimated" } },
  rangeGated: false
};

const MPRF: WaveformSpec = {
  id: "MPRF", label: "СЧП",
  prfsHz: { value: [9.6e3, 10.4e3, 11.3e3, 12.2e3, 13.1e3, 14.0e3, 15.1e3, 16.3e3], source: "ESTIMATED medium-PRF set ('medium PRF' per BP-29 fig.1 СЧП; values typical for the class)", status: "estimated" },
  pulseWidthS: { value: 1.3e-6, source: "ESTIMATED", status: "estimated" },
  requiredPrfs: 3,
  mainlobeNotchMps: { value: 58, source: `${BP} p.12: mode Д minimum target speed 210 km/h (58 m/s)`, status: "derived" },
  ranging: { kind: "pulse" },
  rangeGated: true,
  closureGates: { value: [{ maxRangeM: 15000, minClosureMps: 50 / 3.6 }, { maxRangeM: Infinity, minClosureMps: 150 / 3.6 }], source: `${BP} p.6: tail attack needs closure ≥ 50 km/h within 15 km and ≥ 150 km/h beyond`, status: "published" }
};

export const N019_PROFILE: RadarProfile = {
  id: "n019.rlpk29e",
  designation: "N019 (RLPK-29E)",
  frequencyHz: { value: 10.0e9, source: "ESTIMATED: X-band (I/J) fire-control radar", status: "estimated" },
  aperture: { value: { diameterM: 0.7, taperExponent: 2, farSidelobeFloorDb: 38 }, source: "ESTIMATED: twist-Cassegrain dish ≈0.7 m in the nose radome; taper p=2 chosen for low sidelobes. Gives a 3.6° beam vs BP-29 p.8 '3.5°' (check, not fit)", status: "estimated" },
  peakPowerW: { value: 700, source: "FITTED so that BP-29 table 1 (σ = 3 m², head-on, H > 3000 m: Д_о 50–70 km) is met by the radar equation", status: "fitted" },
  noiseFigureDb: { value: 4.5, source: "ESTIMATED 1980s low-noise front end", status: "estimated" },
  antennaTemperatureK: { value: 150, source: "ESTIMATED", status: "estimated" },
  lossesDb: { value: { radome: 1.0, plumbing: 1.5, beamShapeScan: 1.3, filterMismatch: 1.5, cfar: 1.0, straddle: 1.0 }, source: "ESTIMATED itemised loss budget (Skolnik ch.2 typical values)", status: "estimated" },
  falseAlarmProbability: { value: 1e-6, source: "ESTIMATED per-cell CFAR design value", status: "estimated" },
  scanRateRadS: { value: 70 * DEG, source: "ESTIMATED mechanical scan rate", status: "estimated" },
  barTurnaroundS: { value: 0.12, source: "ESTIMATED", status: "estimated" },
  slewRateRadS: { value: 120 * DEG, source: "ESTIMATED", status: "estimated" },
  searchGimbal: { value: { azMaxRad: 65 * DEG, elMinRad: -36 * DEG, elMaxRad: 56 * DEG }, source: `${BP} p.9–10 figs.4–5: ±65° az, +56/−36° el`, status: "published" },
  trackGimbal: { value: { azMaxRad: 65 * DEG, elMinRad: -36 * DEG, elMaxRad: 56 * DEG }, source: `${BP} p.11 fig.7: autotrack zone ±65° az, +56/−36° el`, status: "published" },
  stabilization: { value: { rollMaxRad: 120 * DEG, pitchMaxRad: 30 * DEG }, source: `${BP} p.11: antenna space-stabilised within ±120° roll, ±30° pitch`, status: "published" },
  minTrackRangeM: { value: 350, source: `${BP} p.11: minimum tracking range 350 m (mode В); 250–300 m in Д (p.12)`, status: "published" },
  instrumentedRangeM: { value: 150000, source: `${BP} p.29 fig.19: largest range scale 150 km`, status: "published" },
  acquisitionTimeS: { value: 2.0, source: `${BP} p.16: 2–2.5 s from lock button to track (БЛ.БОЙ, non-manoeuvring target)`, status: "published" },
  trackMemoryS: { value: 2.0, source: "ESTIMATED track memory (coast) before lock is dropped", status: "estimated" },
  maxTrackLosRateRadS: { value: 60 * DEG, source: "ESTIMATED antenna/servo tracking-rate limit", status: "estimated" },
  waveforms: { HPRF, MPRF },
  twsCapacity: { value: 10, source: `${BP} p.5/p.14: tracks up to 10 targets while scanning (СНП)`, status: "published" },
  warmUpS: { value: 180, source: "ESTIMATED; sessions start with the radar already warm", status: "estimated" }
};
