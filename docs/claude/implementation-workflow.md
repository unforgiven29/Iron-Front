# Claude implementation workflow

Follow this sequence for every code change. The relevant system README remains authoritative for domain behavior.

## Documentation shape for Claude

Keep the global entry point short. The task router selects one canonical owner. The owner's README is a concise map of scope, ownership, inputs/outputs and links. Put deep technical detail in focused specialist guides that can be read independently. Do not put several systems into one mega-document, repeat the same technical explanation in multiple owners, or create a new folder for every small concept.

Before adding documentation, search for the existing canonical owner. Extend its focused page when the concept belongs there; create a separate page only when it has a distinct interface, behavior, validation set or independent task route. Cross-link to the owner instead of duplicating its design. Every page states implementation status and unknowns.

For a task, Claude should normally read: global entry/router/workflow (as required by the repo), one canonical owner README, and only the directly involved child guides. If a guide points to multiple unrelated children, read only the child matching the current task.

## 1. Scope
Name the roadmap stage and exact acceptance criterion. Identify the canonical owner, direct consumers, existing code/data/contracts/tests and explicit non-goals. Split multi-domain requests into ordered vertical slices.

## 2. Specify contracts before behavior
For every changed capability, define stable ID/API version; authoritative owner; input/output schema; units/frames/time; uncertainty/quality/provenance; update domain and ordering; resource dependencies; lifecycle; stale/invalid/missing/failure/recovery behavior; save/replay needs.

A command is a request. An event is a committed fact. An observation is imperfect evidence. A snapshot is immutable read state.

## 3. Test-first implementation
Cover valid and invalid configuration, boundaries, missing/incompatible dependencies, stale data, partial/total resource loss, failure/recovery, duplicate/out-of-order messages, state isolation, replay/save where relevant and representative performance. Prefer public contracts for integration tests.

## 4. Build one causal slice
Use production owner interfaces. Test fakes may stand in for unfinished dependencies, but must be clearly test-only. Never bypass an unfinished dependency with hidden truth, direct mutation or a fake boolean in production.

## 5. Fidelity
State the fidelity tier, validity envelope and approximations. Separate public/sourced, derived, estimated, synthetic and gameplay-tuned parameters. Do not silently reduce fidelity based on frame rate or claim physically exact results without validation.

## 6. Verify
Run focused tests while iterating, then npm run check and npm run test:e2e when relevant. Run scenario/performance cases required by the system guide. Do not remove/weaken tests to force green.

## 7. Document and report
Update the owning README if supported behavior/contracts changed; update related guides only for cross-owner changes. Mark roadmap items complete only with evidence.

Report files changed, actual behavior implemented, test commands/results, limitations/unsupported cases and next blocker. Explicitly distinguish code, schemas, documentation and placeholders.
