import { useEffect, useState } from 'react';
import type { LngLat } from '../geo/types';
import { WalkGraph } from '../geo/route';
import { decodeWalkGraph } from '../geo/walkGraph';
import { ZoneIndex, type ZoneCollection, type ZoneStatus } from '../geo/zoneLookup';

export type Refuge = {
  id: string;
  name: string;
  address: string;
  place: string;
  coord: LngLat;
  /** Nearest walking-graph intersection, or -1 if none within 300 m. */
  node: number;
};

/** A refuge plus which tsunami zone it sits in, computed once when the data loads. */
export type RefugeWithZone = Refuge & { zone: ZoneStatus };

export type SourceInfo = {
  publisher: string;
  url: string;
  license: string;
  sourceDate?: string;
  /** When the publisher last changed the data (YYYY-MM-DD). */
  layerUpdated: string | null;
  /** When Kōkua downloaded it (ISO timestamp). */
  retrieved: string | null;
};

export type Manifest = {
  zones: SourceInfo;
  refuges: SourceInfo;
  walk: SourceInfo;
  basemap: SourceInfo;
};

export type AppData = {
  zones: ZoneIndex;
  /** The raw zone GeoJSON, reused by the map so it isn't parsed twice. */
  zonesGeoJSON: ZoneCollection;
  refuges: RefugeWithZone[];
  manifest: Manifest;
};

export const dataUrl = (file: string) => `${import.meta.env.BASE_URL}data/${file}`;

async function getJSON<T>(file: string): Promise<T> {
  const res = await fetch(dataUrl(file));
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

let cached: Promise<AppData> | null = null;

/**
 * Loads the zone polygons, refuge list and source manifest (all precached by the
 * service worker, so this works offline). Loaded once and shared by every screen.
 */
export function loadAppData(): Promise<AppData> {
  cached ??= Promise.all([
    getJSON<ZoneCollection>('zones.json'),
    getJSON<Refuge[]>('refuges.json'),
    getJSON<Manifest>('manifest.json'),
  ]).then(([zonesGeoJSON, refuges, manifest]) => {
    const zones = ZoneIndex.fromGeoJSON(zonesGeoJSON);
    return {
      zones,
      zonesGeoJSON,
      refuges: refuges.map((r) => ({ ...r, zone: zones.lookup(r.coord).status })),
      manifest,
    };
  });
  // Don't remember a failure (e.g. a flaky first load): let the next caller retry.
  cached.catch(() => {
    cached = null;
  });
  return cached;
}

/** Loads the data once `enabled` is true (it's ~1 MB, so screens wait until it's needed). */
export function useAppData(enabled = true): { data: AppData | null; error: Error | null } {
  const [state, setState] = useState<{ data: AppData | null; error: Error | null }>({
    data: null,
    error: null,
  });
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    loadAppData().then(
      (data) => live && setState({ data, error: null }),
      (error: unknown) =>
        live &&
        setState({ data: null, error: error instanceof Error ? error : new Error(String(error)) }),
    );
    return () => {
      live = false;
    };
  }, [enabled]);
  return state;
}

let graphCached: Promise<WalkGraph> | null = null;

/**
 * The offline walking network (~3 MB, precached). Loaded separately from the zone data
 * so the zone answer can show first; routes appear a moment later.
 */
export function loadWalkGraph(): Promise<WalkGraph> {
  graphCached ??= Promise.all([
    fetch(dataUrl('walk.bin')).then((r) => {
      if (!r.ok) throw new Error(`walk.bin: HTTP ${r.status}`);
      return r.arrayBuffer();
    }),
    getJSON<{ names: string[] }>('walk.json'),
  ]).then(([buf, meta]) => new WalkGraph(decodeWalkGraph(buf, meta.names)));
  graphCached.catch(() => {
    graphCached = null;
  });
  return graphCached;
}

/** The walking graph once `enabled` and loaded; null before that (or if it failed). */
export function useWalkGraph(enabled: boolean): WalkGraph | null {
  const [graph, setGraph] = useState<WalkGraph | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    loadWalkGraph().then(
      (g) => live && setGraph(g),
      () => {}, // no graph: the app keeps using straight-line directions
    );
    return () => {
      live = false;
    };
  }, [enabled]);
  return graph;
}
