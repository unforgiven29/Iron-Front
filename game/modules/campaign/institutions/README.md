# Strategic institutions and bounded national decision-making

**Owner:** game/modules/campaign/institutions. **Status:** architecture only; no institution-level campaign AI exists. This is distinct from tactical agents under game/modules/ai.

## Institution profiles
A country may instantiate government/cabinet, general staff, air force command, navy, logistics command, intelligence service, foreign ministry, finance ministry and civil defence. A profile declares mandate, objectives and weights, risk appetite, planning horizon, decision cycle, resource authority, permitted actions, reporting relationships, leader/commander identity and current capacity. Not every state needs every institution.

## Decision records
An institution evaluates feasible options from its own permitted reports and resource picture. Preserve intent, options, estimated gains/cost/risk, information quality, confidence, chosen option, deciding factors, authority and review horizon. Decisions are committed campaign events and can be inspected/explained. Institutions do not read hidden tactical world state or exact enemy force inventories.

## Bounded autonomy and coordination
Institutions may decide only within their delegated authority. Out-of-scope decisions are referred upward; disagreements are resolved by the authorized superior and recorded. General staff issues command intent; front commanders report deviations and may exercise explicitly limited local discretion. Emergencies can change priorities (reserve commitment, capital relocation, aircraft dispersal, air-defence emission control), but require preconditions and decision records.

## Review and adaptation
After-action review compares expected results with outcomes as seen through that institution's information. Lessons affect doctrine or readiness only after repeated evidence, bounded changes and regression checks. Memory decays; leader changes can alter institutional priorities; adversaries adapt only to patterns they could plausibly observe. A rare-event director may generate coups, mutinies, desertion, epidemics, industrial accidents or leadership/defection crises only with prerequisites, cause records, cooldowns and fairness limits. Never target the player simply to create drama.

## Validation
Authority violation; incomplete/conflicting reports; decision provenance; horizon/review timing; limited autonomy; rare-event preconditions/cooldowns; bounded learning/reversion; leadership change; reproducible campaign replay.
