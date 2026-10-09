import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from '../../app/location';
import { Direction } from '../../components/Direction';
import { LocationPicker } from '../../components/LocationPicker';
import { Page } from '../../components/Page';
import { SafeText } from '../../components/SafeText';
import { SourceNote } from '../../components/SourceNote';
import { useAppData, useWalkGraph } from '../../data/appData';
import { useAnalysis } from '../zone/analysis';

const MapView = lazy(() => import('../../components/MapView'));

export function PlacesScreen() {
  const { t } = useTranslation();
  const { location, setLocation } = useLocation();
  // The map (a 1 MB library plus WebGL) waits until there's something to show or the
  // user asks for it, so the first screen stays fast on an old phone.
  const [mapOpened, setMapOpened] = useState(false);
  const showMap = mapOpened || !!location;
  const { data, error } = useAppData(showMap);
  const graph = useWalkGraph(!!location);
  const analysis = useAnalysis(data, location?.coord, 5, graph);

  return (
    <Page title={t('screens.places.title')}>
      <LocationPicker />
      {error && <p className="error-text">{t('data.loadError')}</p>}

      {analysis && (
        <section className="card" aria-labelledby="tsunami-safe">
          <h2 id="tsunami-safe">{t('places.tsunamiHeading')}</h2>
          {analysis.zone.status === 'safe' && <p>{t('places.alreadySafe')}</p>}
          {analysis.zone.status === 'no-data' && <p>{t('zone.noDataHelp')}</p>}
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
          <SafeText k="safety.tsunamiGoUp" />
          <p className="hint">{analysis.walking ? t('route.disclaimer') : t('route.loading')}</p>
        </section>
      )}

      {analysis && data && (
        <section aria-labelledby="refuges">
          <h2 id="refuges">{t('places.refugeHeading')}</h2>
          <SafeText k="safety.refugeNotOpen" />
          <ol className="place-list">
            {analysis.refuges.map(({ item, distance, bearing, route }, i) => (
              <li key={item.id} className="place">
                <span className="place-number" aria-hidden="true">
                  {i + 1}
                </span>
                <div>
                  <h3>{item.name}</h3>
                  <p className="place-address">
                    {item.address}, {item.place}
                  </p>
                  <p>
                    <Direction
                      distance={distance}
                      bearing={bearing}
                      route={route}
                      arrival={t('route.arrivePlace', { name: item.name })}
                    />
                  </p>
                  {(item.zone === 'tsunami' || item.zone === 'extreme') && (
                    <p className="badge badge-danger">
                      {t(
                        item.zone === 'tsunami'
                          ? 'places.refugeInTsunami'
                          : 'places.refugeInExtreme',
                      )}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <SourceNote source={data.manifest.refuges} />
        </section>
      )}

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
              label={t('map.placesLabel')}
              zones={data.zonesGeoJSON}
              user={location?.coord}
              routes={analysis?.refuges[0]?.route ? [analysis.refuges[0].route.coords] : []}
              places={(analysis?.refuges ?? []).map((r, i) => ({
                coord: r.item.coord,
                label: String(i + 1),
                inZone: r.item.zone === 'tsunami' || r.item.zone === 'extreme',
              }))}
              onPick={(p) => setLocation(p, 'map')}
            />
          </Suspense>
        )}
      </div>
    </Page>
  );
}
