# Implementation readiness gate

This gate separates a repository that is organized from one that is safe to extend.

## Stage 0 foundation checklist

- [x] Architecture PR merged to main.
- [x] Root Claude instructions and roadmap created.
- [x] Node/npm, Vite, TypeScript, Vitest, Playwright, ESLint and schema validation wired into scripts.
- [x] Initial app shell and renderer-neutral ports created.
- [x] CI and GitHub Pages workflows committed.
- [x] Units, frames, quaternion and timestep conventions defined.
- [x] First F-16 vertical-slice acceptance suite documented.
- [x] package-lock.json generated on GitHub Actions and committed; clean installs use npm ci.
- [x] CI run green on main using the committed lockfile (lint, type, schema, unit, build and browser smoke checks).
- [x] Stage 0.5 foundation hardening changes merged and CI-verified.
- [ ] Stage 1 module registry and dependency resolver implemented and tested.

## Deferred gates (not blockers for Stage 1)

- [ ] Repository Pages setting changed to Settings > Pages > Source > GitHub Actions and deployment verified. This is an external repository setting; the Pages build currently succeeds but deployment is skipped until Pages is enabled.
- [ ] Renderer comparison prototype measured and ADR accepted. This belongs to the renderer/cockpit stage, not the Stage 1 runtime-contract gate.

## What Claude may start

Stage 0.5 is complete and CI-verified. Claude should begin Stage 1 core contracts/module-loader work. The new antenna schema and radar documentation do not mean antenna physics exists. Claude must not claim flight simulation or start aircraft, sensor, weapon or campaign feature implementation until Stage 1 exit criteria pass.

The F-16 vertical slice is a test contract, not evidence that the F-16 is implemented.

## Readiness policy

Do not mark unchecked items complete without repository evidence. A green build is necessary but does not prove simulation fidelity. A completed vertical slice requires end-to-end causal tests and failure behavior.
