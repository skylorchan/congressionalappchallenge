import { useMemo } from 'react';
import type { AppData, RefugeWithZone } from '../../data/appData';
import { nearestExit, nearestPoints, type Exit, type Ranked } from '../../geo/nearest';
import type { LngLat } from '../../geo/types';
import type { ZoneResult } from '../../geo/zoneLookup';

export type Analysis = {
  zone: ZoneResult;
  /** Way out for a regular Tsunami Warning: leave the tsunami zone (null if not in it). */
  exitTsunami: Exit | null;
  /** Way out for an Extreme Tsunami Warning: reach a safe zone (null if already safe). */
  exitExtreme: Exit | null;
  refuges: Ranked<RefugeWithZone>[];
};

/** Everything the Zone and Safe places screens show for one location. */
export function analyze(data: AppData, point: LngLat, refugeCount = 5): Analysis {
  const { zones } = data;
  const tsunami = zones.ofKind('tsunami');
  const extreme = zones.ofKind('extreme');
  const safe = zones.ofKind('safe');
  const zone = zones.lookup(point);
  return {
    zone,
    exitTsunami:
      zone.status === 'tsunami' ? nearestExit(point, tsunami, [...extreme, ...safe]) : null,
    exitExtreme:
      zone.status === 'tsunami' || zone.status === 'extreme'
        ? nearestExit(point, [...tsunami, ...extreme], safe)
        : null,
    refuges: nearestPoints(point, data.refuges, refugeCount),
  };
}

export function useAnalysis(
  data: AppData | null,
  point: LngLat | undefined,
  refugeCount = 5,
): Analysis | null {
  const lng = point?.[0];
  const lat = point?.[1];
  return useMemo(
    () =>
      data && lng !== undefined && lat !== undefined
        ? analyze(data, [lng, lat], refugeCount)
        : null,
    [data, lng, lat, refugeCount],
  );
}
