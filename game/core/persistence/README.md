# Persistence, save/load and replay

Save data is versioned scenario state, not a dump of arbitrary live JavaScript objects. A save records format version, tick/time, scenario/configuration identity, module IDs/versions, random stream state, entity/system state and migration metadata.

Each module owns serialization of its state through a versioned contract; core coordinates orchestration. Load validates required modules and schemas before mutating the running scenario. Migrations are explicit and tested. Unknown optional data may be preserved when safe; incompatible critical state fails with a useful explanation rather than silently changing equipment.

Command/event recording supports deterministic replay. Browser local storage is not a durable multiplayer database.

**Status:** Architecture specification only.
