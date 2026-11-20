# Architecture decision records (ADRs)

ADRs record material choices affecting module ownership, contracts, technology, data formats, simulation fidelity or deployment. They stop later contributors/Claude sessions from unknowingly reversing foundational decisions.

Write an ADR when a change alters canonical ownership/dependency direction, adds/removes a shared service, changes time/physics/coordinate/determinism conventions, adds a major platform dependency, changes save/asset/configuration compatibility, or makes a user-observable fidelity/performance trade-off.

Format: number/title, status (proposed/accepted/superseded), date, context, decision, alternatives, consequences/trade-offs, affected contracts/folders and migration notes.

ADRs are append-only. Supersede an accepted decision with a new ADR rather than silently rewriting it.

## Current decisions

- ADR-0001: Module composition, shared-engine ownership and dependency direction.
