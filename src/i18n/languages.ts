// Languages the UI can be shown in. M1 ships two; the rest are added in M5.
export const LANGUAGES = [
  { code: 'en', nativeName: 'English' },
  { code: 'ja', nativeName: '日本語' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];
export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export function isSupportedLanguage(code: string): code is LanguageCode {
  return LANGUAGES.some((l) => l.code === code);
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
