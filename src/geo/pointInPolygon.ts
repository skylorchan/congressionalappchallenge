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
    const [ax, ay] = a;
    const [bx, by] = b;
    // Cheap box test first: the exact on-the-line check is only needed for the few edges
    // whose bounding box contains the point (this made zone lookups ~10x faster).
    if (
      y >= (ay < by ? ay : by) - EDGE_EPSILON &&
      y <= (ay > by ? ay : by) + EDGE_EPSILON &&
      x >= (ax < bx ? ax : bx) - EDGE_EPSILON &&
      x <= (ax > bx ? ax : bx) + EDGE_EPSILON &&
      onSegment(point, a, b)
    )
      return 'edge';
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

/**
 * A faster tester for checking many points against one polygon (used when tagging tens of
 * thousands of intersections with their zone). Same rules and answers as pointInPolygon:
 * each ring's edges are bucketed into horizontal bands, so a point only looks at edges
 * near its own latitude instead of every edge of a long coastline.
 */
export function makePolygonTester(polygon: PolygonCoords, bands = 256) {
  const rings = polygon.map((ring) => {
    let s = Infinity;
    let n = -Infinity;
    for (const [, y] of ring) {
      if (y < s) s = y;
      if (y > n) n = y;
    }
    const h = (n - s) / bands || 1;
    const buckets: number[][] = Array.from({ length: bands }, () => []);
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const y1 = ring[i]![1];
      const y2 = ring[j]![1];
      const lo = Math.max(0, Math.floor((Math.min(y1, y2) - EDGE_EPSILON - s) / h));
      const hi = Math.min(bands - 1, Math.floor((Math.max(y1, y2) + EDGE_EPSILON - s) / h));
      for (let b = lo; b <= hi; b++) buckets[b]!.push(i);
    }
    return { ring, s, n, h, buckets };
  });

  const test = (point: LngLat, r: (typeof rings)[number]): boolean | 'edge' => {
    const [x, y] = point;
    if (y < r.s - EDGE_EPSILON || y > r.n + EDGE_EPSILON) return false;
    const b = Math.min(bands - 1, Math.max(0, Math.floor((y - r.s) / r.h)));
    let inside = false;
    const { ring } = r;
    for (const i of r.buckets[b]!) {
      const a = ring[i]!;
      const c = ring[i === 0 ? ring.length - 1 : i - 1]!;
      const [ax, ay] = a;
      const [bx, by] = c;
      if (
        y >= (ay < by ? ay : by) - EDGE_EPSILON &&
        y <= (ay > by ? ay : by) + EDGE_EPSILON &&
        x >= (ax < bx ? ax : bx) - EDGE_EPSILON &&
        x <= (ax > bx ? ax : bx) + EDGE_EPSILON &&
        onSegment(point, a, c)
      )
        return 'edge';
      if (ay > y !== by > y) {
        const xCross = ax + ((y - ay) * (bx - ax)) / (by - ay);
        if (x < xCross) inside = !inside;
      }
    }
    return inside;
  };

  return (point: LngLat): boolean => {
    const [outer, ...holes] = rings;
    if (!outer) return false;
    const o = test(point, outer);
    if (o === false) return false;
    if (o === 'edge') return true;
    for (const hole of holes) {
      const h = test(point, hole);
      if (h === 'edge') return true;
      if (h) return false;
    }
    return true;
  };
}
