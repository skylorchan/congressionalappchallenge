import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../i18n/locales/en.json';
import ja from '../i18n/locales/ja.json';

/** A synchronous i18next instance with every locale loaded, for component tests. */
export async function setupTestI18n(lng = 'en') {
  await i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, ja: { translation: ja } },
    lng,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
  await i18n.changeLanguage(lng);
  return i18n;
}
