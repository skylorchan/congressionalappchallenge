import { useTranslation } from 'react-i18next';
import { Page } from '../../components/Page';
import { SafeText } from '../../components/SafeText';

export function ZoneScreen() {
  const { t } = useTranslation();
  return (
    <Page title={t('screens.zone.title')}>
      <p>{t('screens.zone.body')}</p>
      <section className="card card-warning" aria-labelledby="natural-warning">
        <h2 id="natural-warning">{t('screens.zone.naturalWarningHeading')}</h2>
        <SafeText k="safety.naturalWarning" />
        <p className="source">
          <a href="https://www.weather.gov/safety/tsunami" target="_blank" rel="noreferrer">
            {t('screens.zone.naturalWarningSource')}
          </a>
        </p>
      </section>
    </Page>
  );
}
