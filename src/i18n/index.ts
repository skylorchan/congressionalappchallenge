import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import { contentLanguage, DEFAULT_LANGUAGE, detectLanguage, type LanguageCode } from './languages';

const STORAGE_KEY = 'kokua.language';

// English is bundled into the main JS so it is always available as the fallback.
// Every other language is its own small chunk, loaded only when chosen. The service
// worker precaches those chunks, so switching languages still works offline.
const loaders = import.meta.glob<{ default: Record<string, unknown> }>([
  './locales/*.json',
  '!./locales/en.json',
]);

async function ensureLoaded(lang: LanguageCode): Promise<void> {
  if (i18n.hasResourceBundle(lang, 'translation')) return;
  const load = loaders[`./locales/${lang}.json`];
  if (!load) throw new Error(`No translations for "${lang}"`);
  const mod = await load();
  i18n.addResourceBundle(lang, 'translation', mod.default);
}

function readSaved(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // storage can be blocked (private mode); just don't remember
  }
}

export async function setLanguage(lang: LanguageCode): Promise<void> {
  try {
    await ensureLoaded(lang);
  } catch (err) {
    // A missing chunk (e.g. never cached and now offline) must not break the app.
    console.warn('Could not load language, staying on current one', err);
    return;
  }
  await i18n.changeLanguage(lang);
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
}

export async function initI18n(): Promise<typeof i18n> {
  // Keep <html lang> in sync so screen readers pronounce text in the right language.
  i18n.on('languageChanged', (lng) => {
    document.documentElement.lang = contentLanguage(lng);
  });
  await i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: { escapeValue: false }, // React already escapes
  });
  const start = detectLanguage(readSaved(), navigator.languages ?? []);
  if (start !== DEFAULT_LANGUAGE) await setLanguage(start);
  document.documentElement.lang = contentLanguage(i18n.language);
  return i18n;
}

export default i18n;
