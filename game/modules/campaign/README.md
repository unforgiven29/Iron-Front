# Campaign simulation module

**Owner:** game/modules/campaign. **Status:** optional planned gameplay module; no campaign runtime exists. Campaign must not become a global mode or a source of hidden sensor truth.

## Responsibility
Own long-running strategic state/rules: factions, diplomacy/war/peace state, territory/frontline, objectives, mission generation, resources/economy, civilian/civil infrastructure consequences, news/history, personnel outcomes and campaign-specific save data. Physical units/world/sensors remain with their owners.

## Inputs and authority
Consume committed world/unit/logistics/personnel events and permitted reconnaissance/intelligence reports. Campaign owns strategic knowledge; tactical AI/sensors receive only permitted observations. Fog-of-war is not a bypass. Tactical simulation may continue during a player sortie/infantry battle; distant regions may use an explicitly lower-detail aggregate update, but time, ownership and event ordering remain coherent.

## Focused packages
- factions: data-driven identities, doctrine, equipment pools, alliances, relations and private military contracts.
- scenarios: generated operational theatres, world-war start state, geography/seed and initial force/economy state.
- world-war: global alignments, fronts/sectors, country state and real-Earth theatre orchestration.
- missions: air/ground/naval/infantry tasks, objectives and debrief.
- institutions: government, general staff, service commands, intelligence, finance, diplomacy and civil defence decisions.
- intelligence: strategic estimates, signals/intercepts, deception, information integrity and public claims.
- society: population, media, local government, humanitarian services, infrastructure and civic consequences.
- justice: legal cases, investigations, due process, corruption/crime and accountability.
- personnel: named service histories, crew/soldier fate, rescue/capture/prisoners, casualty archive and memorial records.
- strategic-operations: long-range missions, strategic strikes, warning/verification and escalation.
- persistence: campaign schemas and migrations coordinated by core.

## Strategic model
Frontline/territory and occupied-area changes; airfield/port control and damage; force readiness/reserves; typed fuel/ammunition/spares/food/medical stock; production, trade and sanctions; road/rail/sea supply routes; manpower and mobilisation; energy/industry/communications infrastructure; civilian displacement and public services; diplomacy, alliances, ceasefire/peace and post-war recovery are explicit state transitions with traceable events and declared update rates. Avoid hidden side effects in one giant daily tick.

## Human-cost and narrative constraints
Casualties, injuries, capture, displacement, civilian harm, destroyed communities and long-term damage are consequences, not score rewards. Medals/achievements do not erase cost. Credits, memorials, war histories, investigations and post-war epilogues consume authoritative event/personnel records; they do not affect physics or convert deaths into bonuses.

Validate deterministic seeds; event/ledger reconciliation; territory and alliance transitions; supply denial; mission generation; civilian consequences; false-report handling; ceasefire/peace transitions; casualty estimates versus confirmed identities; reconstruction and save/migration.
