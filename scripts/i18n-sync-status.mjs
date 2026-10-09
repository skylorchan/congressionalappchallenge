// Adds a status entry for every translated key that doesn't have one yet, marked
// "machine". Run after adding or changing strings: `npm run i18n:sync`.
// A human reviewer then flips entries to "reviewed" (with their name and the date).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('../src/i18n/', import.meta.url).pathname;
const localesDir = join(dir, 'locales');
const statusPath = join(dir, 'translation-status.json');

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

const status = JSON.parse(readFileSync(statusPath, 'utf8'));
let added = 0;
for (const file of readdirSync(localesDir)) {
  const lang = file.replace(/\.json$/, '');
  if (lang === 'en') continue;
  const keys = flatten(JSON.parse(readFileSync(join(localesDir, file), 'utf8')));
  status[lang] ??= {};
  for (const key of keys) {
    if (!status[lang][key]) {
      status[lang][key] = { status: 'machine' };
      added++;
    }
  }
  // Drop entries for keys that no longer exist.
  for (const key of Object.keys(status[lang])) if (!keys.includes(key)) delete status[lang][key];
}
writeFileSync(statusPath, JSON.stringify(status, null, 2) + '\n');
console.log(`translation-status.json: added ${added} entries`);
