// All shapes here are synthetic test geometry (simple squares near Honolulu), not real
// evacuation zones.
import { describe, expect, it } from 'vitest';
import { bearingDegrees, compassPoint, distanceMeters } from './distance';
import { nearestExit, nearestPoints } from './nearest';
import { bboxOf, pointInPolygon, pointInRing } from './pointInPolygon';
import type { LngLat, PolygonCoords, Ring } from './types';
import { ZoneIndex, type Zone, type ZoneKind } from './zoneLookup';

const square = (w: number, s: number, e: number, n: number): Ring => [
  [w, s],
  [e, s],
  [e, n],
  [w, n],
  [w, s],
];

describe('pointInRing / pointInPolygon', () => {
  const sq = square(0, 0, 10, 10);

  it('detects inside, outside, and boundary', () => {
    expect(pointInRing([5, 5], sq)).toBe(true);
    expect(pointInRing([15, 5], sq)).toBe(false);
    expect(pointInRing([-1, 5], sq)).toBe(false);
    expect(pointInRing([10, 5], sq)).toBe('edge');
    expect(pointInRing([0, 0], sq)).toBe('edge');
  });

  it('counts a ray passing exactly through a vertex once', () => {
    const diamond: Ring = [
      [0, -5],
      [5, 0],
      [0, 5],
      [-5, 0],
      [0, -5],
    ];
    expect(pointInRing([0, 0], diamond)).toBe(true); // ray hits vertex (5,0)
    expect(pointInRing([-6, 0], diamond)).toBe(false); // ray hits (-5,0) and (5,0)
  });

  it('handles concave rings', () => {
    // "U" shape: notch cut from the top middle.
    const u: Ring = [
      [0, 0],
      [9, 0],
      [9, 9],
      [6, 9],
      [6, 3],
      [3, 3],
      [3, 9],
      [0, 9],
      [0, 0],
    ];
    expect(pointInRing([1.5, 6], u)).toBe(true);
    expect(pointInRing([4.5, 6], u)).toBe(false); // in the notch
    expect(pointInRing([7.5, 6], u)).toBe(true);
  });

  it('excludes holes but counts the hole boundary as inside', () => {
    const withHole: PolygonCoords = [sq, square(4, 4, 6, 6)];
    expect(pointInPolygon([2, 2], withHole)).toBe(true);
    expect(pointInPolygon([5, 5], withHole)).toBe(false);
    expect(pointInPolygon([4, 5], withHole)).toBe(true);
  });

  it('works with real-world coordinate magnitudes and ring winding either way', () => {
    const cw = square(-157.86, 21.27, -157.82, 21.3).slice().reverse();
    expect(pointInRing([-157.84, 21.285], cw)).toBe(true);
    expect(pointInRing([-157.8, 21.285], cw)).toBe(false);
  });
});

describe('distance and bearing', () => {
  it('matches known distances', () => {
    // One degree of latitude ≈ 111.195 km on the mean-radius sphere.
    expect(distanceMeters([-157.8, 21], [-157.8, 22])).toBeCloseTo(111_195, -1);
    // Honolulu Hale → ʻIolani Palace, roughly 300 m apart.
    const d = distanceMeters([-157.8581, 21.3069], [-157.8589, 21.3067 + 0.0027]);
    expect(d).toBeGreaterThan(250);
    expect(d).toBeLessThan(350);
    expect(distanceMeters([1, 1], [1, 1])).toBe(0);
  });

  it('gives compass bearings', () => {
    const o: LngLat = [-157.85, 21.3];
    expect(bearingDegrees(o, [-157.85, 21.4])).toBeCloseTo(0, 5);
    expect(bearingDegrees(o, [-157.75, 21.3])).toBeCloseTo(90, 0);
    expect(bearingDegrees(o, [-157.85, 21.2])).toBeCloseTo(180, 5);
    expect(bearingDegrees(o, [-157.95, 21.3])).toBeCloseTo(270, 0);
    expect(compassPoint(0)).toBe('N');
    expect(compassPoint(44)).toBe('NE');
    expect(compassPoint(200)).toBe('S');
    expect(compassPoint(338)).toBe('N');
    expect(compassPoint(-90)).toBe('W');
  });
});

const zone = (id: string, kind: ZoneKind, ring: Ring): Zone => ({
  id,
  kind,
  coords: [[ring]],
  bbox: bboxOf([[ring]]),
});

describe('ZoneIndex.lookup', () => {
  // Coastal strip (tsunami) inside a wider strip (extreme).
  const idx = new ZoneIndex(
    [
      zone('t1', 'tsunami', square(-157.9, 21.27, -157.8, 21.28)),
      zone('x1', 'extreme', square(-157.9, 21.27, -157.8, 21.29)),
    ],
    [-158.3, 21.2, -157.6, 21.8],
  );

  it('classifies each status', () => {
    expect(idx.lookup([-157.85, 21.275]).status).toBe('tsunami');
    expect(idx.lookup([-157.85, 21.285]).status).toBe('extreme');
    expect(idx.lookup([-157.85, 21.3]).status).toBe('safe');
    expect(idx.lookup([-155.5, 19.6]).status).toBe('no-data'); // Big Island
  });

  it('builds from GeoJSON with Polygon and MultiPolygon features', () => {
    const fromGeo = ZoneIndex.fromGeoJSON({
      coverage: [-158.3, 21.2, -157.6, 21.8],
      features: [
        {
          properties: { kind: 'tsunami', id: 'a' },
          geometry: { type: 'Polygon', coordinates: [square(-157.9, 21.27, -157.8, 21.28)] },
        },
        {
          properties: { kind: 'tsunami', id: 'b' },
          geometry: {
            type: 'MultiPolygon',
            coordinates: [
              [square(-158.1, 21.3, -158.0, 21.4)],
              [square(-157.7, 21.3, -157.65, 21.4)],
            ],
          },
        },
      ],
    });
    expect(fromGeo.lookup([-157.68, 21.35]).zones.map((z) => z.id)).toEqual(['b']);
    expect(fromGeo.lookup([-157.85, 21.275]).zones.map((z) => z.id)).toEqual(['a']);
  });
});

describe('nearestPoints', () => {
  it('returns the k closest, sorted, with distance and bearing', () => {
    const o: LngLat = [-157.85, 21.3];
    const places = [
      { name: 'far', coord: [-157.7, 21.3] as LngLat },
      { name: 'near', coord: [-157.85, 21.31] as LngLat },
      { name: 'mid', coord: [-157.8, 21.3] as LngLat },
    ];
    const r = nearestPoints(o, places, 2);
    expect(r.map((x) => x.item.name)).toEqual(['near', 'mid']);
    expect(r[0]!.distance).toBeCloseTo(1112, -1);
    expect(compassPoint(r[0]!.bearing)).toBe('N');
    expect(compassPoint(r[1]!.bearing)).toBe('E');
  });

  it('handles an empty list', () => {
    expect(nearestPoints([0, 0], [], 3)).toEqual([]);
  });
});

describe('nearestExit', () => {
  it('returns null when not in a zone', () => {
    const z = zone('t', 'tsunami', square(-157.9, 21.27, -157.8, 21.28));
    expect(nearestExit([-157.85, 21.3], [z])).toBeNull();
  });

  it('finds the closest boundary point', () => {
    // Strip 0.01° tall; user is 0.002° from the north edge, 0.008° from the south.
    const z = zone('t', 'tsunami', square(-157.9, 21.27, -157.8, 21.28));
    const exit = nearestExit([-157.85, 21.278], [z])!;
    expect(exit.point[1]).toBeCloseTo(21.28, 6);
    expect(exit.point[0]).toBeCloseTo(-157.85, 6);
    expect(exit.distance).toBeCloseTo(222, -1);
    expect(compassPoint(exit.bearing)).toBe('N');
  });

  it('skips a shared border with an adjacent zone polygon', () => {
    // Two touching polygons. The user is near their shared border (x = -157.85) but that
    // only leads into the other polygon; the real way out is north.
    const west = zone('w', 'tsunami', square(-157.9, 21.27, -157.85, 21.28));
    const east = zone('e', 'tsunami', square(-157.85, 21.27, -157.8, 21.28));
    const exit = nearestExit([-157.8505, 21.277], [west, east])!;
    expect(exit.point[1]).toBeCloseTo(21.28, 6);
    expect(compassPoint(exit.bearing)).toBe('N');
  });
});
