# Contributing to Iron-Front

## Requirements

- Node.js 22.13 or newer (Node 22 LTS recommended).
- npm 10 or compatible.
- Git.

## Setup

Run `npm install`, then `npm run check`, then `npm run dev`.

For browser tests, run `npx playwright install chromium` followed by `npm run test:e2e`.

The first successful `npm install` generates `package-lock.json`. Commit that file with dependency changes so CI and other developers use the same dependency graph. Direct dependencies are pinned to exact versions in package.json; do not use floating latest versions.

## Changes

- Keep changes scoped to one roadmap milestone.
- Read `CLAUDE.md` and architecture docs before changing ownership.
- Add/update tests with behavior changes.
- Include data provenance for technical parameter changes.
- Do not include restricted/copyrighted reference documents or assets without redistribution rights.
- Report test commands/results accurately.
- Update documentation and known limitations when behavior changes.

## Required checks

`npm run check` must pass before a change is considered ready. Browser-facing changes should also pass `npm run test:e2e`. GitHub Actions runs CI and publishes the static site from `main`.
