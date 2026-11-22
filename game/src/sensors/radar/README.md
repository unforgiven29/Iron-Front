# Radar runtime entry point

This is the executable TypeScript source for radar equipment and processing. Requirements, architecture decisions and research remain in [docs/radar](../../../../docs/radar/README.md), the source scaffold in [sensors/Radar](../../../../sensors/Radar/README.md), and shared physics notes in [physics/radar](../../../../physics/radar/README.md).

## Implemented modules

| Source | Current responsibility |
|---|---|
| `RadarRuntime.ts` | Waveform timing/ambiguity calculations; warm-up, electrical-power and thermal lifecycle; reduced-order range-Doppler frame path |
| `PulseDopplerSimulation.ts` | Pulse-by-pulse complex baseband synthesis, matched-filter range correlation and coherent radix-2 Doppler FFT |
| `RadarProcessing.ts` | Two-dimensional cell-averaging CFAR, false-alarm threshold under exponential-noise assumptions, measurement outputs and uncertainty estimates |
| `RadarTracking.ts` | Radar-local Cartesian measurement conversion, nearest-neighbour gating, alpha-beta estimation, tentative/confirmed/coasting lifecycle |
| `RadarScheduler.ts` | Stable priority scheduling with mechanical slew, electronic settling and finite AESA channel/T/R-module capacity |
| `AesaArray.ts` | Finite planar array factor with phase error, element weights and individual module health |
| `RadarSystem.ts` | Composes radar power/thermal state, selected frame-generation path, CFAR and track update |
| `../esm/RwrRuntime.ts` | Passive radar interception with tunable frequency band, thermal noise/sensitivity, direction-of-arrival estimate, pulse-trait measurement and signature-library classification |

Shared RF equations and target/interference boundary: `game/src/physics/radar/RadarPhysics.ts`. Limited terrain/refraction and atmospheric screening models are in `game/src/physics/radar/RadarPropagation.ts`.

## Signal path

`equipment profile + resources → waveform/hardware readiness → physical RF returns → pulse/IQ or reduced-order range-Doppler frame → CFAR → uncertain measurements → track lifecycle`

The optional sample-level pulse-Doppler path is selected with `RadarEquipmentConfiguration.pulseDomain`; it requires a power-of-two coherent pulse count equal to `floor(PRF × CPI)`. The faster reduced-order frame model remains available for cheaper test/scenario cases. Physical echoes should be created by `computePhysicalRadarEcho` or `computeEnvironmentCoupledRadarEcho`, not by inserting entity IDs or perfect track truth.

## Deliberate limits

- The antenna envelope is a smooth approximation; the planar AESA routine is a reduced array-factor model. Neither is a full-wave solver or measured radome/embedded-element model.
- The sample-level processor is a single-channel complex-baseband model. It does not yet model ADC quantization, receiver compression, phase noise, frequency-agile waveform scheduling, full pulse ambiguity resolution, matched-filter bank optimization or calibrated clutter covariance.
- The reduced-order frame path is useful for performance tests, but it is not an FFT-derived pulse-Doppler implementation.
- A sampled-profile terrain LOS check, effective-Earth-radius curvature, first-Fresnel clearance, knife-edge screening and coefficient-driven gas/rain/cloud/fog/foliage attenuation are implemented. They are not a full terrain/environment pipeline: no terrain tile sampling, refractivity profile, ducting, multipath, building/vegetation geometry, distributed land/sea/weather clutter or calibrated diffraction field is integrated.
- A passive RWR/ESM receiver kernel is implemented in `game/src/sensors/esm/RwrRuntime.ts`; it estimates nose-relative bearing, in-band power/SNR, pulse count and signature-library matches. There is no RWR emitter tracker/alert prioritization, cockpit display, ESM geolocation, angle-difference network, emitter library for real sets or full radar-to-RWR simulation composition yet.
- The beam scheduler and AESA array model exist as independent kernels but are not yet coupled to RadarSystem's live scan controller or aircraft hardware state.
- Mechanical and PESA beam scheduling are currently single-beam abstractions; AESA concurrency is bounded by configured channels and healthy module counts, not unlimited.
- No aircraft-specific radar installation, F-16/MiG equipment profile, cockpit display, startup/BIT sequence, electrical bus or cooling-loop adapter is integrated.
- Unit tests verify numerical and state-transition properties under declared assumptions. They do not establish real-world probability of detection, false-alarm calibration or fidelity for any real radar. RWR bearing accuracy and signature library entries are configurable estimates until calibrated against exact receiver/emitter variants.

All equipment values must be attached to exact aircraft/radar/software variants with sourced provenance or an explicit `synthetic-test-only` label. Unknown values stay unknown; do not clone another radar's capability table.
