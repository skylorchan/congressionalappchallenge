/**
 * How much to trust a cached alert snapshot, based on its age. Alerts can be issued or
 * upgraded within minutes, so even "recent" data is labelled with its age.
 */
export type Freshness = 'fresh' | 'aging' | 'stale';

export const FRESH_MS = 15 * 60_000;
export const STALE_MS = 2 * 60 * 60_000;

export function freshness(fetchedAt: number, now: number = Date.now()): Freshness {
  const age = Math.max(0, now - fetchedAt);
  if (age < FRESH_MS) return 'fresh';
  if (age < STALE_MS) return 'aging';
  return 'stale';
}
