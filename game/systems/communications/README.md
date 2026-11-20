# Communications, radio and datalink transport

**Owner:** game/systems/communications. **Status:** architecture only; no network/voice runtime exists.

## Responsibility
Transport messages between crew, aircraft, ground units, command posts, ships and external services with finite coverage, latency, capacity, interference and equipment constraints. It carries reports and orders; it does not create sensor truth.

## Distinct transports
Separate voice/radio, intercom, command/data link, wired line and relays where supported. Each installation declares transmitter/receiver capability, frequency/channel, antenna, power/cooling, protocol/message types, encryption abstraction, range/LOS assumptions and failure state. Do not treat all communications as one perfect global chat bus.

## Delivery contract
A send attempt records sender/receiver, transmit tick, channel, power state, antenna/propagation result, quality, latency, message priority, delivery/drop/corruption state and acknowledgement. Delivered reports retain original source/acquisition tick and relay chain. Simulation time and wall-clock network time remain distinct.

## EW and failure
Jamming/interference enters the relevant RF path; it is not a universal percentage multiplier. Include terrain/LOS blockage, wrong channel, busy network, radio damage, antenna loss, power loss, relay outage and stale report behavior. Units act on last-known information when disconnected; they do not get live hidden updates.

## Tests
Latency/loss/reordering, channel mismatch, relay paths, jamming, antenna/power fault, wrong recipient, stale report, acknowledgment timeout and no delivery without required equipment.
