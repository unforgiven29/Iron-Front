# Passive ESM / RWR runtime

This directory contains the first executable passive radar-warning receiver slice.

## Modules

- `RwrRuntime.ts`: models whether an emitted radar signal reaches a receiver. It applies transmitter beam pattern, free-space spreading, path transmission, receiver tuning/instantaneous bandwidth, spectral overlap, thermal noise, noise figure, sensitivity and SNR threshold. It estimates pulse count, noisy nose-relative bearing, frequency/pulse-width/PRF measurements and matches the result against a configurable emitter signature library.
- `RwrTracking.ts`: associates reports by predicted bearing and RF frequency, estimates bearing rate, maintains signature confidence, and supports new/established/coasting track states.

## Information boundary

An observation intentionally contains no emitter entity ID, target truth position or direct range. Passive RWR reports bearing and signal characteristics; range is null. Track IDs are local contact handles, not world entity IDs. Classification confidence is explicitly an unvalidated signature match, not a calibrated posterior probability.

## Limits

- Bearing architecture is retained as a receiver property; bearing accuracy remains a configured receiver parameter until an exact interferometer/antenna installation is calibrated.
- The emission interface accepts a signal snapshot; it does not yet simulate pulse-by-pulse intercept probability, receiver channelization, superheterodyne IF chains, DF baseline geometry, amplitude/phase comparison channels or time-difference-of-arrival across multiple aircraft.
- The signature library is data-driven but no real radar library is shipped. Every emitter profile must identify exact radar variant, mode, frequency agility, waveform and evidence provenance.
- The model does not yet fuse RWR contacts with onboard radar, ESM/ELINT, datalink, threat libraries or a cockpit RWR display.
- It does not model deception/repeater jamming, DRFM false emitters, monopulse angle deception, deceptive range gates or coherent jamming effects in the receiver front-end.

Tests: `game/tests/unit/RwrRuntime.test.ts` and `game/tests/unit/RwrTracking.test.ts`.
