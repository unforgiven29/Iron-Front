# AI agents and doctrine framework

**Owner:** game/modules/ai for tactical agent decision logic/doctrine. Core owns scheduling/messages/entities; sensors own observations; communications transport reports; mission/campaign/command-control own orders/objectives. **Status:** architecture only.

Agents maintain local beliefs from permitted reports, memory and orders. They never query exact hidden world positions, enemy component state, campaign databases or private sensor tracks. Every belief carries source, time, confidence, uncertainty and age.

A decision cycle is: receive reports/orders → update belief → evaluate objectives/resources/risk → select intent → issue typed command/order → receive authoritative result/event → reassess. Agents do not set positions, damage, radar locks or weapon outcomes directly.

## Domains
Air agents support navigation, formation, takeoff/landing requests, patrol/CAP, intercept, escort, BVR/WVR policy, disengage, refuelling rendezvous, recovery and emergency tasking. Ground agents support route/formation, bounds/overwatch, flank, defend, suppress, assault, withdraw/retreat, obstacle handling, resupply, repair and casualty evacuation. Naval agents support route/station keeping, patrol, screen/escort, search, threat response, replenishment and deck/convoy coordination. Infantry agents act at the individual and squad level under their own behavior profiles.

## Doctrine, command and learning
Separate role, capability, doctrine, behavior, task, memory and platform adapter. Doctrine values (aggressiveness, fuel reserve, formation spacing, risk tolerance, suppression response, casualty policy and emissions discipline) are configuration. Physical limits come from platform/service snapshots. Coordination uses communications with delay, loss, jam and order authority. GCI/AWACS reports are sensor/communications-derived; controllers do not possess a perfect global track file.

Strategic government/service institutions are owned by game/modules/campaign/institutions, not by tactical AI. Tactical agents may have bounded autonomy when orders are stale/lost, with rules for mission priority, return/hold/continue and rejoin; they still cannot acquire hidden truth.

Validate stale/missing reports, comms loss, resource shortages, damage, retreat/evacuation, conflicting orders, leadership/command loss, deterministic decisions and no-omniscience.
