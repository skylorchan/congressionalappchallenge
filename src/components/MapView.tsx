import { layers, namedFlavor } from '@protomaps/basemaps';
import type { Feature, FeatureCollection, GeoJsonProperties } from 'geojson';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, LngLatBoundsLike, StyleSpecification } from 'maplibre-gl';
// MapLibre parses tiles in a web worker loaded from a separate file. By default it looks
// for that file next to its own module, which doesn't exist once Vite has bundled it,
// so emit the worker as its own asset (precached like everything else) and point at it.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LngLat } from '../geo/types';
import type { ZoneCollection } from '../geo/zoneLookup';

/** A way out: where it ends, and (if walking) the route's line along the streets. */
export type MapExit = { point: LngLat; kind: 'tsunami' | 'extreme'; line?: LngLat[] };
export type MapPlace = { coord: LngLat; label: string; inZone: boolean };

type Props = {
  zones: ZoneCollection;
  user?: LngLat | null;
  exits?: MapExit[];
  places?: MapPlace[];
  /** Extra walking routes to draw (e.g. to the nearest refuge). */
  routes?: LngLat[][];
  /** Called with the tapped point. Omit to make the map view-only. */
  onPick?: (point: LngLat) => void;
  /** Accessible name for the map region. */
  label: string;
};

const OAHU_CENTER: LngLat = [-157.97, 21.48];
const MAX_BOUNDS: LngLatBoundsLike = [
  [-158.75, 20.95],
  [-157.2, 22.0],
];

const ZONE_COLORS = { tsunami: '#d7301f', extreme: '#f59e42' } as const;
const EXIT_COLOR = '#0b6b3a';
const PLACE_COLOR = '#0b4f6c';
const USER_COLOR = '#1d5fd6';

let protocolAdded = false;

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Absolute URL under the app's base path. Template tokens like {range} stay unescaped. */
function absolute(path: string) {
  return new URL(import.meta.env.BASE_URL, window.location.href).href + path;
}

function buildStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: absolute('map/fonts/{fontstack}/{range}.pbf'),
    sprite: absolute('map/sprites/light'),
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles://${absolute('map/oahu.pmtiles')}`,
        attribution:
          '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    },
    // Map labels stay in English/Hawaiian place names: those are what road signs say.
    layers: layers('protomaps', namedFlavor('light'), { lang: 'en' }),
  };
}

type FC = FeatureCollection;
const fc = (features: Feature[]): FC => ({ type: 'FeatureCollection', features });
const point = (coord: LngLat, properties: GeoJsonProperties = {}): Feature => ({
  type: 'Feature',
  properties,
  geometry: { type: 'Point', coordinates: [...coord] },
});

function overlayData(
  user: LngLat | null | undefined,
  exits: MapExit[],
  places: MapPlace[],
  routes: LngLat[][],
) {
  const line = (coords: LngLat[], kind: string): Feature => ({
    type: 'Feature',
    properties: { kind },
    geometry: { type: 'LineString', coordinates: coords.map((c) => [...c]) },
  });
  return {
    user: fc(user ? [point(user)] : []),
    exits: fc([
      ...exits.map((e) => point(e.point, { kind: e.kind })),
      // The walking route if there is one, otherwise a straight line from the user.
      ...exits.flatMap((e) =>
        e.line ? [line(e.line, e.kind)] : user ? [line([user, e.point], e.kind)] : [],
      ),
      ...routes.map((r) => line(r, 'refuge')),
    ]),
    places: fc(places.map((p) => point(p.coord, { label: p.label, inZone: p.inZone }))),
  };
}

/**
 * Offline map of Oʻahu: the basemap comes from a local PMTiles file, zones from the
 * bundled GeoJSON. Everything shown here is also given as text on the page, so the map
 * is a visual aid, never the only way to get the information.
 */
/** Re-creates the map when the language changes, so its built-in hints follow along. */
export default function MapView(props: Props) {
  const { i18n } = useTranslation();
  return <MapViewInner key={i18n.language} {...props} />;
}

function MapViewInner({ zones, user, exits = [], places = [], routes = [], onPick, label }: Props) {
  const { t } = useTranslation();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  // No WebGL (very old phone, or disabled): skip the map; the text above still works.
  const [failed, setFailed] = useState(() => !hasWebGL());
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  // Create the map once.
  useEffect(() => {
    if (!container.current || failed) return;
    if (!protocolAdded) {
      maplibregl.setWorkerUrl(workerUrl);
      maplibregl.addProtocol('pmtiles', new Protocol().tile);
      protocolAdded = true;
    }
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: container.current,
        style: buildStyle(),
        center: [...OAHU_CENTER],
        zoom: 9,
        minZoom: 8,
        maxZoom: 18,
        maxBounds: MAX_BOUNDS,
        attributionControl: { compact: true },
        // One finger scrolls the page; two fingers move the map. Stops the map from
        // trapping people who are just trying to scroll down to the text.
        cooperativeGestures: true,
        locale: {
          'CooperativeGesturesHandler.WindowsHelpText': t('map.gestureDesktop'),
          'CooperativeGesturesHandler.MacHelpText': t('map.gestureDesktop'),
          'CooperativeGesturesHandler.MobileHelpText': t('map.gestureMobile'),
        },
      });
    } catch {
      queueMicrotask(() => setFailed(true)); // WebGL present but unusable
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      map.addSource('zones', { type: 'geojson', data: zones as unknown as FC });
      map.addLayer({
        id: 'zones-fill',
        type: 'fill',
        source: 'zones',
        filter: ['!=', ['get', 'kind'], 'safe'],
        paint: {
          'fill-color': [
            'match',
            ['get', 'kind'],
            'tsunami',
            ZONE_COLORS.tsunami,
            ZONE_COLORS.extreme,
          ],
          'fill-opacity': 0.35,
        },
      });
      map.addLayer({
        id: 'zones-line',
        type: 'line',
        source: 'zones',
        filter: ['!=', ['get', 'kind'], 'safe'],
        paint: {
          'line-color': [
            'match',
            ['get', 'kind'],
            'tsunami',
            ZONE_COLORS.tsunami,
            ZONE_COLORS.extreme,
          ],
          'line-width': 1,
        },
      });
      const empty = fc([]);
      map.addSource('exits', { type: 'geojson', data: empty });
      map.addSource('places', { type: 'geojson', data: empty });
      map.addSource('user', { type: 'geojson', data: empty });
      map.addLayer({
        id: 'exit-lines',
        type: 'line',
        source: 'exits',
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: {
          // Tsunami-warning route: solid green. Extreme-warning route: dashed green.
          // Route to the nearest refuge: solid blue.
          'line-color': ['match', ['get', 'kind'], 'refuge', PLACE_COLOR, EXIT_COLOR],
          'line-width': 4,
          'line-dasharray': [
            'match',
            ['get', 'kind'],
            'extreme',
            ['literal', [2, 1.5]],
            ['literal', [1, 0]],
          ],
        },
      });
      map.addLayer({
        id: 'exit-points',
        type: 'circle',
        source: 'exits',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 9,
          'circle-color': EXIT_COLOR,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 3,
        },
      });
      map.addLayer({
        id: 'places',
        type: 'circle',
        source: 'places',
        paint: {
          'circle-radius': 12,
          'circle-color': ['case', ['get', 'inZone'], '#7a1a10', PLACE_COLOR],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });
      map.addLayer({
        id: 'place-labels',
        type: 'symbol',
        source: 'places',
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Noto Sans Medium'],
          'text-size': 13,
          'text-allow-overlap': true,
        },
        paint: { 'text-color': '#ffffff' },
      });
      map.addLayer({
        id: 'user-halo',
        type: 'circle',
        source: 'user',
        paint: { 'circle-radius': 18, 'circle-color': USER_COLOR, 'circle-opacity': 0.2 },
      });
      map.addLayer({
        id: 'user',
        type: 'circle',
        source: 'user',
        paint: {
          'circle-radius': 8,
          'circle-color': USER_COLOR,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 3,
        },
      });
      setReady(true);
    });

    map.on('click', (e: maplibregl.MapMouseEvent) =>
      onPickRef.current?.([e.lngLat.lng, e.lngLat.lat]),
    );

    return () => {
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // The map is created once; zones never change after load and labels are only for
    // the gesture hint, so re-creating the map for them isn't worth it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep overlays in sync and frame what matters.
  const key = JSON.stringify([user, exits, places, routes]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const data = overlayData(user, exits, places, routes);
    (map.getSource('user') as GeoJSONSource).setData(data.user);
    (map.getSource('exits') as GeoJSONSource).setData(data.exits);
    (map.getSource('places') as GeoJSONSource).setData(data.places);

    const pts: LngLat[] = [
      ...(user ? [user] : []),
      ...exits.flatMap((e) => e.line ?? [e.point]),
      ...places.map((p) => p.coord),
      ...routes.flat(),
    ];
    if (pts.length === 1) map.easeTo({ center: [...pts[0]!], zoom: 14, duration: 0 });
    else if (pts.length > 1) {
      const lngs = pts.map((p) => p[0]);
      const lats = pts.map((p) => p[1]);
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 48, maxZoom: 16, duration: 0 },
      );
    }
    // `key` captures the content of user/exits/places.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, key]);

  if (failed) return <p className="map-fallback">{t('map.unavailable')}</p>;

  return (
    <div className="map-wrap">
      <div ref={container} className="map" role="region" aria-label={label} />
      <ul className="map-legend" aria-label={t('map.legend')}>
        <li>
          <span className="swatch" style={{ background: ZONE_COLORS.tsunami }} aria-hidden="true" />
          {t('map.legendTsunami')}
        </li>
        <li>
          <span className="swatch" style={{ background: ZONE_COLORS.extreme }} aria-hidden="true" />
          {t('map.legendExtreme')}
        </li>
        <li>
          <span
            className="swatch swatch-dot"
            style={{ background: USER_COLOR }}
            aria-hidden="true"
          />
          {t('map.legendYou')}
        </li>
        {exits.length > 0 && (
          <li>
            <span
              className="swatch swatch-dot"
              style={{ background: EXIT_COLOR }}
              aria-hidden="true"
            />
            {t('map.legendExit')}
          </li>
        )}
        {(exits.some((e) => e.line) || routes.length > 0) && (
          <li>
            <span
              className="swatch swatch-line"
              style={{ background: EXIT_COLOR }}
              aria-hidden="true"
            />
            {t('map.legendRoute')}
          </li>
        )}
        {places.length > 0 && (
          <li>
            <span
              className="swatch swatch-dot"
              style={{ background: PLACE_COLOR }}
              aria-hidden="true"
            />
            {t('map.legendRefuge')}
          </li>
        )}
      </ul>
      {onPick && <p className="map-hint">{t('map.tapHint')}</p>}
    </div>
  );
}
