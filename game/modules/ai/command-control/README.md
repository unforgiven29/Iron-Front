# Command hierarchy, GCI and AWACS

Own tactical order hierarchy, task allocation, reporting relationships and command-picture policy. Sensor owns detections; communications owns transport; campaign owns strategic rules and institutions. GCI/AWACS is not global perfect radar.

## Report and control chain
Sensor observation → local report → transport → age/correlation at command node → controller decision/order → delivery/acknowledgement → agent action. Preserve direct versus remote/fused provenance, delay, quality, authority and uncertainty. GCI/AWACS aircraft, ground control centres and ship command nodes are platforms with finite sensor coverage, crew workload, fuel/power and communications dependencies.

## Degraded command
Radar/node destruction, jamming, controller workload, link loss and stale tracks degrade control. Define alternate command/autonomy policy; never give units updated hidden truth after communication loss. Command posts and radio masts can be physically captured/destroyed, changing connected communications and task authority through explicit events.

Strategic government, general staff, service headquarters, foreign ministry, finance, intelligence institutions and civil defence are campaign-owned decision actors; see game/modules/campaign/institutions/README.md. Do not duplicate that strategic decision engine here.

Test latency, out-of-order reports, authorization, controller capacity, node loss, link interruption, command-post capture/destruction and disconnected autonomy.
