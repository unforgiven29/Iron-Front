# UI, cockpit controls and displays

UI owns presentation and input translation. Aircraft/platform systems own switch behavior, avionics state and display data.

Each clickable control has stable control ID, command contract, issuer/station and target. Validate range/enum/hold/release/cancel at input boundary. A click is a request, not authoritative state mutation. Indicators and scopes read immutable snapshots and display stale/invalid/unavailable state honestly.

Aircraft packages provide cockpit layout, labels, positions, animations and display mappings; generic UI supplies reusable widgets. Different aircraft can have different cockpit architectures. Support mouse/keyboard/touch/joystick through the same commands; handle lost focus and input cancellation.

Test mapping, rejected commands, snapshot feedback, stale indications, hold/release cleanup, accessibility/mobile layout and absence of direct simulation mutation.
