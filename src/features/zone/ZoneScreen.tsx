import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useLocation } from '../../app/location';
import { Direction } from '../../components/Direction';
import { LocationPicker } from '../../components/LocationPicker';
import { Page } from '../../components/Page';
import { SafeText } from '../../components/SafeText';
import { SourceNote } from '../../components/SourceNote';
import { useAppData, useWalkGraph } from '../../data/appData';
import type { ZoneStatus } from '../../geo/zoneLookup';
import { useAnalysis } from './analysis';

const MapView = lazy(() => import('../../components/MapView'));

const ICON: Record<ZoneStatus, string> = {
  tsunami: '🌊',
  extreme: '⚠️',
  safe: '✅',
  'no-data': '❔',
};

export function ZoneScreen() {
  const { t } = useTranslation();
  const { location, setLocation } = useLocation();
  // The map (a 1 MB library plus WebGL) waits until there's something to show or the
  // user asks for it, so the first screen stays fast on an old phone.
  const [mapOpened, setMapOpened] = useState(false);
  const showMap = mapOpened || !!location;
  const { data, error } = useAppData(showMap);
  const graph = useWalkGraph(!!location);
  const analysis = useAnalysis(data, location?.coord, 5, graph);
  const status = analysis?.zone.status;

  return (
    <Page title={t('screens.zone.title')}>
      <LocationPicker />

      {error && <p className="error-text">{t('data.loadError')}</p>}

      {analysis && status && (
        <section
          className={`card result result-${status}`}
          aria-labelledby="zone-result"
          aria-live="polite"
        >
          <h2 id="zone-result">
            <span aria-hidden="true">{ICON[status]} </span>
            {t(`zone.status.${status}`)}
          </h2>
          {status === 'tsunami' && <SafeText k="safety.tsunamiZoneAction" />}
          {status === 'extreme' && <SafeText k="safety.extremeZoneAction" />}
          {status === 'safe' && <SafeText k="safety.safeZoneAction" />}
          {status === 'no-data' && <p>{t('zone.noDataHelp')}</p>}

          {analysis.exitTsunami && (
            <p>
              <strong>{t('zone.exitTsunami')}</strong>
              <br />
              <Direction {...analysis.exitTsunami} arrival={t('route.arriveSafe')} />
            </p>
          )}
          {analysis.exitExtreme && (
            <p>
              <strong>{t('zone.exitExtreme')}</strong>
              <br />
              <Direction {...analysis.exitExtreme} arrival={t('route.arriveSafe')} />
            </p>
          )}
          {(analysis.exitTsunami || analysis.exitExtreme) && (
            <p className="hint">{analysis.walking ? t('route.disclaimer') : t('route.loading')}</p>
          )}
          {status !== 'no-data' && (
            <p>
              <Link to="/places">{t('zone.seePlaces')}</Link>
            </p>
          )}
        </section>
      )}

      <section className="card card-warning" aria-labelledby="natural-warning">
        <h2 id="natural-warning">{t('screens.zone.naturalWarningHeading')}</h2>
        <SafeText k="safety.naturalWarning" />
        <p className="source">
          <a href="https://www.weather.gov/safety/tsunami" target="_blank" rel="noreferrer">
            {t('screens.zone.naturalWarningSource')}
          </a>
        </p>
      </section>

      <div className="map-slot">
        {!showMap && (
          <button
            type="button"
            className="button-secondary map-open"
            onClick={() => setMapOpened(true)}
          >
            <span aria-hidden="true">🗺️ </span>
            {t('map.show')}
          </button>
        )}
        {data && showMap && (
          <Suspense fallback={<div className="map map-loading">{t('map.loading')}</div>}>
            <MapView
              label={t('map.zoneLabel')}
              zones={data.zonesGeoJSON}
              user={location?.coord}
              exits={[
                ...(analysis?.exitTsunami
                  ? [
                      {
                        point: analysis.exitTsunami.point,
                        kind: 'tsunami' as const,
                        line: analysis.exitTsunami.route?.coords,
                      },
                    ]
                  : []),
                ...(analysis?.exitExtreme
                  ? [
                      {
                        point: analysis.exitExtreme.point,
                        kind: 'extreme' as const,
                        line: analysis.exitExtreme.route?.coords,
                      },
                    ]
                  : []),
              ]}
              onPick={(p) => setLocation(p, 'map')}
            />
          </Suspense>
        )}
      </div>
      {data && <SourceNote source={data.manifest.zones} />}
      <p className="hint">{t('zone.disclaimer')}</p>
    </Page>
  );
}
