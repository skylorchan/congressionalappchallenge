/// <reference types="node" />
// Checks the geo code against the real, processed zone data (public/data/zones.json,
// produced by `npm run data:build`). Skipped if that file hasn't been built.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LngLat } from './types';
import { nearestExit } from './nearest';
import { ZoneIndex, type ZoneCollection, type ZoneStatus } from './zoneLookup';

const path = join(process.cwd(), 'public/data/zones.json');

describe.skipIf(!existsSync(path))('real Oʻahu zone data', () => {
  const idx = ZoneIndex.fromGeoJSON(JSON.parse(readFileSync(path, 'utf8')) as ZoneCollection);

  it.each<[string, LngLat, ZoneStatus]>([
    ['Waikīkī Beach', [-157.8268, 21.276], 'tsunami'],
    ['Haleʻiwa town', [-158.103, 21.592], 'tsunami'],
    ['Aloha Tower', [-157.8663, 21.3069], 'tsunami'],
    ['UH Mānoa', [-157.817, 21.2969], 'safe'],
    ['Mililani', [-158.01, 21.45], 'safe'],
    ['open ocean off Diamond Head', [-157.85, 21.25], 'no-data'],
  ])('%s → %s', (_, point, status) => {
    expect(idx.lookup(point).status).toBe(status);
  });

  it('finds a way out of the tsunami zone from Waikīkī that lands on mapped ground', () => {
    const origin: LngLat = [-157.8268, 21.276];
    const reach = [...idx.ofKind('extreme'), ...idx.ofKind('safe')];
    const exit = nearestExit(origin, idx.ofKind('tsunami'), reach)!;
    expect(exit.distance).toBeGreaterThan(100);
    expect(exit.distance).toBeLessThan(3000);
    // Nudge 5 m past the exit point along the same line: that must be extreme or safe.
    const k = (exit.distance + 5) / exit.distance;
    const beyond: LngLat = [
      origin[0] + (exit.point[0] - origin[0]) * k,
      origin[1] + (exit.point[1] - origin[1]) * k,
    ];
    expect(['extreme', 'safe']).toContain(idx.lookup(beyond).status);
  });

  it('for an extreme warning, the way out from Waikīkī reaches a safe zone', () => {
    const origin: LngLat = [-157.8268, 21.276];
    const leave = [...idx.ofKind('tsunami'), ...idx.ofKind('extreme')];
    const exit = nearestExit(origin, leave, idx.ofKind('safe'))!;
    const k = (exit.distance + 5) / exit.distance;
    const beyond: LngLat = [
      origin[0] + (exit.point[0] - origin[0]) * k,
      origin[1] + (exit.point[1] - origin[1]) * k,
    ];
    expect(idx.lookup(beyond).status).toBe('safe');
  });
});

describe.skipIf(!existsSync(path))('makePolygonTester', () => {
  it('gives exactly the same answers as pointInPolygon on the real zones', async () => {
    const { makePolygonTester, pointInPolygon } = await import('./pointInPolygon');
    const fc = JSON.parse(readFileSync(path, 'utf8')) as ZoneCollection;
    const polys = fc.features.flatMap((f) =>
      f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates,
    );
    // Deterministic pseudo-random points across Oʻahu, plus every 50th polygon vertex
    // (exactly on a boundary, the hardest case).
    let seed = 42;
    const rand = () => (seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31;
    const pts: LngLat[] = Array.from({ length: 3000 }, () => [
      -158.3 + rand() * 0.68,
      21.24 + rand() * 0.48,
    ]);
    for (const poly of polys) poly[0]!.forEach((v, i) => i % 50 === 0 && pts.push(v));
    let mismatches = 0;
    for (const poly of polys) {
      const fast = makePolygonTester(poly);
      for (const p of pts) if (fast(p) !== pointInPolygon(p, poly)) mismatches++;
    }
    expect(mismatches).toBe(0);
  }, 60_000);
});

const walkPath = join(process.cwd(), 'public/data/walk.bin');

describe.skipIf(!existsSync(walkPath) || !existsSync(path))(
  'walking routes on real Oʻahu streets',
  async () => {
    const { WalkGraph } = await import('./route');
    const { decodeWalkGraph, ZONE_CODE } = await import('./walkGraph');
    const { distanceMeters } = await import('./distance');
    const buf = readFileSync(walkPath);
    const names = JSON.parse(
      readFileSync(join(process.cwd(), 'public/data/walk.json'), 'utf8'),
    ).names;
    const t0 = performance.now();
    const graph = new WalkGraph(
      decodeWalkGraph(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), names),
    );
    const loadMs = performance.now() - t0;
    const idx = ZoneIndex.fromGeoJSON(JSON.parse(readFileSync(path, 'utf8')) as ZoneCollection);

    const places: [string, LngLat][] = [
      ['Waikīkī Beach', [-157.8268, 21.276]],
      ['Haleʻiwa town', [-158.103, 21.592]],
      ['Aloha Tower', [-157.8663, 21.3069]],
      ['Kailua Beach', [-157.728, 21.397]],
    ];

    it('loads quickly enough for a phone', () => {
      expect(loadMs).toBeLessThan(3000);
    });

    it.each(places)('%s: route out of the tsunami zone ends on safe ground', (_, origin) => {
      const t = performance.now();
      const r = graph.routeToZone(origin, [ZONE_CODE.extreme, ZONE_CODE.safe])!;
      const ms = performance.now() - t;
      expect(r).not.toBeNull();
      expect(ms).toBeLessThan(500);
      expect(['extreme', 'safe']).toContain(idx.lookup(r.end).status);
      // A walk can't be shorter than the straight line to where it ends...
      expect(r.distance).toBeGreaterThanOrEqual(distanceMeters(origin, r.end) - 1);
      // ...and the drawn line is the route that was measured.
      let drawn = 0;
      for (let i = 1; i < r.coords.length; i++)
        drawn += distanceMeters(r.coords[i - 1]!, r.coords[i]!);
      expect(Math.abs(drawn - r.distance) / r.distance).toBeLessThan(0.02);
      expect(r.steps.length).toBeGreaterThan(0);
    });

    it('Waikīkī: route for an Extreme Tsunami Warning reaches a safe zone', () => {
      const r = graph.routeToZone([-157.8268, 21.276], [ZONE_CODE.safe])!;
      expect(idx.lookup(r.end).status).toBe('safe');
      expect(r.distance).toBeLessThan(5000);
    });
  },
);
