import type { BBox, LngLat, MultiPolygonCoords, PolygonCoords, Ring } from './types';

// At Oʻahu's scale (under 100 km) treating longitude/latitude as flat x/y gives the same
// inside/outside answer as spherical geometry, except within millimetres of an edge.

/** Distance from the boundary, in degrees, that still counts as "on" it. About 1 cm. */
const EDGE_EPSILON = 1e-7;

function onSegment(p: LngLat, a: LngLat, b: LngLat): boolean {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const cross = (px - ax) * (by - ay) - (py - ay) * (bx - ax);
  const len = Math.hypot(bx - ax, by - ay);
  if (Math.abs(cross) > EDGE_EPSILON * Math.max(len, EDGE_EPSILON)) return false;
  return (
    px >= Math.min(ax, bx) - EDGE_EPSILON &&
    px <= Math.max(ax, bx) + EDGE_EPSILON &&
    py >= Math.min(ay, by) - EDGE_EPSILON &&
    py <= Math.max(ay, by) + EDGE_EPSILON
  );
}

/**
 * Ray casting: shoot a ray from the point toward +x and count how many ring edges it
 * crosses. Odd = inside. Returns 'edge' if the point lies on the boundary, so callers
 * can decide (for evacuation zones, on the line counts as inside).
 */
export function pointInRing(point: LngLat, ring: Ring): boolean | 'edge' {
  const [x, y] = point;
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (onSegment(point, a, b)) return 'edge';
    const [ax, ay] = a;
    const [bx, by] = b;
    // Edge straddles the horizontal line through the point (half-open, so a vertex
    // exactly on the line is counted once, not twice)...
    if (ay > y !== by > y) {
      // ...and crosses it to the right of the point.
      const xCross = ax + ((y - ay) * (bx - ax)) / (by - ay);
      if (x < xCross) inside = !inside;
    }
  }
  return inside;
}

/** Inside the outer ring and not inside any hole. Points on any boundary count as inside. */
export function pointInPolygon(point: LngLat, polygon: PolygonCoords): boolean {
  const [outer, ...holes] = polygon;
  if (!outer) return false;
  const inOuter = pointInRing(point, outer);
  if (inOuter === false) return false;
  if (inOuter === 'edge') return true;
  for (const hole of holes) {
    const inHole = pointInRing(point, hole);
    if (inHole === 'edge') return true;
    if (inHole) return false;
  }
  return true;
}

export function pointInMultiPolygon(point: LngLat, multi: MultiPolygonCoords): boolean {
  return multi.some((poly) => pointInPolygon(point, poly));
}

export function bboxOf(multi: MultiPolygonCoords): BBox {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const poly of multi)
    for (const ring of poly)
      for (const [x, y] of ring) {
        if (x < w) w = x;
        if (x > e) e = x;
        if (y < s) s = y;
        if (y > n) n = y;
      }
  return [w, s, e, n];
}

export function inBBox([x, y]: LngLat, [w, s, e, n]: BBox): boolean {
  return x >= w && x <= e && y >= s && y <= n;
}
