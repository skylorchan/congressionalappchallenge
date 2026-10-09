import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from '../../app/location';
import { Direction } from '../../components/Direction';
import { LocationPicker } from '../../components/LocationPicker';
import { Page } from '../../components/Page';
import { SafeText } from '../../components/SafeText';
import { SourceNote } from '../../components/SourceNote';
import { useAppData } from '../../data/appData';
import { useAnalysis } from '../zone/analysis';

const MapView = lazy(() => import('../../components/MapView'));

export function PlacesScreen() {
  const { t } = useTranslation();
  const { data, error } = useAppData();
  const { location, setLocation } = useLocation();
  const analysis = useAnalysis(data, location?.coord, 5);

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
              <Direction {...analysis.exitTsunami} />
            </p>
          )}
          {analysis.exitExtreme && (
            <p>
              <strong>{t('zone.exitExtreme')}</strong>
              <br />
              <Direction {...analysis.exitExtreme} />
            </p>
          )}
          <SafeText k="safety.tsunamiGoUp" />
        </section>
      )}

      {analysis && data && (
        <section aria-labelledby="refuges">
          <h2 id="refuges">{t('places.refugeHeading')}</h2>
          <SafeText k="safety.refugeNotOpen" />
          <ol className="place-list">
            {analysis.refuges.map(({ item, distance, bearing }, i) => (
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
                    <Direction distance={distance} bearing={bearing} />
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

      {data && (
        <Suspense fallback={<div className="map map-loading">{t('map.loading')}</div>}>
          <MapView
            label={t('map.placesLabel')}
            zones={data.zonesGeoJSON}
            user={location?.coord}
            places={(analysis?.refuges ?? []).map((r, i) => ({
              coord: r.item.coord,
              label: String(i + 1),
              inZone: r.item.zone === 'tsunami' || r.item.zone === 'extreme',
            }))}
            onPick={(p) => setLocation(p, 'map')}
          />
        </Suspense>
      )}
    </Page>
  );
}
