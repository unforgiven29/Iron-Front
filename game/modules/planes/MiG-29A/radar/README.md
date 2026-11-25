# MiG-29 product 9.13 radar installation

**Working equipment family:** N019/RLPK-29 for product 9.13, with exact radar hardware/software and operator baseline requiring source confirmation. This directory owns the aircraft-specific fit/installation only. Shared simulation lives in sensors/Radar and physics/radar.

## Required installation data
Antenna geometry/boresight, mounting frame, gimbal/mechanical scan limits, stabilization/navigation inputs, operating modes, receiver/transmitter hardware revision, cockpit control/display interfaces, power/cooling, BIT/startup, maintenance and damage paths. Label every capability as confirmed, provisional or unknown.

## Variant separation
Do not transfer MiG-29S 9.13S N019M/TWS2/R-77 or later MiG-29M/SMT capabilities into product 9.13 without evidence. Generic N019 family resemblance is not sufficient to assume software/mode parity.

## Integration and tests
Commands from avionics; uncertain reports to cockpit/fusion; actual resource grants; shared physical RF chain. Test configuration, stabilization, power/cooling, mode/control mapping, startup, aperture/antenna damage and no hidden-world target input.

## Implemented installation (first slice)
`game/src/platforms/aircraft/mig29/avionics/N019Profile.ts` (radar), `KolsProfile.ts` (IRST/LRF), `MiG29WeaponControl.ts` (СУВ modes, controls, symbology). Source: «Боевое применение самолёта МиГ-29» (cited BP-29, export RLPK-29E/OEPrNK-29E fit — confirm applicability to product 9.13). Every hardware value carries published/derived/estimated/fitted status; one fitted value per sensor.
