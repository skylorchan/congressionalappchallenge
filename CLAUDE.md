# CLAUDE.md: rules for AI assistants working in this repo

Kōkua is an offline-first, multilingual emergency preparedness app for Hawaiʻi, built by
Claude Code at Skylor Chan's direction as a test of what an AI coding agent can build.
It is **not** a Congressional App Challenge submission. As of 2026-10-09 the AI writes all
of the code, including the geo algorithms that were originally reserved for the student.
`AI_USAGE.md` must say so plainly.

## Hard rules

1. After every work session, append an entry to `AI_USAGE.md`: date, what AI generated,
   what Skylor decided or wrote. Keep it accurate; never imply human authorship of AI code.
2. Ask before hard-to-undo architecture decisions.
3. Never fabricate data. Seed/test data must be clearly labeled as such. Record every
   real dataset in `DATA_SOURCES.md` with URL, license, and date.
4. Never present unreviewed machine translation of `safety.*` strings as authoritative.
   The `SafeText` guard enforces this; don't bypass it.
5. Never imply a shelter is open. Shelters open per event; the app says so.
6. Never commit secrets. Small commits, clear messages.

## Data pipeline

The dev container cannot reach the data hosts. `.github/workflows/fetch-data.yml` runs
`scripts/data/fetch-raw.mjs` on a GitHub runner and commits raw downloads to `data/raw/`.
`npm run data:build` turns them into the app files in `public/data/`.

## Commands

- `npm run dev` / `npm run build` / `npm run preview`
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run e2e`
- `npm run data:build`, `npm run i18n:sync`
- Deployed base path is `/congressionalappchallenge/` (GitHub Pages). Routing uses hash URLs.
