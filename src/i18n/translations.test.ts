// Guards for the translation files. These are what stop an unflagged machine
// translation, or a half-translated language, from reaching users.
import { describe, expect, it } from 'vitest';
import status from './translation-status.json';

type Json = { [k: string]: string | Json };
type Entry = { status: string; by?: string; date?: string };

// Loads every locale file, so a newly added language is checked automatically.
const files = import.meta.glob<Json>('./locales/*.json', { eager: true, import: 'default' });
const locales: Record<string, Json> = Object.fromEntries(
  Object.entries(files).map(([path, json]) => [path.replace(/^.*\/|\.json$/g, ''), json]),
);

function flatten(obj: Json, prefix = ''): Record<string, string> {
  return Object.fromEntries(
    Object.entries(obj).flatMap(([k, v]) =>
      typeof v === 'string' ? [[prefix + k, v]] : Object.entries(flatten(v, `${prefix}${k}.`)),
    ),
  );
}

const en = flatten(locales.en!);
const others = Object.keys(locales).filter((l) => l !== 'en');
const statusTable = status as Record<string, Record<string, Entry>>;

describe('translation files', () => {
  it('has English plus at least one other language', () => {
    expect(locales.en).toBeDefined();
    expect(others.length).toBeGreaterThan(0);
  });

  it.each(others)('%s has exactly the same keys as English', (lang) => {
    expect(Object.keys(flatten(locales[lang]!)).sort()).toEqual(Object.keys(en).sort());
  });

  it.each(others)('%s has no empty strings', (lang) => {
    const empty = Object.entries(flatten(locales[lang]!)).filter(([, v]) => v.trim() === '');
    expect(empty).toEqual([]);
  });

  it.each(others)('every %s key is flagged in translation-status.json', (lang) => {
    // Every non-English string must say whether it is machine output or human
    // reviewed. Run `npm run i18n:sync` to add missing entries as "machine".
    const flagged = Object.keys(statusTable[lang] ?? {});
    const missing = Object.keys(en).filter((k) => !flagged.includes(k));
    expect(missing).toEqual([]);
  });

  it('status entries are valid and point at real keys', () => {
    for (const [lang, entries] of Object.entries(statusTable)) {
      expect(others).toContain(lang);
      for (const [key, entry] of Object.entries(entries)) {
        expect(en, `${lang}: ${key} is not a real key`).toHaveProperty([key]);
        expect(['machine', 'reviewed']).toContain(entry.status);
        if (entry.status === 'reviewed') {
          // A review has to be traceable to a person and a date.
          expect(entry.by, `${lang}: ${key} reviewed without "by"`).toBeTruthy();
          expect(entry.date, `${lang}: ${key} reviewed without "date"`).toMatch(
            /^\d{4}-\d{2}-\d{2}$/,
          );
        }
      }
    }
  });

  it('keeps all safety-critical text under the safety.* namespace', () => {
    expect(Object.keys(en).some((k) => k.startsWith('safety.'))).toBe(true);
  });
});
