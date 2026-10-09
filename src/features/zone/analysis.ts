import { useMemo } from 'react';
import type { AppData, RefugeWithZone } from '../../data/appData';
import { nearestExit, nearestPoints, type Exit, type Ranked } from '../../geo/nearest';
import type { Route, WalkGraph } from '../../geo/route';
import { ZONE_CODE } from '../../geo/walkGraph';
import type { LngLat } from '../../geo/types';
import type { ZoneResult } from '../../geo/zoneLookup';

/** A way out or a place to go: a walking route when one was found, else a straight line. */
export type Way = Exit & { route: Route | null };
export type RankedPlace = Ranked<RefugeWithZone> & { route: Route | null };

export type Analysis = {
  zone: ZoneResult;
  /** Way out for a regular Tsunami Warning: leave the tsunami zone (null if not in it). */
  exitTsunami: Way | null;
  /** Way out for an Extreme Tsunami Warning: reach a safe zone (null if already safe). */
  exitExtreme: Way | null;
  refuges: RankedPlace[];
  /** True once walking routes were used (the graph had loaded). */
  walking: boolean;
};

function fromRoute(route: Route): Way {
  return {
    point: route.end,
    distance: route.distance,
    bearing: route.steps[0]?.bearing ?? 0,
    route,
  };
}

/**
 * Everything the Zone and Safe places screens show for one location. With the walking
 * graph, ways out and refuges are measured along real roads and paths (the nearest by
 * walking, which isn't always the nearest as the crow flies). Without it, or where no
 * route exists (e.g. far out on a beach), it falls back to straight lines.
 */
export function analyze(
  data: AppData,
  point: LngLat,
  refugeCount = 5,
  graph: WalkGraph | null = null,
): Analysis {
  const { zones } = data;
  const tsunami = zones.ofKind('tsunami');
  const extreme = zones.ofKind('extreme');
  const safe = zones.ofKind('safe');
  const zone = zones.lookup(point);
  const straight = (e: Exit | null): Way | null => (e ? { ...e, route: null } : null);

  const inTsunami = zone.status === 'tsunami';
  const inAny = inTsunami || zone.status === 'extreme';
  const walkT =
    graph && inTsunami ? graph.routeToZone(point, [ZONE_CODE.extreme, ZONE_CODE.safe]) : null;
  const walkX = graph && inAny ? graph.routeToZone(point, [ZONE_CODE.safe]) : null;

  let refuges: RankedPlace[] = nearestPoints(point, data.refuges, refugeCount).map((r) => ({
    ...r,
    route: null,
  }));
  if (graph) {
    const linked = data.refuges.map((r) => r.node);
    const routed = graph.routesToNodes(point, linked, refugeCount);
    if (routed && routed.length)
      refuges = routed.map(({ index, route }) => ({
        item: data.refuges[index]!,
        distance: route.distance,
        bearing: route.steps[0]?.bearing ?? 0,
        route,
      }));
  }

  return {
    zone,
    exitTsunami: walkT
      ? fromRoute(walkT)
      : inTsunami
        ? straight(nearestExit(point, tsunami, [...extreme, ...safe]))
        : null,
    exitExtreme: walkX
      ? fromRoute(walkX)
      : inAny
        ? straight(nearestExit(point, [...tsunami, ...extreme], safe))
        : null,
    refuges,
    walking: graph !== null,
  };
}

export function useAnalysis(
  data: AppData | null,
  point: LngLat | undefined,
  refugeCount = 5,
  graph: WalkGraph | null = null,
): Analysis | null {
  const lng = point?.[0];
  const lat = point?.[1];
  return useMemo(
    () =>
      data && lng !== undefined && lat !== undefined
        ? analyze(data, [lng, lat], refugeCount, graph)
        : null,
    [data, lng, lat, refugeCount, graph],
  );
}
