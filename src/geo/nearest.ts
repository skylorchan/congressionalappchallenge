import { bearingDegrees, distanceMeters, makeLocalProjection } from './distance';
import { inBBox, pointInMultiPolygon } from './pointInPolygon';
import type { LngLat } from './types';
import type { Zone } from './zoneLookup';

export type Ranked<T> = { item: T; distance: number; bearing: number };

/**
 * The k closest items by straight-line distance. A plain scan is fine here: Oʻahu has a
 * few hundred candidate places, and sorting them takes well under a millisecond.
 */
export function nearestPoints<T extends { coord: LngLat }>(
  origin: LngLat,
  items: readonly T[],
  k: number,
): Ranked<T>[] {
  return items
    .map((item) => ({
      item,
      distance: distanceMeters(origin, item.coord),
      bearing: bearingDegrees(origin, item.coord),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, k);
}

export type Exit = { point: LngLat; distance: number; bearing: number };

/** How far past the boundary we check that we've really left every zone. */
const PROBE_M = 15;
/** Candidate boundary points to try before giving up (shared borders get skipped). */
const MAX_CANDIDATES = 500;

/**
 * The closest point that gets you out of the given zones: the nearest spot on a zone
 * boundary from which a few more metres in the same direction leaves every zone.
 * That second check matters because evacuation zones are split into many adjacent
 * polygons, and the closest edge is often just the border with the next polygon.
 *
 * Returns null if the origin is not inside any of the zones. Distance is straight-line,
 * not a walking route.
 */
export function nearestExit(origin: LngLat, zones: readonly Zone[]): Exit | null {
  const inAny = (p: LngLat) =>
    zones.some((z) => inBBox(p, z.bbox) && pointInMultiPolygon(p, z.coords));
  if (!inAny(origin)) return null;

  // Work in local metres centred on the user, so "closest point on a segment" is simple
  // vector maths. The user is at (0, 0).
  const proj = makeLocalProjection(origin);
  const candidates: { d: number; x: number; y: number }[] = [];
  for (const zone of zones)
    for (const poly of zone.coords)
      for (const ring of poly) {
        for (let i = 1; i < ring.length; i++) {
          const [ax, ay] = proj.toXY(ring[i - 1]!);
          const [bx, by] = proj.toXY(ring[i]!);
          const dx = bx - ax;
          const dy = by - ay;
          const len2 = dx * dx + dy * dy;
          // Parameter t of the point on segment AB closest to the origin, clamped to [0, 1].
          const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
          const x = ax + t * dx;
          const y = ay + t * dy;
          candidates.push({ d: Math.hypot(x, y), x, y });
        }
      }
  candidates.sort((a, b) => a.d - b.d);

  for (const c of candidates.slice(0, MAX_CANDIDATES)) {
    if (c.d === 0) continue; // standing exactly on a line: direction undefined, try next
    const scale = (c.d + PROBE_M) / c.d;
    const probe = proj.toLngLat([c.x * scale, c.y * scale]);
    if (inAny(probe)) continue;
    const point = proj.toLngLat([c.x, c.y]);
    return {
      point,
      distance: distanceMeters(origin, point),
      bearing: bearingDegrees(origin, point),
    };
  }
  return null;
}
