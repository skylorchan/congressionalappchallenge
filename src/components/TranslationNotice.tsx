import { useTranslation } from 'react-i18next';
import { languageInfo } from '../i18n/languages';

/**
 * For languages that aren't fully translated, says so in English (the language the
 * missing text falls back to), plus the language's own name so it's recognisable.
 */
export function TranslationNotice() {
  const { i18n } = useTranslation();
  const info = languageInfo(i18n.language);
  if (!info || info.coverage === 'full') return null;
  return (
    <p className="banner banner-info translation-notice" lang="en">
      {info.coverage === 'planned'
        ? `A ${info.englishName} translation of Kōkua isn't ready yet, so it is shown in English. If you speak ${info.englishName} and can help translate, please get in touch.`
        : `Kōkua is only partly translated into ${info.englishName} so far. Untranslated parts are shown in English.`}{' '}
      <span lang={info.code}>({info.nativeName})</span>
    </p>
  );
}
