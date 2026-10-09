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

// 3. National Shelter System facilities (FEMA / American Red Cross), HIFLD Open mirror.
await arcgisLayer(
  'nss-shelters',
  'https://maps.nccs.nasa.gov/mapping/rest/services/hifld_open/emergency_services/MapServer/7',
);

// 4. City & County of Honolulu open data "Emergency Shelter" (Socrata dataset gxrb-rbvm).
await step(
  'honolulu-shelters (metadata)',
  'https://data.honolulu.gov/api/views/gxrb-rbvm.json',
  async () => {
    save(
      'meta/honolulu-shelters.json',
      await get('https://data.honolulu.gov/api/views/gxrb-rbvm.json'),
    );
  },
);
await step(
  'honolulu-shelters',
  'https://data.honolulu.gov/resource/gxrb-rbvm.json?$limit=5000',
  async () => {
    const rows = await get('https://data.honolulu.gov/resource/gxrb-rbvm.json?$limit=5000');
    save('honolulu-shelters.json', rows);
    return { rows: rows.length };
  },
);

// 5. Honolulu's ArcGIS Hub: search for any newer shelter / evacuation layers.
for (const q of ['shelter', 'tsunami evacuation', 'refuge']) {
  const url = `https://hub.arcgis.com/api/search/v1/collections/dataset/items?q=${encodeURIComponent(q)}&bbox=${OAHU_BBOX.join(',')}&limit=50`;
  await step(`hub-search ${q}`, url, async () => {
    const res = await get(url);
    save(`meta/hub-search-${q.replace(/\s+/g, '-')}.json`, res);
    return {
      hits: (res.features ?? []).map(
        (f) => `${f.properties?.title} | ${f.properties?.url ?? f.id}`,
      ),
    };
  });
}

// 6. City & County of Honolulu GIS download site (has an Emergency_shelters.zip).
await step('honolulu-gisftp (index)', 'http://gisftp.hicentral.com/', async () => {
  const html = await get('http://gisftp.hicentral.com/', { as: 'text' });
  save('meta/honolulu-gisftp-index.html', html);
  const links = [...html.matchAll(/href="([^"]*(?:shelter|tsunami|evac)[^"]*)"/gi)].map(
    (m) => m[1],
  );
  for (const href of links) {
    const url = new URL(href, 'http://gisftp.hicentral.com/').href;
    if (!/\.zip$/i.test(url)) continue;
    save(`honolulu-gisftp/${url.split('/').pop()}`, await get(url, { as: 'buffer' }));
  }
  return { links };
});

// 7. NWS alerts: the live feed (often empty) and recent past alerts, as a schema sample
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

save('fetch-log.json', log);
console.log(`\n${log.filter((e) => e.ok).length}/${log.length} steps OK`);
