import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { Page } from '../../components/Page';
import { formatAge, formatDate, formatTime } from '../../lib/format';
import { decodeSnapshot, type SharedSnapshot } from './shareCodec';

/**
 * Opened from a QR code another phone showed. Displays the summary read-only, with a
 * clear warning: anyone can make a QR code, so this is never treated as official data
 * and never replaces the alerts this phone downloaded itself.
 */
export function SharedAlertsScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const [params] = useSearchParams();
  const code = params.get('d');
  const [state, setState] = useState<{
    snap: SharedSnapshot | null;
    failed: boolean;
    openedAt: number;
  }>({ snap: null, failed: false, openedAt: 0 });

  useEffect(() => {
    if (!code) return;
    let live = true;
    decodeSnapshot(code).then(
      (snap) => live && setState({ snap, failed: false, openedAt: Date.now() }),
      () => live && setState({ snap: null, failed: true, openedAt: Date.now() }),
    );
    return () => {
      live = false;
    };
  }, [code]);

  const { snap } = state;
  return (
    <Page title={t('share.receivedTitle')}>
      <div className="card card-warning">
        <p>
          <strong>{t('share.unverified')}</strong>
        </p>
      </div>
      {(!code || state.failed) && <p className="error-text">{t('share.invalid')}</p>}
      {snap && (
        <>
          <p>
            {t('share.downloadedBy', {
              age: formatAge(snap.fetchedAt, state.openedAt, lang),
              date: `${formatDate(snap.fetchedAt, lang)} ${formatTime(snap.fetchedAt, lang)}`,
            })}
          </p>
          {snap.alerts.length === 0 ? (
            <p className="card">{t('alerts.none')}</p>
          ) : (
            <ul className="alert-list">
              {snap.alerts.map((a, i) => (
                <li
                  key={i}
                  className={`alert alert-${a.severity.toLowerCase()}${a.tsunami ? ' alert-tsunami' : ''}`}
                >
                  <h2 className="alert-event" lang="en">
                    {a.event}
                  </h2>
                  <p className="alert-badges">
                    <span className={`badge badge-sev-${a.severity.toLowerCase()}`}>
                      {t(`alerts.severity.${a.severity}`)}
                    </span>
                    {a.oahu && <span className="badge badge-oahu">{t('alerts.oahu')}</span>}
                  </p>
                  {a.ends && (
                    <p className="alert-meta">
                      {t('alerts.until', {
                        time: `${formatDate(a.ends, lang)} ${formatTime(Date.parse(a.ends), lang)}`,
                      })}
                    </p>
                  )}
                  <p className="alert-area" lang="en">
                    {a.areaDesc}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <p>
        <Link to="/alerts">{t('share.backToAlerts')}</Link>
      </p>
    </Page>
  );
}
