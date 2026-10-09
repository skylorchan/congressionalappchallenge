import { useTranslation } from 'react-i18next';
import { setLanguage } from '../i18n';
import { LANGUAGES, isSupportedLanguage } from '../i18n/languages';

export function LanguagePicker() {
  const { t, i18n } = useTranslation();
  return (
    <label className="language-picker">
      <span>{t('language.label')}</span>
      <select
        value={i18n.resolvedLanguage}
        onChange={(e) => {
          if (isSupportedLanguage(e.target.value)) void setLanguage(e.target.value);
        }}
      >
        {/* Each name is written in its own language and tagged so screen readers read it correctly. */}
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}
