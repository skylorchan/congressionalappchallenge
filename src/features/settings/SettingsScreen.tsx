import { useTranslation } from 'react-i18next';
import { useSettings, type TextSize } from '../../app/settings';
import { Page } from '../../components/Page';
import { LANGUAGES } from '../../i18n/languages';

const SIZES: TextSize[] = ['normal', 'large', 'xlarge'];

export function SettingsScreen() {
  const { t } = useTranslation();
  const { settings, change } = useSettings();
  return (
    <Page title={t('settings.title')}>
      <fieldset className="card">
        <legend>{t('settings.textSize')}</legend>
        {SIZES.map((size) => (
          <label key={size} className="check">
            <input
              type="radio"
              name="text-size"
              checked={settings.textSize === size}
              onChange={() => change({ textSize: size })}
            />
            <span className={`size-sample size-${size}`}>{t(`settings.size.${size}`)}</span>
          </label>
        ))}
      </fieldset>

      <div className="card">
        <label className="check">
          <input
            type="checkbox"
            checked={settings.highContrast}
            aria-describedby="highContrast-hint"
            onChange={(e) => change({ highContrast: e.target.checked })}
          />
          <strong>{t('settings.highContrast')}</strong>
        </label>
        <p className="hint" id="highContrast-hint">
          {t('settings.highContrastHint')}
        </p>
      </div>

      <div className="card">
        <label className="check">
          <input
            type="checkbox"
            checked={settings.kupuna}
            aria-describedby="kupuna-hint"
            onChange={(e) => change({ kupuna: e.target.checked })}
          />
          <strong>{t('settings.kupuna')}</strong>
        </label>
        <p className="hint" id="kupuna-hint">
          {t('settings.kupunaHint')}
        </p>
      </div>

      <section className="card" aria-labelledby="translations">
        <h2 id="translations">{t('settings.translationsHeading')}</h2>
        <p>{t('settings.translationsBody')}</p>
        <ul>
          {LANGUAGES.map((l) => (
            <li key={l.code}>
              <span lang={l.code}>{l.nativeName}</span>
              {l.coverage !== 'full' && (
                <span lang="en">
                  {' '}
                  ({l.coverage === 'partial' ? 'partly translated' : 'English for now'})
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="card" aria-labelledby="about">
        <h2 id="about">{t('settings.aboutHeading')}</h2>
        <p>{t('settings.aboutBody')}</p>
        <p className="hint">{t('settings.privacy')}</p>
      </section>
    </Page>
  );
}
