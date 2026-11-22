# Weapon seeker and countermeasure runtime

The executable seeker-related kernels are kept separate from product-specific missile data.

## Modules

- `SeekerDiscrimination.ts`: scores observed signal, spectral, angular, thermal-decay, kinematic and track-continuity cues against a configurable seeker feature envelope. Outputs uncalibrated relative weights, not real probability of target identity.
- `SeekerRuntime.ts`: gimbal travel and rate, acquisition dwell, track/coast memory, power/cooling/health, and external illumination/command-link dependency state.
- `CountermeasurePhysics.ts`: band-integrated Planck radiance, lumped thermal flare cooling/chemical heat input, IR seeker power/features, chaff advection/dispersal/particle depletion and wavelength-dependent cloud RCS.

## Data boundaries

The seeker sees observations, not hidden entity labels. Target and decoy candidate records share the same numeric observation shape. Flare thermal properties, chaff dimensions/particle RCS, seeker band filters and discrimination expectations must be profile-specific, sourced or explicitly synthetic-test-only.

## Limits

- The flare model is a lumped thermal body. It omits detailed chemical reaction kinetics, multi-layer material ablation, fragmented plume combustion and calibrated spectral line emission.
- IR propagation is coefficient-driven per band; the model is not a full atmosphere/radiative-transfer solver.
- The chaff model uses a configurable resonance envelope and incoherent particle-RCS sum. It is not a full electromagnetic scattering solver and does not currently resolve individual dipoles, orientation distributions, polarization or turbulent particle trajectories.
- Seeker discrimination profile scores are uncalibrated. No AIM-9/ASRAAM/IRIS-T/R-73 or radar-seeker variant is validated by the generic kernels alone.
- The current radar seeker front end is not complete. Active/semi-active radar seeker receiver processing, monopulse angle tracking, range gates, velocity gates, memory, ECCM and fuze/warhead interaction remain future work.

Tests: `game/tests/unit/SeekerRuntime.test.ts` and `game/tests/unit/CountermeasurePhysics.test.ts`.
