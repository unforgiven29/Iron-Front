# AI agents and doctrine framework

**Owner:** game/modules/ai for agent decision logic/doctrine. Core owns scheduling/messages/entities; sensors own observations; communications transport reports; mission/campaign/command-control own orders/objectives. **Status:** architecture only.

Agents maintain local beliefs from permitted reports, memory and orders. They never query exact hidden world positions, enemy component state, campaign databases or private sensor tracks. Every belief carries source, time, confidence, uncertainty and age.

A decision cycle is: receive reports/orders → update belief → evaluate objectives/resources/risk → select intent → issue typed command/order → receive authoritative result/event → reassess. Agents do not set positions, damage, radar locks or weapon outcomes directly.

Separate role, capability, doctrine, behavior, task, memory and platform adapter. Doctrine values (aggressiveness, fuel reserve, formation spacing, risk tolerance) are configuration. Physical limits come from platform/service snapshots. Coordination uses communications with delay, loss, jam and order authority.

Validate stale/missing reports, comms loss, resource shortages, damage, retreat/evacuation, conflicting orders, deterministic decisions and no-omniscience.
