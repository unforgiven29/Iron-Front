# Infantry and squad behavior profiles

Own behavior/doctrine configuration and task definitions, not movement or weapon algorithms. Inputs are explicit orders, local observations, squad state, terrain/cover queries, communications and resource status. Profiles may declare training/discipline, cohesion, caution, suppression response, movement style, casualty evacuation policy and leadership behavior.

Behavior updates should be multi-rate and deterministic. The agent updates belief, evaluates order/risks and emits intent/commands. It cannot set position, damage, enemy location or weapon outcome. Profiles are faction/mission content data, not hardcoded name branches.

Test order interpretation, stale/missing observations, suppression and morale effects, leader loss/succession, retreat/surrender, communications loss and reproducible behavior.
