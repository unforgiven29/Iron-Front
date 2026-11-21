# Strategic operations and escalation

**Owner:** game/modules/campaign/strategic-operations. **Status:** architecture only; no strategic operations runtime exists.

Own campaign-level orchestration of long-range operations and their consequences. Actual aircraft, missile, ship, sensor, interceptor and damage behavior belongs to platform/weapon/physics owners. This module chooses policy, schedules assets/resources and records strategic results; it does not draw an attack arc and declare an impact.

## Operation families
- Strategic bomber missions and escort/intercept responses.
- Long-range conventional missile and ballistic-missile campaigns.
- Airfield, port, depot, refinery, energy and command-infrastructure strikes.
- Maritime convoy protection/interdiction, blockade and sea-lane pressure.
- Strategic reconnaissance, dispersal, alert posture and integrated air-defence coordination.
- Nuclear escalation as an explicitly bounded campaign outcome/effect model, separate from weapon flight/physics.

## Causal chain
Political/command authorization → intelligence assessment and target confidence → asset and stock allocation → mission/launch event → physical delivery/interception through the relevant weapon and defence systems → damage/casualty/infrastructure events → logistics/economic/diplomatic/public response → reassessment. A missed launch, failed missile, interception, dud, false report or partial impact must remain possible and recorded.

Strategic systems use named escalation postures, decision authorities, warning/verification stages, communication constraints and de-escalation/off-ramp states. A false alarm or sensor warning does not itself cause nuclear release. Keep strategic effects appropriately abstract where precise physical or historical models are unavailable.

## Validation
Authorization; target intelligence uncertainty; stock and platform availability; interception/partial failure; warning verification; escalation thresholds and off-ramps; infrastructure/civilian consequence; no hidden-truth targeting; save/replay and provenance.
