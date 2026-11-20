# Contributing to Iron-Front

## Requirements

- Node.js 22.13 or newer (Node 22 LTS recommended).
- npm 10.9.9 (the version recorded by package.json).
- Git.

## Setup

```bash
npm ci
npm run check
npm run dev
```

For browser tests:

```bash
npx playwright install chromium
npm run test:e2e
```

The committed `package-lock.json` is the authoritative dependency graph. Use `npm ci` for clean installs. When adding or changing a dependency, use an exact version (for example `npm install --save-exact package-name@1.2.3`), commit both package.json and package-lock.json, and verify a clean `npm ci`.

## Changes

- Keep changes scoped to one roadmap milestone.
- Read `CLAUDE.md` and architecture docs before changing ownership.
- Add/update tests with behavior changes.
- Include data provenance for technical parameter changes.
- Do not include restricted/copyrighted reference documents or assets without redistribution rights.
- Report test commands/results accurately.
- Update documentation and known limitations when behavior changes.

## Required checks

`npm run check` must pass before a change is considered ready. Browser-facing changes should also pass `npm run test:e2e`. GitHub Actions runs CI and builds the static site from `main`.
