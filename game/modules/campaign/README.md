# Campaign simulation module

**Owner:** game/modules/campaign. **Status:** optional planned gameplay module; no campaign runtime exists. Campaign must not become a global mode or a source of hidden sensor truth.

## Responsibility
Own long-running strategic state/rules: factions, diplomacy/war/peace state, territory/frontline, objectives, mission generation, resources/economy, civilian/civil infrastructure consequences, news/history, outcomes and campaign-specific save data. Physical units/world/sensors remain with their owners.

## Inputs
Consume committed world/unit/logistics events and permitted reconnaissance/intelligence reports. Campaign owns strategic knowledge; tactical AI/sensors receive only permitted observations. Fog-of-war is not a bypass.

## Packages
factions = data-driven identities/doctrine/equipment pools/relations. missions = templates/objectives/task/debrief. scenarios = initial world/force/seed. persistence = campaign schemas/migrations coordinated by core. logistics = stock/production/transport/repair.

## Strategic model
Frontline/territory, airfield/port control, fuel/industry, supply routes, manpower/reserves, infrastructure damage, civilian displacement and negotiation are explicit state transitions with traceable events and declared update rates. Avoid hidden side effects in one giant daily tick.

## Narrative constraints
Casualties, injuries, capture, displacement, civilian harm and damaged communities are human consequences, not merely score rewards. Medals/achievements do not erase cost. Credits/memorial/history consume campaign records; they do not affect physics.

Validate deterministic seeds, stock accounting, territory transitions, supply denial, mission generation, civilian consequences, peace/ceasefire transitions and save/migration.
