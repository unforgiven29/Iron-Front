# Radar and missile runtime implementation status

This document records the initial executable radar and missile simulation kernels requested for Iron-Front. It is a technical implementation baseline, not a claim that the game now has DCS/Falcon BMS-level validated radar or weapon fidelity.

## Radar signal and sensor path

`game/src/physics/radar/` contains the reusable RF/environment kernels:

- Monostatic radar equation, free-space spreading, round-trip delay and Doppler.
- Antenna main-beam/sidelobe/backlobe envelope and aspect-dependent target RCS with Swerling fluctuations.
- Spectral jammer coupling at a receiver passband.
- Sampled terrain line-of-sight with effective-Earth-radius curvature and first-Fresnel screening.
- Coefficient-driven gas/rain/cloud/fog/foliage attenuation on each path leg.
- Profile-driven distributed surface clutter scatterers with range-cell area, surface motion and Doppler spread.

`game/src/sensors/radar/` composes the equipment and signal-processing kernels:

- Waveform PRF, pulse width, bandwidth, CPI, duty cycle, range/Doppler ambiguity and resolution.
- Radar electrical-power, warm-up, thermal/cooling and health lifecycle.
- Optional pulse-level complex I/Q generation, matched-filter range correlation and coherent Doppler FFT.
- A reduced-order range-Doppler frame path for cheaper simulation and testing.
- Two-dimensional CA-CFAR detections and radar-local uncertain tracks with tentative/confirmed/coasting states.
- Mechanical/PESA/AESA beam scheduling with resource/channel limits.
- Planar AESA array factor with per-element phase error and T/R module health, now coupled to physical transmit/receive echo gain.

The pulse-IQ path accepts both target returns and anonymous clutter scatterer returns in the same scene buffer. Interference power is supplied through a scene/resource interface; the shared RF layer can calculate spectral jammer contributions.

## Passive warning / ESM path

`game/src/sensors/esm/` contains passive intercept and bearing-only track kernels:

- Receiver tuning, instantaneous bandwidth overlap, thermal noise/noise figure, sensitivity and SNR.
- Transmitter beam-pattern/free-space coupling into the receiver.
- Pulse count, frequency, pulse-width and PRF measurements.
- Configurable RF signature-library matching with explicitly unvalidated classification confidence.
- Nose-relative bearing, bearing rate, predicted-bearing association and track coast.

RWR/ESM contacts intentionally have no direct emitter entity ID or range. No ESM geolocation is inferred from a single bearing-only contact.

## Missile flight and guidance path

`game/src/physics/ballistics/`:

- Translational 3-DoF point-mass missile model with staged motor thrust and propellant flow, Mach-dependent drag, wind/gravity, dynamic-pressure-limited normal force, induced drag and bounded actuator/steering response.
- Six-degree-of-freedom rigid-body model with quaternion attitude, body angular rates, gyroscopic coupling, Mach-interpolated force/moment coefficient tables, fin servo dynamics, moving CG/inertia, motor force and moment arms, and structural load limits.

`game/src/physics/guidance/` and `game/src/weapons/`:

- True proportional navigation, augmented PN and pure pursuit using time-stamped uncertain target/missile state estimates.
- Missile INS drift/noise/bias and covariance growth; gated GNSS/datalink updates with stale/implausible corrections rejected.
- Guidance acceleration to body-axis force demand and fin commands, followed by the 6-DoF dynamics step.
- Existing 3-DoF missile lifecycle with guidance, seeker state, event-time fuze arming, externally supplied impact/proximity event and maximum-flight-time self-destruct.

## Seeker and countermeasure path

`game/src/sensors/weapon-seeker/`:

- Common observation-based seeker discrimination using signal, angular, spectral, thermal and kinematic features. Candidate labels are not provided to the scoring function.
- Gimbal limits/rate, acquisition dwell, power/cooling/health, external illumination/command-link dependencies and finite track coast memory.
- Active and semi-active radar missile seeker link-budget/detection kernels with receiver noise, processing gain, range/Doppler ambiguity, external illuminator geometry and noisy measurements. No detection means no range/angle/velocity measurement is returned.
- IR radiance observations integrated over configured bands, thermal flare cooling/chemical heat input, and a wind-advected/dispersing/depleting chaff cloud with wavelength-dependent empirical RCS.

## Tests added

Deterministic unit test suites cover RF equations, target RCS/Swerling behaviour, jammer spectral overlap, terrain/environment attenuation, pulse/IQ/Doppler processing, CFAR, track lifecycle, AESA element failures and physical echo steering, clutter generation, RWR intercept/tracking, missile 3-DoF and 6-DoF dynamics, guidance, navigation corrections, seeker acquisition, active/SARH seeker detection, and dynamic flare/chaff effects.

The test files do not validate performance against real flight-test, instrumented radar, seeker or missile data. Automated CI status must be read from the latest GitHub Actions run; adding a test file does not mean the test has passed.

## Deliberate limitations and next integration work

The kernels are not yet complete installed systems. Required next steps include:

1. Run lint, TypeScript, unit tests and production build; fix any integration errors from these newly added modules.
2. Complete Stage 1 runtime scheduler, immutable tick contract, resource services, deterministic replay and world/physics integration before hooking simulation state into live aircraft/campaign objects.
3. Add evidence-backed equipment profiles for each exact radar, RWR, missile, seeker, fuze and countermeasure variant. Do not copy a generic profile between aircraft.
4. Couple radar beam scheduling and array state into live installed radar scan logic and aircraft electrical/cooling/startup/BIT systems.
5. Add terrain-tile sampling, Earth curvature/refraction profiles, multipath, buildings/vegetation, frequency-dependent weather, land/sea/urban clutter libraries, and calibrated Pd/Pfa detector performance.
6. Add radar-seeker pulse/IQ and monopulse angle measurement, seeker-specific track filters, ECCM/DRFM response, illuminator/command-link scheduling, datalink denial and seeker failure modes.
7. Add aircraft RWR emitter scheduling, alert prioritization, bearing network/ESM geolocation where supported, threat library data and cockpit indications.
8. Add real missile product-specific 6-DoF aero, inertia/CG, motor, fin/actuator, thermal, seeker, guidance, fuze and countermeasure susceptibility profiles with provenance. The generic solver cannot supply those values.
9. Extend fuzes/warheads, proximity/impact sensor failure, arming safeties and post-detonation effects only when these have explicit product data or clearly labelled simulation assumptions.
10. Profile the pulse-level paths in-browser and provide deterministic lower-fidelity LOD for distant/low-priority emissions without changing the underlying equipment model.

All synthetic test profiles must remain marked `synthetic-test-only`; unknown technical parameters stay unknown/null.
