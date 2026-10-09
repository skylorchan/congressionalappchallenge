import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useLocation } from '../../app/location';
import { useSettings } from '../../app/settings';
import { Direction } from '../../components/Direction';
import { Page } from '../../components/Page';
import { SafeText } from '../../components/SafeText';
import { useAppData } from '../../data/appData';
import { useAnalysis } from '../zone/analysis';

/**
 * Kūpuna mode: everything on one screen, in very large type, with as few choices as
 * possible. One button checks where you are; the answer and the way out appear right
 * under it. No map, no tabs.
 */
export function KupunaScreen() {
  const { t } = useTranslation();
  const { change } = useSettings();
  const { data } = useAppData();
  const { location, locate, gps } = useLocation();
  const analysis = useAnalysis(data, location?.coord, 1);
  const status = analysis?.zone.status;

  return (
    <Page title={t('kupuna.title')}>
      <div className="kupuna">
        <button type="button" className="giant" onClick={locate} disabled={gps === 'locating'}>
          <span aria-hidden="true">📍</span>
          {gps === 'locating' ? t('location.locating') : t('kupuna.checkHere')}
        </button>
        {gps !== 'idle' && gps !== 'locating' && (
          <p className="error-text" role="status">
            {t(`location.error.${gps}`)}
          </p>
        )}

        {status && (
          <section className={`card result result-${status}`} aria-live="polite">
            <h2>{t(`kupuna.status.${status}`)}</h2>
            {status === 'tsunami' && <SafeText k="safety.tsunamiZoneAction" />}
            {status === 'extreme' && <SafeText k="safety.extremeZoneAction" />}
            {status === 'safe' && <SafeText k="safety.safeZoneAction" />}
            {analysis?.exitTsunami && (
              <p>
                <strong>{t('kupuna.goThisWay')}</strong>
                <br />
                <Direction {...analysis.exitTsunami} />
              </p>
            )}
          </section>
        )}

        <a className="giant giant-danger" href="tel:911">
          <span aria-hidden="true">📞</span>
          {t('kupuna.call911')}
        </a>
        <Link className="giant" to="/plan">
          <span aria-hidden="true">💬</span>
          {t('kupuna.imSafe')}
        </Link>
        <Link className="giant" to="/alerts">
          <span aria-hidden="true">⚠️</span>
          {t('kupuna.alerts')}
        </Link>
        <button
          type="button"
          className="giant giant-quiet"
          onClick={() => change({ kupuna: false })}
        >
          {t('kupuna.exit')}
        </button>
      </div>
    </Page>
  );
}
