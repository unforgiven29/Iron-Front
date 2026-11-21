# HTML-Flight-Combat feature migration crosswalk

**Source reviewed:** [unforgiven29/HTML-Flight-Combat](https://github.com/unforgiven29/HTML-Flight-Combat), including its README, architecture notes, CHANGELOG and current `js/` domain layout. The old repository advertises itself as Viper Sortie and has grown from a flight-combat prototype into a combined-arms and global-war game.

**Target:** Iron-Front. This file is a migration index and parity checklist, not a duplicate system specification and not proof that a runtime exists.

## Migration rule

Transfer player-facing capabilities, scenario concepts and causal interactions—not the old JavaScript implementation. The legacy project uses classic scripts sharing global state, load-order dependencies and multiple wrappers around a large central game file. Iron-Front must use typed contracts, fixed simulation time, data-driven platform modules, explicit authority and the canonical owners below. Do not copy legacy numeric tuning or treat a game-level approximation as engineering data.

## Feature-to-owner map

| Legacy capability | Iron-Front owner | Migration requirement |
|---|---|---|
| Large multi-era aircraft roster, selectable aircraft/variants, custom models and audio | game/modules/planes; docs/assets-and-pipeline | Each selectable aircraft is an exact package/variant with sourced data, compatibility, cockpit mapping and validated assets; expand roster by packages, not one aircraft-name switch. |
| Detailed jet flight, stall/compressor stall, V/STOL, ramjet, structural/G limits | physics/flight-model, physics/aerodynamics, physics/propulsion, physics/rigidbody | Retain the physical phenomena only where the aircraft installation and datasets support them; declare model fidelity and validity envelope. |
| Dedicated 3D cockpits, HUD/MFD, clickable switches, startup, RWR/radar scopes and control bindings | platform aircraft modules; game/graphics-engine; game/systems/crew | Per-aircraft layouts/procedures map to real commands and snapshots; rendering never owns system state. |
| Radar, pulse control, AESA/scan behavior, IRST, EO/TV/laser sights, NCTR, RWR, jamming and fusion | sensors/*; physics/radar; physics/optics; game/systems/communications | Preserve distinct detection mechanisms, installation fit, uncertainty, RF/optical propagation, resource use and electronic attack/defence. |
| Missile/gun/bomb/rocket/pod/anti-ship stores, beam riding, ARH/IR seekers, missile-view cameras, MAWS | game/modules/weapons; physics/guidance/ballistics/propulsion; sensors/weapon-seeker | Reuse the existing component/seeker/guidance architecture; do not duplicate guidance or seeker algorithms inside aircraft. |
| Helicopters (AH-64/Ka-50 and transport/attack rotorcraft), rotor controls, sights and weapons | game/modules/rotorcraft; physics/rotorcraft | Separate rotor aerodynamics/transmission from aircraft configuration; model hover, transition, damage and emergency behavior with validated fidelity. |
| Tanks/IFVs/APCs with per-hit armour, crew/component damage, mobility/firepower kills, ERA/composite/spall and ammunition hazards | game/modules/ground-units; physics/armour; game/systems/damage | Each exact vehicle maps physical plates/zones and internal components; impact reports drive connected effects and crew consequences. |
| Artillery, counter-battery/indirect fire, SAM/air-defence sites and radar/launcher composition | game/modules/ground-units/artillery and air-defence; game/modules/ai | Fire-control uses imperfect reports and shared ballistics; radar, command, launcher and support may be separate entities. |
| Playable infantry roles, custom kits, small arms, attachments, optics/iron sights, first-person recoil/reload | game/modules/infantry/combat and equipment | Weapon handling, sights, body-zone protection, ammunition and input commands are stateful and use shared ballistics/optics. |
| Infantry squads, formations, flanking, suppression, trenches, assaults, retreats, surrender and reinforcements | game/modules/infantry/behaviour; game/modules/ai/ground | Orders and observation-driven beliefs determine actions; command post, radio and morale/resource loss can alter behavior. |
| Enterable buildings, furnished multi-floor interiors, windows/stairs, partial destruction, collapse/rubble and fortifications | game/world/structures; physics/collision; game/modules/infantry | Model structural supports, openings, interior navigation, occupant hazards and physical debris separately from render meshes. |
| Infantry injury by body region, bleeding, treatment, medics, casualty crawl and helicopter/ground medevac | game/modules/infantry/medical-support; game/modules/campaign/personnel | Preserve distinct injury, treatment, evacuation and persistent fate records; avoid unsupported medical claims. |
| FPV attack drones, one-way attack drones, armed UAS and reconnaissance | game/modules/uncrewed-systems; sensors; game/systems/communications | Separate autonomy, payload, operator/video/control link, lost-link policy, endurance and stock usage. |
| Carriers, warships, submarines, sea control, blockade, convoys and anti-ship operations | game/modules/naval-units; naval-units/subsurface-and-maritime-operations | Model ship/submarine variants, sensor uncertainty, convoy/cargo loss, port throughput and carrier deck cycles. |
| Civil airliners and civil airport traffic, civilian harm from attacks | game/modules/civil-aviation; campaign/society/personnel | Integrate civil routes/identification with airspace and preserve human/legal/economic consequences of attack or misidentification. |
| Campaign frontlines, sector ownership, airfields, bases, reserves, mission generation and persistent operational history | game/modules/campaign; campaign/missions; campaign/persistence | Events and owned records drive front/field changes; no hidden state in mission scripts; migrations and audits reconcile inventory. |
| Global world war, countries/alliances, real terrain/airports/towns/borders, streamed Earth and generated campaign maps | game/modules/campaign/world-war; game/world | Support both seeded generated theatres and licensed/provenanced geospatial data; streaming is not entity deletion or campaign pause. |
| AI air/ground/naval tasking, GCI/AWACS, strategic institutions and bounded decision-making | game/modules/ai; campaign/institutions; sensors; communications | Tactical and strategic AI use permitted reports, declared authority, latency, resource limits and auditable intent. |
| Logistics, fuel/ammunition/spares, depots/convoys, production, roads/bridges, trade and blockades | game/modules/logistics; game/world/infrastructure | Use typed conserved inventories, route capacities, finite delivery time, attrition and repair/production records. |
| Governments, diplomacy, mobilisation, alliances/defections, economy, infrastructure and peace/ceasefire | game/modules/campaign; campaign/institutions; campaign/world-war | Strategic changes are authorized events with costs, prerequisites and history. |
| Civilian population, refugees/displacement, emergency services, hospitals, media, public trust, justice and cultural heritage | game/modules/campaign/society | Reports preserve evidence/confidence; service capacity and public consequences evolve from events and logistics. |
| SIGINT, radio compromise, deception, camouflage, feints, propaganda and false public alerts | game/modules/campaign/intelligence; game/systems/communications | Intelligence is an uncertain report pipeline; claims can be corrected; no false alarm alone causes escalation. |
| Strategic bombers, long-range/ballistic strikes, nuclear escalation and missile interception | game/modules/campaign/strategic-operations; game/modules/weapons | Campaign authorizes and schedules; weapon/defence modules simulate physical delivery and failure; strategic effects remain explicit/appropriately abstract. |
| Pilot career, named aircrew, CSAR, missing/captured/rescued personnel, POW exchange, casualty archive, memorial and post-war reconstruction | game/modules/campaign/personnel; game/modules/campaign/society | Crew/infantry own live state; personnel ledger records outcomes; estimates remain explicitly estimated; memorials/history derive from records. |
| Local co-op, host authority, shared sorties/campaign and save export/import | game/core/networking; game/core/persistence; campaign/persistence | Preserve local single-player without backend. Persistent multiplayer needs an authoritative backend adapter, replication/authority and reconnect/resync validation. |

## Explicitly not ported verbatim

- The giant global game object and classic-script load-order/wrapper pattern.
- The central 1.5 MB game file and hidden side effects.
- Unverified aircraft, weapon, armour, radar or performance numbers.
- Generic multipliers/scalars that replace causal equipment/physics state.
- Campaign casualty estimates presented as confirmed individual outcomes.
- Render meshes or UI labels used as collision, visibility, damage or sensor truth.
- Legacy balance values unless deliberately migrated as labeled gameplay-tuned scenario data.

## Migration completion criteria

A mapped capability is not complete because this index or a README exists. Mark runtime parity only after an owning implementation, versioned contracts/data, causal integration tests, failure/recovery cases, performance evidence and a playable vertical slice exist. Track implemented, partial, planned and intentionally deferred status in the owning guide and roadmap.
