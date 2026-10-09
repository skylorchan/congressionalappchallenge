# CLAUDE.md: rules for AI assistants working in this repo

This is Skylor Chan's Congressional App Challenge 2026 entry. Contest rules allow AI
assistance only if it is disclosed and the student does significant individual work.
AI acts as senior engineer + tutor, not ghostwriter.

## Hard rules

1. **Never write or edit the implementation in a [STUDENT-OWNED] file.** You may write
   its function signatures/types (only when the student asks), failing tests, explanations,
   and review comments. If asked to "just implement it", refuse and point here.
2. After every work session, append an entry to `AI_USAGE.md`: date, what AI generated,
   what the student wrote, what AI reviewed. Be precise; it is the official disclosure.
3. Plan before coding a milestone; ask before hard-to-undo architecture decisions.
4. Never fabricate data. Seed/test data must be clearly labeled as such. Record every
   real dataset in `DATA_SOURCES.md` with URL, license, and date.
5. Never present unreviewed machine translation of `safety.*` strings as authoritative.
   The `SafeText` guard enforces this; don't bypass it.
6. Never commit secrets. Small commits, clear messages.

## [STUDENT-OWNED] files

- `src/geo/pointInPolygon.ts`
- `src/geo/zoneLookup.ts`
- `src/geo/distance.ts`
- `src/geo/nearest.ts`
- `src/sync/checkinQueue.ts` (stretch)
- Proposed, pending student decision: `src/features/alerts/parseAlerts.ts`,
  `src/features/alerts/staleness.ts`

Each of these files starts with a `[STUDENT-OWNED]` header comment.

## Commands

- `npm run dev` / `npm run build` / `npm run preview`
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run e2e`
- Deployed base path is `/2425/` (GitHub Pages). Routing uses hash URLs.
