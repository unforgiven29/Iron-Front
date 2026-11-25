/**
 * N019 radar of the RLPK-29 sighting system, MiG-29 — equipment profile.
 *
 * Sources:
 *  - "RLPK": V. A. Voitchuk, «Fighter radar sighting complex», Theme 12, National Aviation University /
 *    Zhitomir Military Institute, Kiev 2012 (English translation). Hardware: wavelength, pulse and
 *    average powers, pulse widths, PRFs, duty factors, antenna beamwidth and directivity, scan rate,
 *    coverage, receiver noise figure and sensitivity, processing tacts, search zones, TWS gates,
 *    acquisition sequence, track filters and accuracies, detection-range table. Slide numbers cited.
 *  - "N019-WEB": N019 description page (Phazotron history, N-019EB manual mode descriptions): pitch
 *    stabilisation, guard channel, range resolution, minimum search range, mode Д zones and ranges.
 *  - "BP-29": «Боевое применение самолёта МиГ-29. Методическое пособие лётчику», 2nd ed. Pilot
 *    behaviour: modes, minimum target speeds, tail-chase closure gates, tracking limits.
 *
 * NOTHING IS FITTED. The remaining ESTIMATED values are the loss budget, false-alarm probability,
 * dish taper and track-tact coherent time. The RLPK detection-range table (slide 6) is used only as
 * an independent check in MiG29Sensors.test.ts.
 */
import type { RadarProfile, WaveformSpec } from "../../../../sensors/radar/PulseDopplerRadar.js";
import { DEG } from "../../../../sensors/common/ScanGeometry.js";

const BP = "BP-29";
const R = "RLPK";

const HPRF: WaveformSpec = {
  sensitivityDbw: { value: -161, source: `${R} slide 8: receiver sensitivity in HPRF (-161 dBW)`, status: "published" },
  id: "HPRF", label: "ВЧП",
  prfsHz: { value: [165e3, 180e3, 195e3, 210e3], source: `${R} slide 7: PRF 160–220 kHz; individual PRFs of the set ESTIMATED inside that band`, status: "published" },
  pulseWidthS: { value: 1.4e-6, source: `${R} slide 7: 1.25–1.5 µs, duty factor (скважность) 4`, status: "published" },
  averagePowerW: { value: 1200, source: `${R} slide 7: average power 1.2 kW (pulse 3–6.5 kW)`, status: "published" },
  mainlobeNotchMps: { value: 64, source: `${BP} p.7: mode В minimum target speed 230 km/h (64 m/s); fig.2 blind aspects`, status: "derived" },
  searchRangeSigmaM: { value: 4000, source: `${R} slide 6: range RMS error in TWS (СНП) ≤ 4 km (FM ranging, slide 41: 6 and 3 kHz/ms sweeps)`, status: "published" },
  rangeGated: false,
  coverage: { value: { dopplerBandHz: 60e3 }, source: `${R} slide 36: HPRF analyses 6 × 10 kHz = 60 kHz`, status: "published" },
  rangeResolutionM: { value: 5500, source: "N019-WEB: mode В resolves targets separated by 5–6 km in range", status: "published" },
  minSearchRangeM: { value: 5000, source: "N019-WEB: minimum measurable range in mode В 5 km", status: "published" },
  twsRangeGateM: { value: 10000, source: `${R} slide 42: TWS range strobe ±10 km in HPRF`, status: "published" }
};

const MPRF: WaveformSpec = {
  sensitivityDbw: { value: -145, source: `${R} slide 8: receiver sensitivity in MPRF (-145 dBW)`, status: "published" },
  id: "MPRF", label: "СЧП",
  prfsHz: { value: [19.5e3, 21.8e3, 25.0e3, 28.0e3], source: `${R} slide 7: PRF 16–30 kHz; slide 41: duty factors 17 and 19 for range/velocity ambiguity resolution (19.5 / 21.8 kHz at 2.7 µs); others ESTIMATED in band`, status: "published" },
  pulseWidthS: { value: 2.7e-6, source: `${R} slide 7: 2.1–3.4 µs`, status: "published" },
  averagePowerW: { value: 600, source: `${R} slide 7: average power 0.6 kW`, status: "published" },
  mainlobeNotchMps: { value: 58, source: `${BP} p.12: mode Д minimum target speed 210 km/h (58 m/s)`, status: "derived" },
  searchRangeSigmaM: { value: 117, source: "DERIVED: pulse resolution c·τ/2 = 405 m, uniform error /√12", status: "derived" },
  rangeGated: true,
  coverage: { value: { rangeGates: { count: 12, widthPulses: 1 }, dopplerBandHz: 10e3 }, source: `${R} slides 33–36: in MPRF 12 range gates of one pulse width after the pulse (6 double-width with compensation) and a single 10 kHz analysed Doppler band`, status: "published" },
  rangeResolutionM: { value: 3500, source: "N019-WEB: mode Д resolves targets separated by 3–4 km in range", status: "published" },
  twsRangeGateM: { value: 2000, source: `${R} slide 42: TWS range strobe ±2 km in MPRF`, status: "published" },
  closureGates: { value: [{ maxRangeM: 15000, minClosureMps: 50 / 3.6 }, { maxRangeM: Infinity, minClosureMps: 150 / 3.6 }], source: `${BP} p.6: tail attack needs closure ≥ 50 km/h within 15 km and ≥ 150 km/h beyond`, status: "published" }
};

/** Close-combat (БМБ) waveform. */
const BMB: WaveformSpec = {
  sensitivityDbw: { value: -123, source: `${R} slide 8: receiver sensitivity in BMB (-123 dBW)`, status: "published" },
  id: "BMB", label: "БМБ",
  prfsHz: { value: [22.5e3, 25.5e3, 27.5e3], source: `${R} slide 7: BMB PRF 21–28 kHz`, status: "published" },
  pulseWidthS: { value: 1.55e-6, source: `${R} slide 7: BMB 1.4–1.7 µs`, status: "published" },
  averagePowerW: { value: 175, source: "DERIVED: mid pulse power 4.75 kW × 1.55 µs × 24 kHz (slide 7 gives no BMB average)", status: "derived" },
  mainlobeNotchMps: { value: 58, source: `${BP} p.12 (assumed same rejection filter as Д)`, status: "estimated" },
  searchRangeSigmaM: { value: 67, source: "DERIVED: c·τ/2 /√12", status: "derived" },
  rangeGated: true,
  twsRangeGateM: { value: 2000, source: "as MPRF", status: "estimated" }
};

export const N019_PROFILE: RadarProfile = {
  id: "n019.rlpk29",
  designation: "N019 (RLPK-29)",
  frequencyHz: { value: 299792458 / 0.03, source: `${R} slide 7: wave range 3 cm`, status: "published" },
  aperture: {
    value: { diameterM: 0.72, taperExponent: 2, farSidelobeFloorDb: 38, directivity: { transmit: 2000, receive: 1350 } },
    source: `${R} slide 8: beamwidth 3.5°, directivity (КНД) 2000 transmit / 1350 receive; two-mirror twist-Cassegrain (slide 14). Diameter DERIVED from 3.5° with taper p=2 (ESTIMATED)`, status: "published"
  },
  noiseFigureDb: { value: 5.4, source: `${R} slide 30: front-end noise figure 5.4 dB (channels 1, 2)`, status: "published" },
  antennaTemperatureK: { value: 150, source: "ESTIMATED", status: "estimated" },
  lossesDb: { value: { radome: 1.0, plumbing: 1.5, beamShapeScan: 1.3, filterMismatch: 1.0, cfar: 1.0, straddle: 1.0 }, source: "ESTIMATED itemised loss budget (Skolnik ch.2 typical values)", status: "estimated" },
  falseAlarmProbability: { value: 1e-6, source: "ESTIMATED per cell and tact", status: "estimated" },
  clutterSpreadDbc: { value: -55, source: "ESTIMATED: clutter-to-filter phase-noise/A-D floor; typical −55…−70 dBc for a TWT/coherent chain of the period. Value checked against (not fitted to) the RLPK slide 6 look-down ranges", status: "estimated" },
  timing: {
    value: { searchTactS: 10.24e-3, searchCoherentS: 4.48e-3, trackTactS: 20.48e-3, trackCoherentS: 8.96e-3, confirmTacts: 2 },
    source: `${R} slides 7, 38, 41: search tact 10.24 ms with 4.48 ms coherent accumulation (≈220 Hz filters, slide 35), track tact 20.48 ms, two measurement tacts after detection. Track coherent time ESTIMATED (doubled tact)`, status: "published"
  },
  scanRateRadS: { value: 57 * DEG, source: `${R} slide 8: search speed 57°/s; time on target ≈60 ms (slide 41)`, status: "published" },
  barTurnaroundS: { value: 0.32, source: `DERIVED: ${R} slide 39 frame 3.6 s for 50° × 3 bars at 57°/s`, status: "derived" },
  slewRateRadS: { value: 120 * DEG, source: "ESTIMATED ('maximum speed', slide 44)", status: "estimated" },
  searchGimbal: { value: { azMaxRad: 70 * DEG, elMinRad: -45 * DEG, elMaxRad: 60 * DEG }, source: `${R} slide 8: view zone ±70° az, −45/+60° el`, status: "published" },
  trackGimbal: { value: { azMaxRad: 65 * DEG, elMinRad: -36 * DEG, elMaxRad: 56 * DEG }, source: `${BP} p.11 fig.7: autotrack zone ±65° az, +56/−36° el`, status: "published" },
  stabilization: { value: { rollMaxRad: 120 * DEG, pitchUpRad: 40 * DEG, pitchDownRad: 30 * DEG }, source: `N019-WEB: beam stabilised up to 120° roll, +40°/−30° pitch (BP-29 p.11 gives ±30°)`, status: "published" },
  minTrackRangeM: { value: 350, source: `${BP} p.11: minimum tracking range 350 m`, status: "published" },
  instrumentedRangeM: { value: 150000, source: `${BP} p.29 fig.19: largest range scale 150 km`, status: "published" },
  acquisition: {
    value: { offsetAzRad: -4 * DEG, offsetElRad: 2 * DEG, boxWidthRad: 8 * DEG, boxSpacingRad: 4 * DEG, boxRateRadS: 20 * DEG, periods: 2, pullInS: 1.0, attempts: 6 },
    source: `${R} slides 44–47: slew to 4° left / 2° above the designation, two-line 'box' at 20°/s (period 0.8 s), back to search after two periods; Н.ПЕЛ pull-in ≈1 s; 6 attempts`, status: "published"
  },
  trackMemoryS: { value: 2.0, source: "ESTIMATED track memory (extrapolation) before lock is dropped", status: "estimated" },
  maxTrackLosRateRadS: { value: 60 * DEG, source: "ESTIMATED antenna/servo tracking-rate limit", status: "estimated" },
  trackAccuracy: { value: { rangeM: 200, angleRad: 0.25 * DEG, speedMps: 10 }, source: `${R} slide 6: track RMS ≤0.2 km range, ≤0.25° angle, ≤10 m/s speed`, status: "published" },
  rangeFilter: { value: { alpha: 0.5, beta: 0.02 }, source: `${R} slide 54: range tracking α–β filter α = 0.5, β = 0.02`, status: "published" },
  waveforms: { HPRF, MPRF, BMB },
  guardChannel: { value: { blankBeyondBeamwidths: 1.0 }, source: "N019-WEB: guard channel for sidelobe suppression; RLPK slides 33–35: compensation channel (КОМПЕНС). Blanking threshold ESTIMATED (outside the main beam)", status: "published" },
  clutterThresholdSuppressionDb: { value: 12, source: "ESTIMATED: partial clutter-adaptive threshold; N019-WEB reports frequent false targets from ground clutter in mode Д at low altitude (marsh, flood plains)", status: "estimated" },
  tws: { value: { capacity: 10, dropAfterS: 12, gateAzRad: 5 * DEG, gateElRad: 1.7 * DEG }, source: `${R} slide 42: up to 10 tracks, gates ±5° az / ±1.7° el, dropped after 12 s (three frames) without contact`, status: "published" },
  warmUpS: { value: 180, source: "ESTIMATED; sessions start with the radar already warm", status: "estimated" }
};

/** RLPK slide 6: detection (Pd 0.5) and lock (Pd 0.9) ranges, σ = 3 m², km — validation data, not used by the model. */
export const N019_RANGE_TABLE = {
  freeSpace: { frontHigh: { detect: [65, 75], lock: [50, 55] }, frontLow: { detect: [59, 68], lock: [45, 50] }, rearHigh: { detect: [30, 30], lock: [21, 21] } },
  /** N019-WEB (N-019EB manual): mode Д search/track ranges by own altitude. */
  pursuitByAltitude: { above3000: { detect: [25, 35], lock: [20, 35] }, from1000to3000: { detect: [20, 35], lock: [18, 35] }, from500to1000: { detect: [15, 30], lock: [13, 25] } },
  groundBackground: { frontHigh: { detect: [60, 70], lock: [45, 50] }, frontLow: { detect: [35, 45], lock: [25, 30] }, rear500m: { detect: [18, 18], lock: [12, 12] } }
} as const;
