# Faction content definitions

Factions are data modules, not hardcoded branches. A definition may include stable ID, display name, nation/country identity, government type, doctrine references, command structure, diplomatic relations, coalition/alignment membership, equipment access/pools, starting force/reserve parameters, logistics/production policy, mobilisation rules, leaders/commander profiles and narrative metadata. Values are sourced or explicitly fictional/gameplay-tuned.

## Relationships and change
Represent allies, partners, neutral states, opponents, sanctions, basing/access rights, defence commitments, arms trade and diplomatic disputes as time-varying relations with authority, cause and history. Joining a coalition, defection, neutrality, surrender, occupation and post-war realignment are explicit campaign transitions with prerequisites and recorded decisions; a country does not switch sides merely because a hidden score crosses a threshold.

## Non-state and contracted forces
Private military companies, contractors, volunteers and other non-state groups have their own identity, employer/contract, unit roster, equipment source, operating area, funding, loyalty and terms. They may withdraw when unpaid, renegotiate, switch employer or be disbanded only through contract/decision events. They do not silently add free aircraft or ground units to a national inventory.

Campaign/AI resolve faction policy by IDs/capability/configuration. No faction-name conditional in shared runtime. Keep visual insignia/livery separate from combat mechanics. Validate duplicate IDs, missing doctrine/equipment refs, incompatible variant fit, invalid relations, unauthorized side changes, contract/payroll state and provenance.
