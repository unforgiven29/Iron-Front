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
- [ ] CI run green on main.
- [ ] Repository Pages setting changed to Settings > Pages > Source > GitHub Actions and deployment verified.
- [ ] Renderer comparison prototype measured and ADR accepted.
- [ ] Stage 1 module registry and dependency resolver implemented and tested.

## What Claude may start

Claude may begin Stage 0 verification/fixes and Stage 1 core contracts/module-loader work. It must not claim flight simulation or start large feature expansion until Stage 1 exit criteria pass.

The F-16 vertical slice is a test contract, not evidence that the F-16 is implemented.

## Readiness policy

Do not mark unchecked items complete without repository evidence. A green build is necessary but does not prove simulation fidelity. A completed vertical slice requires end-to-end causal tests and failure behavior.
