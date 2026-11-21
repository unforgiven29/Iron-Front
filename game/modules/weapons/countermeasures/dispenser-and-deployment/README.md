# Countermeasure dispenser, programs and release sequence

**Owner:** platform package for installed dispensers/controls; weapon countermeasure profiles for cartridges; this guide owns their configuration contract. **Status:** architecture only.

## Dispenser installation

Define exact station, dispenser type, number of buckets/channels, cartridge compatibility, capacity, electrical power, command/control interface, release direction/impulse, inhibits/interlocks, jam/fault sensing, safe separation and damage zones. Aircraft packages map cockpit controls and programming; they do not hard-code inventory into seeker logic.

## Program configuration

A release program is an ordered sequence of events with decoy type, quantity, interval, repeat count, release channel, inhibit condition and optional pilot abort. It is a scheduling instruction, not a guaranteed countermeasure result. Distinguish program selection, commanded release, successful cartridge ejection and decoy ignition/deployment.

## Runtime inventory and failures

Consume finite inventory only when the relevant ejection succeeds. Model empty bucket, jam, electrical power loss, wrong cartridge, safe/inhibit interlock, misfire, partial release and dispenser damage. Record per-event timestamp and resulting decoy instance. UI feedback reflects actual dispenser state.

## Validation

Test compatibility, sequence timing, quantity, simultaneous channels, program cancellation, inventory persistence, jam/misfire, interlocks, damage, safe separation and actual dynamic decoy state.
