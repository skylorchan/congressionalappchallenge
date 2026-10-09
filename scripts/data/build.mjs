// Turns the raw downloads in data/raw/ (see fetch-raw.mjs) into the files the app ships:
//
//   public/data/zones.json     tsunami, extreme tsunami and safe zone polygons for Oʻahu,
//                              simplified to ~2 m so the phone can test points quickly
//   public/data/refuges.json   City & County of Honolulu hurricane refuge areas
//   public/data/manifest.json  source, license and "last updated" dates for the UI
//   public/map/                PMTiles basemap, fonts and sprites
//
// Runs automatically before `npm run build` and the e2e tests.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import mapshaper from 'mapshaper';

const root = new URL('../../', import.meta.url).pathname;
const RAW = join(root, 'data/raw');
const OUT_DATA = join(root, 'public/data');
const OUT_MAP = join(root, 'public/map');

const readJSON = (p) => JSON.parse(readFileSync(join(RAW, p), 'utf8'));
const fetchLog = readJSON('fetch-log.json');
const retrieved = (name) => fetchLog.find((e) => e.name === name && e.ok)?.retrieved ?? null;

// Must match OAHU_BBOX in fetch-raw.mjs: the area we downloaded zones for.
const COVERAGE = [-158.33, 21.22, -157.6, 21.75];

/** Douglas-Peucker/Visvalingam simplification to `interval` metres, keeping every shape. */
async function simplify(fc, interval) {
  const out = await mapshaper.applyCommands(
    `-i in.json -simplify interval=${interval} keep-shapes -o out.json precision=0.000001`,
    { 'in.json': fc },
  );
  return JSON.parse(out['out.json']);
}

const ZONE_LAYERS = [
  {
    kind: 'tsunami',
    file: 'hazards-2-tsunami-evacuation-zones',
    item: 'db829ab4b17a44649eadf0db0f7379ab',
  },
  {
    kind: 'extreme',
    file: 'hazards-12-extreme-tsunami-evacuation-zones',
    item: '6354a438cc124f3d8d5276035815c948',
  },
  { kind: 'safe', file: 'hazards-13-tsunami-safe-zones', item: '01ea0d1b26de44438a84581abc0357f8' },
];

const features = [];
for (const { kind, file } of ZONE_LAYERS) {
  const fc = readJSON(`${file}.geojson`);
  const oahu = {
    type: 'FeatureCollection',
    features: fc.features.filter((f) => f.geometry && f.properties.island === 'OAHU'),
  };
  const simple = await simplify(oahu, 2);
  for (const f of simple.features)
    features.push({
      type: 'Feature',
      properties: { kind, id: `${kind}-${f.properties.objectid}` },
      geometry: f.geometry,
    });
}

const zonesMeta = readJSON('meta/hazards-2-tsunami-evacuation-zones.json');
const items = readJSON('meta/statewide-tsunami-items.json').results;
const zoneModified = Math.max(
  ...ZONE_LAYERS.map((l) => items.find((i) => i.id === l.item)?.modified ?? 0),
);

// Refuge areas: keep only what the app shows. "Status"/"Open_"/"Close_" are the City's
// internal edit fields with no published meaning, so they are deliberately dropped: the
// app must never suggest a site is open.
const REFUGE_FILE =
  'honolulu-potential-emergency-shelter-edit-eoc-0-potential-oahu-hurricane-refuge-areas-edit-status';
const refugeRaw = readJSON(`${REFUGE_FILE}.geojson`);
const refugeLayerMeta = readJSON(`meta/${REFUGE_FILE}.json`);
const refugeItem = readJSON('meta/honolulu-potential-emergency-shelter-edit-eoc-item.json');
const titleCase = (s) =>
  s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, sep, c) => sep + c.toUpperCase());
const refuges = refugeRaw.features
  .filter((f) => f.geometry?.type === 'Point')
  .map((f) => ({
    id: `refuge-${f.properties.OBJECTID}`,
    name: f.properties.Name.trim(),
    address: f.properties.Address?.trim() ?? '',
    place: titleCase(f.properties.Place?.trim() ?? ''),
    coord: f.geometry.coordinates.map((n) => Math.round(n * 1e6) / 1e6),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const basemapSource = JSON.parse(readFileSync(join(RAW, 'basemap/source.json'), 'utf8'));
const basemapShow = readFileSync(join(RAW, 'basemap/show.txt'), 'utf8');
const osmTime = /osmosisreplicationtime (\S+)/.exec(basemapShow)?.[1] ?? null;

const manifest = {
  zones: {
    publisher: 'Hawaiʻi Statewide GIS Program (Oʻahu zones from the City & County of Honolulu)',
    url: 'https://geodata.hawaii.gov/arcgis/rest/services/Hazards/MapServer',
    license: 'State of Hawaiʻi Terms of Use (public domain)',
    sourceDate: '2025-04', // "Island of Oahu: City and County of Honolulu, April 2025"
    layerUpdated: zoneModified ? new Date(zoneModified).toISOString().slice(0, 10) : null,
    retrieved: retrieved('hazards-2-tsunami-evacuation-zones'),
    note: zonesMeta.description?.match(/Island of Oahu:[^;]*/)?.[0] ?? null,
  },
  refuges: {
    publisher: 'City & County of Honolulu, Department of Emergency Management',
    url: refugeItem.url,
    license: 'Public ArcGIS Online item; no license stated',
    layerUpdated: new Date(refugeLayerMeta.editingInfo.dataLastEditDate).toISOString().slice(0, 10),
    retrieved: retrieved(`${REFUGE_FILE}`),
  },
  basemap: {
    publisher: 'Protomaps basemap from OpenStreetMap data',
    url: basemapSource.url,
    license: 'ODbL (© OpenStreetMap contributors)',
    layerUpdated: osmTime?.slice(0, 10) ?? null,
    retrieved: basemapSource.retrieved,
  },
};

rmSync(OUT_DATA, { recursive: true, force: true });
mkdirSync(OUT_DATA, { recursive: true });
writeFileSync(
  join(OUT_DATA, 'zones.json'),
  JSON.stringify({ type: 'FeatureCollection', coverage: COVERAGE, features }),
);
writeFileSync(join(OUT_DATA, 'refuges.json'), JSON.stringify(refuges));
writeFileSync(join(OUT_DATA, 'manifest.json'), JSON.stringify(manifest, null, 2));

rmSync(OUT_MAP, { recursive: true, force: true });
mkdirSync(OUT_MAP, { recursive: true });
cpSync(join(RAW, 'basemap/oahu.pmtiles'), join(OUT_MAP, 'oahu.pmtiles'));
cpSync(join(RAW, 'basemap/fonts'), join(OUT_MAP, 'fonts'), { recursive: true });
cpSync(join(RAW, 'basemap/sprites'), join(OUT_MAP, 'sprites'), { recursive: true });
if (!existsSync(join(OUT_MAP, 'oahu.pmtiles'))) throw new Error('basemap missing');

const verts = JSON.stringify(features).match(/\],\[/g)?.length ?? 0;
console.log(
  `data:build → ${features.length} zone features (~${verts} vertices), ${refuges.length} refuges`,
);
