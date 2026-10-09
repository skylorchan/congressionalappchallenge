# AI usage disclosure

Kōkua was built by Claude Code (Anthropic), an AI coding agent, at Skylor Chan's
direction. Every work session is logged below.

**Summary:** the AI wrote all of the code, tests, data pipeline, translations and
documentation. Skylor wrote the project brief and requirements and made the product
decisions recorded below. Sessions 1 and 2 followed a "student writes the core
algorithms" rule because the project was then planned as a Congressional App Challenge
entry. In Session 3 Skylor said it is not a submission and asked the AI to build
everything, so the AI also wrote the geo algorithms that had been reserved for him. No
code in this repository was written by a human.

Legend: **AI generated** = code/text written by the AI. **Skylor** = what Skylor wrote or
decided.

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

---

## 2026-10-09: Session 3, the whole app (AI-built)

**Skylor**

- Said the project is not a Congressional App Challenge submission and asked the AI to
  drop the student-owned split and build the entire app.

**AI generated (everything below)**

- Rules: rewrote `CLAUDE.md` and this file's header to say the AI builds everything.
- Data pipeline: `.github/workflows/fetch-data.yml` and `scripts/data/fetch-raw.mjs`
  (downloads on a GitHub runner because the dev container can't reach the data hosts),
  `scripts/data/build.mjs`. Found and evaluated the shelter sources listed in
  `DATA_SOURCES.md`; chose the Honolulu DEM hurricane refuge layer.
- Geo: `src/geo/*` (ray-casting point-in-polygon with holes and boundary handling, zone
  index and lookup, haversine distance, bearing, compass points, nearest points, nearest
  exit to safe ground) and their tests, including tests against the real Oʻahu zones.
- App: offline map (`MapView`, PMTiles, service worker range handling), Zone, Safe
  places, Alerts (NWS fetch, Dexie cache, staleness, share-by-QR/SMS link), Family plan
  (autosave, print, QR), "I'm safe" check-in queue, Settings, kūpuna mode, layout and
  styles.
- Translations: Japanese, Korean, Chinese (Traditional), Vietnamese, Tagalog and Ilocano
  in full, and about 34 ʻŌlelo Hawaiʻi labels, all **machine translations by the AI,
  flagged `machine`, unreviewed**. Chuukese and Marshallese were deliberately left
  untranslated (shown in English with a notice) because the AI could not produce
  trustworthy text.
- Tests: unit tests (86 total), Playwright airplane-mode, kūpuna, share-link,
  accessibility (axe-core) and reflow tests (11 total).
- Docs: `README.md`, `DATA_SOURCES.md`, screenshots.

**Bugs the AI found in its own work while testing** (and fixed)

- Nearest exit pointed into the ocean (measured to the shoreline edge of the zone).
- The map's web worker and font URLs broke once bundled.
- The local preview server corrupted basemap byte ranges (gzip on 206 responses).
- Picking a language with no translations snapped the picker back to English.
- Faded "may have ended" alerts failed contrast; the header overflowed at 320 px in
  kūpuna mode (the first version of the reflow test missed it until it measured
  `clientWidth`).
- Loading the map up front made Lighthouse performance 54; it now loads on demand (96).

**Verification run by the AI:** lint, format, typecheck, 86/86 unit tests, 11/11
Playwright tests, Lighthouse (mobile) 96/100/100/100.

**Not done / needs a human:** native-speaker review of every translation; testing on a
real low-end Android phone; making the repo public (or another host) so GitHub Pages can
deploy.
