import { useEffect, useState } from 'react';
import type { LngLat } from '../geo/types';
import { ZoneIndex, type ZoneCollection, type ZoneStatus } from '../geo/zoneLookup';

export type Refuge = {
  id: string;
  name: string;
  address: string;
  place: string;
  coord: LngLat;
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

export type Manifest = { zones: SourceInfo; refuges: SourceInfo; basemap: SourceInfo };

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

export function useAppData(): { data: AppData | null; error: Error | null } {
  const [state, setState] = useState<{ data: AppData | null; error: Error | null }>({
    data: null,
    error: null,
  });
  useEffect(() => {
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
  }, []);
  return state;
}
