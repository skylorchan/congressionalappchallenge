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

/**
 * The closest point of safe ground: the nearest point on the boundary of any `reach`
 * zone, for someone standing inside one of the `leave` zones.
 *
 * Why aim at the target zones instead of just "the edge of the zone I'm in": the
 * seaward edge of a tsunami zone is the shoreline, so "nearest way out" would happily
 * point into the ocean. Measuring to the nearest safe polygon can only ever land on
 * mapped safe land. Since the user is outside every target polygon, the closest point
 * of a polygon is always on its boundary, so checking boundary segments is exact.
 *
 * Returns null if the origin is not inside any `leave` zone. Distance is straight-line,
 * not a walking route.
 */
export function nearestExit(
  origin: LngLat,
  leave: readonly Zone[],
  reach: readonly Zone[],
): Exit | null {
  const inLeave = leave.some(
    (z) => inBBox(origin, z.bbox) && pointInMultiPolygon(origin, z.coords),
  );
  if (!inLeave) return null;

  // Local metres centred on the user, so "closest point on a segment" is simple vector
  // maths with the user at (0, 0).
  const proj = makeLocalProjection(origin);
  let best: { d: number; x: number; y: number } | null = null;
  for (const zone of reach)
    for (const poly of zone.coords)
      for (const ring of poly)
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
          const d = Math.hypot(x, y);
          if (!best || d < best.d) best = { d, x, y };
        }
  if (!best) return null;
  const point = proj.toLngLat([best.x, best.y]);
  return { point, distance: distanceMeters(origin, point), bearing: bearingDegrees(origin, point) };
}
