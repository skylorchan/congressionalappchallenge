/**
 * Languages the UI can be shown in.
 *
 * coverage:
 *  - full:    every string translated (machine drafts flagged for review)
 *  - partial: short labels only; everything else falls back to English
 *  - planned: listed because Hawaiʻi needs it, but no trustworthy translation exists
 *             yet, so the UI stays in English and says so
 *
 * Chinese is Traditional (zh-Hant), which Hawaiʻi agencies use.
 */
export const LANGUAGES = [
  { code: 'en', nativeName: 'English', englishName: 'English', coverage: 'full' },
  { code: 'haw', nativeName: 'ʻŌlelo Hawaiʻi', englishName: 'Hawaiian', coverage: 'partial' },
  { code: 'ilo', nativeName: 'Ilokano', englishName: 'Ilocano', coverage: 'full' },
  { code: 'tl', nativeName: 'Tagalog', englishName: 'Tagalog', coverage: 'full' },
  { code: 'ja', nativeName: '日本語', englishName: 'Japanese', coverage: 'full' },
  { code: 'chk', nativeName: 'Chuuk', englishName: 'Chuukese', coverage: 'planned' },
  { code: 'mh', nativeName: 'Kajin M̧ajeļ', englishName: 'Marshallese', coverage: 'planned' },
  { code: 'ko', nativeName: '한국어', englishName: 'Korean', coverage: 'full' },
  { code: 'zh', nativeName: '中文（繁體）', englishName: 'Chinese', coverage: 'full' },
  { code: 'vi', nativeName: 'Tiếng Việt', englishName: 'Vietnamese', coverage: 'full' },
] as const satisfies readonly {
  code: string;
  nativeName: string;
  englishName: string;
  coverage: 'full' | 'partial' | 'planned';
}[];

export type Language = (typeof LANGUAGES)[number];
export type LanguageCode = Language['code'];
export type Coverage = Language['coverage'];
export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export function isSupportedLanguage(code: string): code is LanguageCode {
  return LANGUAGES.some((l) => l.code === code);
}

export function languageInfo(code: string): Language | undefined {
  return LANGUAGES.find((l) => l.code === code);
}

/**
 * The language the text on screen is actually in, for <html lang>. For a "planned"
 * language that's English, so screen readers use an English voice for English text.
 */
export function contentLanguage(code: string): string {
  return languageInfo(code)?.coverage === 'planned' ? DEFAULT_LANGUAGE : code;
}

/**
 * Pick the starting language: the user's saved choice wins, then the first browser
 * language we support (matching "ja-JP" to "ja"), then English.
 */
export function detectLanguage(
  saved: string | null,
  browserLanguages: readonly string[],
): LanguageCode {
  if (saved && isSupportedLanguage(saved)) return saved;
  for (const tag of browserLanguages) {
    const base = tag.toLowerCase().split('-')[0] ?? '';
    if (isSupportedLanguage(base)) return base;
  }
  return DEFAULT_LANGUAGE;
}
