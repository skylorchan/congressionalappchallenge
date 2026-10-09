import 'i18next';
import type en from './locales/en.json';

// Makes t('some.key') a compile error if the key doesn't exist in English.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof en };
  }
}
