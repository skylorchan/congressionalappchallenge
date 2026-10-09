# AI usage disclosure

This project uses Claude Code (Anthropic) as an AI coding assistant, acting as a senior
engineer and tutor. Per Congressional App Challenge rules, every session is logged here.

**Ground rules:** AI scaffolds tooling, config, build/deploy, boilerplate UI, and tests,
and reviews and explains code. The core algorithms (point-in-polygon, zone lookup,
distance, nearest-safe-place search, and the offline sync queue) are written by the
student. Those files are marked `[STUDENT-OWNED]` in their headers and listed in
`CLAUDE.md`.

Legend: **AI generated** = code/text written by the AI. **Student wrote** = code/text
written by Skylor. **AI reviewed** = student work the AI reviewed or commented on.

---

## 2026-10-09: Session 1, Milestone 1 (project setup)

**AI generated**

- Planning: reviewed the project brief, listed risks/ambiguities, proposed folder
  structure and the M1 plan (approved by Skylor before any code was written).
- Research: located the official tsunami evacuation zone layers on the Hawaiʻi Statewide
  GIS server and recorded them in `DATA_SOURCES.md` (not downloaded yet). Searched for a
  shelter dataset and did not find one.
- Project rules and docs: `CLAUDE.md`, this file's header, `DATA_SOURCES.md`, `README.md`
  (incl. Mermaid architecture diagram).
- Tooling and config: `package.json`, `tsconfig*.json`, `vite.config.ts`,
  `vitest.config.ts`, `playwright.config.ts`, `eslint.config.js`, Prettier config,
  `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`.
- App shell (boilerplate UI): `src/main.tsx`, `src/App.tsx`, `src/app/*`,
  `src/components/*`, `src/features/*/…Screen.tsx` (placeholder screens),
  `src/styles/global.css`, `index.html`.
- Service worker: `src/sw.ts`.
- i18n system: `src/i18n/*` (init, language detection, typed keys, translation-status
  lookup), the `SafeText` safety-translation guard, and `scripts/i18n-sync-status.mjs`.
- Translations: all English UI strings, and a **machine draft** of all Japanese strings
  (`src/i18n/locales/ja.json`). Every Japanese string is flagged `machine` in
  `translation-status.json`; none are reviewed yet.
- Icons: `public/icons/favicon.svg` and `scripts/generate-icons.mjs`, which rendered the
  PNG icons.
- Tests: `src/i18n/translations.test.ts`, `src/i18n/languages.test.ts`,
  `src/components/SafeText.test.tsx`, `src/components/OfflineBanner.test.tsx`,
  `tests/e2e/offline.spec.ts`, `tests/e2e/pwa.spec.ts`.

**Student wrote**

- The project brief, requirements, milestones, and quality bar.
- Decisions: GitHub Pages hosting, Japanese as the second language, keeping the repo name,
  approval of the M1 plan.
- No application code yet. Student-owned files (`src/geo/*`) start in M2.

**AI reviewed**

- Nothing yet (no student code this session).

**Verification run by AI:** lint, format check, typecheck, 20/20 unit tests, 4/4
Playwright tests (incl. airplane-mode reload and offline language switch), plus a negative
control proving the offline test fails when the service worker is disabled.

**Open items for Skylor:** review the Japanese strings; walk through `src/sw.ts` and
`src/i18n/index.ts` and explain them back; decide on the M2/M3 design questions (tsunami
"safe place" definition, offline address entry, which extra modules to own).

---

## 2026-10-09: Session 2, move to `congressionalappchallenge` repo

**AI generated**

- Planning: re-reviewed the brief, listed risks/ambiguities (including declining the
  brief's "ghostwriter" framing, since the student-owned modules stay student-written),
  and proposed the migration plan (approved by Skylor).
- Moved the M1 history from `skylorchan/2425` into this repo unchanged (same 4 commits).
- Changed the deploy base path from `/2425/` to `/congressionalappchallenge/` in
  `vite.config.ts`, `playwright.config.ts`, `tests/e2e/pwa.spec.ts`, `src/App.tsx`
  (comment), `README.md`, and `CLAUDE.md`.
- This log entry.

**Student wrote**

- Decisions: move the project to this repo, keep the git history, leave the old `2425`
  repo untouched for Skylor to archive.
- No application code this session.

**AI reviewed**

- Nothing (no student code this session).

**Verification run by AI:** lint, format check, typecheck, 20/20 unit tests, production
build, 4/4 Playwright tests (airplane-mode reload, offline language switch, manifest
scope at `/congressionalappchallenge/`).

**Open items for Skylor:** enable GitHub Pages (Settings → Pages → Source: GitHub
Actions); archive `skylorchan/2425`; plus the open items from Session 1.
