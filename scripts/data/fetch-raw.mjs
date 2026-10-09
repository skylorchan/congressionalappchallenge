// Downloads every raw dataset Kōkua uses into data/raw/, plus each source's own metadata
// (so license and "last updated" dates can be checked and recorded in DATA_SOURCES.md).
//
// Runs on a GitHub Actions runner (.github/workflows/fetch-data.yml) because the dev
// container's network policy blocks these hosts. Each source is fetched independently:
// one failure is logged in data/raw/fetch-log.json and does not stop the others.
//
// The basemap (PMTiles extract + fonts + sprites) is downloaded by the workflow itself
// with the pmtiles CLI; see fetch-data.yml.
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';

const OUT = new URL('../../data/raw/', import.meta.url).pathname;
const UA = 'Kokua offline emergency app (https://github.com/skylorchan/congressionalappchallenge)';

// Oʻahu bounding box (west, south, east, north), with a small margin offshore.
export const OAHU_BBOX = [-158.33, 21.22, -157.6, 21.75];

const log = [];

function save(rel, data) {
  const path = join(OUT, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, typeof data === 'string' ? data : JSON.stringify(data, null, 1));
}

async function get(url, { as = 'json' } = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  if (as === 'json') return res.json();
  if (as === 'text') return res.text();
  return Buffer.from(await res.arrayBuffer());
}

async function step(name, url, fn) {
  const entry = { name, url, retrieved: new Date().toISOString() };
  try {
    Object.assign(entry, (await fn()) ?? {});
    entry.ok = true;
  } catch (err) {
    entry.ok = false;
    entry.error = String(err?.message ?? err);
  }
  log.push(entry);
  console.log(entry.ok ? 'OK  ' : 'FAIL', name, entry.error ?? '');
}

/** Pages through an ArcGIS layer's /query endpoint, returning one GeoJSON FeatureCollection. */
async function arcgisQuery(layerUrl, { where = '1=1', bbox = OAHU_BBOX } = {}) {
  const features = [];
  for (let offset = 0; ; offset += 1000) {
    const q = new URLSearchParams({
      where,
      outFields: '*',
      returnGeometry: 'true',
      outSR: '4326',
      f: 'geojson',
      resultOffset: String(offset),
      resultRecordCount: '1000',
    });
    if (bbox) {
      q.set('geometry', bbox.join(','));
      q.set('geometryType', 'esriGeometryEnvelope');
      q.set('inSR', '4326');
      q.set('spatialRel', 'esriSpatialRelIntersects');
    }
    const page = await get(`${layerUrl}/query?${q}`);
    if (page.error) throw new Error(JSON.stringify(page.error));
    features.push(...(page.features ?? []));
    const more = page.exceededTransferLimit || page.properties?.exceededTransferLimit;
    if (!more || !page.features?.length) break;
  }
  return { type: 'FeatureCollection', features };
}

async function arcgisLayer(name, layerUrl, opts) {
  await step(`${name} (metadata)`, `${layerUrl}?f=json`, async () => {
    const meta = await get(`${layerUrl}?f=json`);
    save(`meta/${name}.json`, meta);
    return { layerName: meta.name, editingInfo: meta.editingInfo ?? null };
  });
  await step(name, `${layerUrl}/query`, async () => {
    const fc = await arcgisQuery(layerUrl, opts);
    save(`${name}.geojson`, fc);
    return { features: fc.features.length };
  });
}

/** Saves a MapServer's layer list, then fetches every layer whose name matches `pattern`. */
async function arcgisDiscover(prefix, serviceUrl, pattern) {
  let layers = [];
  await step(`${prefix} (layer list)`, `${serviceUrl}/layers?f=json`, async () => {
    const meta = await get(`${serviceUrl}/layers?f=json`);
    save(`meta/${prefix}-layers.json`, meta);
    layers = [...(meta.layers ?? []), ...(meta.tables ?? [])];
    return { layers: layers.map((l) => `${l.id}: ${l.name}`) };
  });
  for (const l of layers.filter((l) => pattern.test(l.name))) {
    const slug = l.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await arcgisLayer(`${prefix}-${l.id}-${slug}`, `${serviceUrl}/${l.id}`);
  }
}

const GEO = 'https://geodata.hawaii.gov/arcgis/rest/services';

// 1. Tsunami evacuation zones (Hawaiʻi Statewide GIS Program).
await arcgisDiscover('hazards', `${GEO}/Hazards/MapServer`, /tsunami/i);

// 2. Shelters / refuge areas: check every state service that might hold them.
for (const svc of ['EmergMgmtPubSafety', 'HumanHealthSafety', 'Infrastructure', 'Society']) {
  await arcgisDiscover(svc.toLowerCase(), `${GEO}/${svc}/MapServer`, /shelter|refuge|evacuat/i);
}

// 3. Shelters / refuge areas published by the City & County of Honolulu GIS (org
//    tNJpAOha4mODLkXz) and the Hawaiʻi Emergency Management Agency (org aKxrz4vDVjfUwBWJ)
//    on ArcGIS Online. List every service in each org, keep the ones whose name mentions
//    shelters/refuge, and download their layers plus the item record (license, dates).
const SHELTERISH = /shelter|refuge/i;
for (const [prefix, org] of [
  ['honolulu', 'https://services.arcgis.com/tNJpAOha4mODLkXz/arcgis/rest/services'],
  ['hiema', 'https://services9.arcgis.com/aKxrz4vDVjfUwBWJ/arcgis/rest/services'],
]) {
  let services = [];
  await step(`${prefix} (service list)`, `${org}?f=json`, async () => {
    const res = await get(`${org}?f=json`);
    save(`meta/${prefix}-services.json`, res);
    services = res.services ?? [];
    return { services: services.map((s) => `${s.name} (${s.type})`) };
  });
  for (const svc of services.filter((s) => SHELTERISH.test(s.name))) {
    const svcUrl = svc.url ?? `${org}/${svc.name}/${svc.type}`;
    const svcPrefix = `${prefix}-${svc.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    await step(`${svcPrefix} (service + item)`, `${svcUrl}?f=json`, async () => {
      const info = await get(`${svcUrl}?f=json`);
      save(`meta/${svcPrefix}-service.json`, info);
      if (info.serviceItemId) {
        const itemUrl = `https://www.arcgis.com/sharing/rest/content/items/${info.serviceItemId}?f=json`;
        save(`meta/${svcPrefix}-item.json`, await get(itemUrl));
      }
      return { serviceItemId: info.serviceItemId ?? null };
    });
    await arcgisDiscover(svcPrefix, svcUrl, /./);
  }
}

// 4. The City's older "Emergency Shelter" dataset (DEM, 2012), metadata only: the row API
//    returns 403. Kept to document why it isn't used.
await step(
  'honolulu-shelters-2012 (metadata)',
  'https://data.honolulu.gov/api/views/gxrb-rbvm.json',
  async () => {
    save(
      'meta/honolulu-shelters.json',
      await get('https://data.honolulu.gov/api/views/gxrb-rbvm.json'),
    );
  },
);

// 5. Item records (license, dates) for the tsunami zone layers on the state server.
await step(
  'statewide tsunami item',
  'https://www.arcgis.com/sharing/rest/search?q=owner:HawaiiStateGIS tsunami',
  async () => {
    const res = await get(
      'https://www.arcgis.com/sharing/rest/search?f=json&num=50&q=' +
        encodeURIComponent('owner:HawaiiStateGIS tsunami'),
    );
    save('meta/statewide-tsunami-items.json', res);
    return {
      items: (res.results ?? []).map(
        (r) => `${r.id} ${r.title} (${r.licenseInfo ? 'license text' : 'no license'})`,
      ),
    };
  },
);

// 6. NWS alerts: the live feed (often empty) and recent past alerts, as a schema sample
//    for parser tests. Real data, labeled with its retrieval time in fetch-log.json.
for (const [name, url] of [
  ['nws-active-hi', 'https://api.weather.gov/alerts/active?area=HI'],
  ['nws-recent-hi', 'https://api.weather.gov/alerts?area=HI&limit=25'],
]) {
  await step(name, url, async () => {
    const res = await get(url);
    save(`${name}.json`, res);
    return { features: res.features?.length ?? 0 };
  });
}

// 7. Walkable roads and paths on Oʻahu from OpenStreetMap (Overpass API), for offline
//    walking routes. Everything with a highway tag that people can walk on: footways,
//    paths, steps, streets. Excludes freeways and anything tagged foot/access = no or
//    private. Saved gzipped; scripts/data/build-graph.mjs turns it into the routing graph.
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const [w, s, e, n] = OAHU_BBOX;
const WALK_QUERY = `[out:json][timeout:600][maxsize:1073741824];
way["highway"]["highway"!~"^(motorway|motorway_link|construction|proposed|raceway|bus_guideway|platform|corridor|elevator|abandoned|razed|no)$"]["foot"!~"^(no|private)$"]["access"!~"^(no|private)$"](${s},${w},${n},${e});
(._;>;);
out body qt;`;
await step('osm-walk', OVERPASS[0], async () => {
  let lastErr;
  for (const url of OVERPASS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(WALK_QUERY)}`,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
      const text = await res.text();
      const json = JSON.parse(text);
      save('osm-walk.json.gz', gzipSync(Buffer.from(text)));
      save('meta/osm-walk.json', { url, query: WALK_QUERY, osm3s: json.osm3s ?? null });
      return {
        source: url,
        ways: json.elements.filter((x) => x.type === 'way').length,
        nodes: json.elements.filter((x) => x.type === 'node').length,
        osmTimestamp: json.osm3s?.timestamp_osm_base ?? null,
      };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
});

save('fetch-log.json', log);
console.log(`\n${log.filter((e) => e.ok).length}/${log.length} steps OK`);
