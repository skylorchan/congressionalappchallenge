import status from './translation-status.json';
import type en from './locales/en.json';

export type SafetyKey = `safety.${keyof (typeof en)['safety']}`;

type Entry = { status: 'machine' | 'reviewed'; by?: string; date?: string };
const table = status as Record<string, Record<string, Entry | undefined> | undefined>;

/**
 * True if a native speaker has reviewed this key's translation. English is the source
 * language, so it always counts as reviewed.
 */
export function isReviewed(lang: string, key: string): boolean {
  if (lang === 'en') return true;
  return table[lang]?.[key]?.status === 'reviewed';
}
