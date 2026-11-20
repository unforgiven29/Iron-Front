# Campaign save payloads and migrations

**Owner:** campaign/persistence for strategic payload schema; game/core/persistence coordinates the transaction. **Status:** design only.

Campaign payload stores strategic state, not a dump of active runtime objects: faction relations, territorial ownership/frontline, campaign clock, logistics stock/contracts, production, reserves, mission history, political/peace state, news/war events, civilian outcomes and references to active entities. Active units serialize through their platform/core modules and are linked by stable IDs.

Record schema/content versions, scenario/world seed and generator version, module/config hashes, event cursor/history policy, and migration metadata. Validate references between unit/faction, facility/owner, mission/events and inventory/logistics nodes before committing load.

Load into staging state; validate all required cross references; commit atomically. Failed migration leaves original state intact. Preserve unknown optional history when safe; fail on incompatible critical state. Test round-trip over multiple campaign days, corrupted data, version upgrade, missing optional content and stable IDs.
