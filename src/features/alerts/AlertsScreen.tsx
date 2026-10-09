import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Page } from '../../components/Page';
import { SafeText } from '../../components/SafeText';
import { formatAge, formatDate, formatTime } from '../../lib/format';
import { useAlerts } from './alertStore';
import { hasEnded, type Alert } from './parseAlerts';
import { freshness } from './staleness';
import { ShareAlerts } from './ShareAlerts';

function AlertCard({ alert, now }: { alert: Alert; now: number }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const ended = hasEnded(alert, now);
  const sev = alert.severity.toLowerCase();
  return (
    <li
      className={`alert alert-${sev}${alert.tsunami ? ' alert-tsunami' : ''}${ended ? ' alert-ended' : ''}`}
    >
      <h2 className="alert-event" lang="en">
        {alert.event}
      </h2>
      <p className="alert-badges">
        <span className={`badge badge-sev-${sev}`}>{t(`alerts.severity.${alert.severity}`)}</span>
        {alert.oahu && <span className="badge badge-oahu">{t('alerts.oahu')}</span>}
        {ended && <span className="badge badge-ended">{t('alerts.ended')}</span>}
      </p>
      <p className="alert-meta">
        {alert.ends &&
          t('alerts.until', {
            time: `${formatDate(alert.ends, lang)} ${formatTime(Date.parse(alert.ends), lang)}`,
          })}
      </p>
      <p className="alert-area" lang="en">
        {alert.areaDesc}
      </p>
      <details>
        <summary>{t('alerts.details')}</summary>
        <div lang="en" className="alert-text">
          {alert.headline && <p>{alert.headline}</p>}
          <p>{alert.description}</p>
          {alert.instruction && (
            <>
              <h3>{t('alerts.whatToDo')}</h3>
              <p>{alert.instruction}</p>
            </>
          )}
          <p className="source">
            {alert.senderName} · {formatDate(alert.sent, lang)}{' '}
            {formatTime(Date.parse(alert.sent), lang)}
          </p>
        </div>
      </details>
    </li>
  );
}

export function AlertsScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const { snapshot, loaded, refreshing, error, refresh, online } = useAlerts();
  // Ages are computed from render time; the list re-renders on every refresh.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const fresh = snapshot ? freshness(snapshot.fetchedAt, now) : null;
  const alerts = snapshot?.alerts ?? [];
  const hasTsunami = alerts.some((a) => a.tsunami && !hasEnded(a, now));

  return (
    <Page title={t('screens.alerts.title')}>
      <div className={`card freshness freshness-${fresh ?? 'none'}`} role="status">
        {snapshot ? (
          <p>
            <strong>
              {t('alerts.lastUpdated', { age: formatAge(snapshot.fetchedAt, now, lang) })}
            </strong>{' '}
            ({formatDate(snapshot.fetchedAt, lang)} {formatTime(snapshot.fetchedAt, lang)})
            {fresh === 'aging' && <> {t('alerts.aging')}</>}
            {fresh === 'stale' && <> {t('alerts.stale')}</>}
          </p>
        ) : (
          loaded && <p>{online ? t('alerts.loading') : t('alerts.neverOffline')}</p>
        )}
        {error && <p className="error-text">{t('alerts.fetchError')}</p>}
        <button type="button" onClick={() => void refresh()} disabled={!online || refreshing}>
          {refreshing
            ? t('alerts.refreshing')
            : online
              ? t('alerts.refresh')
              : t('alerts.refreshOffline')}
        </button>
      </div>

      {hasTsunami && (
        <section className="card result result-tsunami" aria-labelledby="tsunami-alert">
          <h2 id="tsunami-alert">{t('alerts.tsunamiHeading')}</h2>
          <SafeText k="safety.tsunamiAlertAction" />
          <p>
            <Link to="/">{t('alerts.checkZone')}</Link>
          </p>
        </section>
      )}

      {snapshot && alerts.length === 0 && <p className="card">{t('alerts.none')}</p>}

      {alerts.length > 0 && (
        <>
          {lang !== 'en' && <p className="hint">{t('alerts.englishOnly')}</p>}
          <ul className="alert-list">
            {alerts.map((a) => (
              <AlertCard key={a.id} alert={a} now={now} />
            ))}
          </ul>
        </>
      )}

      {snapshot && <ShareAlerts snapshot={snapshot} />}

      <p className="source">
        {t('alerts.source')}{' '}
        <a href="https://www.weather.gov/hfo/" target="_blank" rel="noreferrer">
          weather.gov/hfo
        </a>{' '}
        ·{' '}
        <a href="https://www.tsunami.gov/" target="_blank" rel="noreferrer">
          tsunami.gov
        </a>
      </p>
      <p className="hint">{t('alerts.officialChannels')}</p>
    </Page>
  );
}
